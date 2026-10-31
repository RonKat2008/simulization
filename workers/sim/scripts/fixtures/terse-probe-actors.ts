// Fixture actors for scripts/terse-probe.ts. Not used by the product.
import { Actor, Persisted } from 'durable-actors';

export class ProbeActor extends Actor {
  @Persisted private marker = '';
  @Persisted private counter = 0;

  async setMarker(marker: string): Promise<void> {
    this.marker = marker;
    this.counter = this.counter + 1;
  }

  async getMarker(): Promise<{ marker: string; counter: number }> {
    return { marker: this.marker, counter: this.counter };
  }

  /** Writes @Persisted fields AND a SQL row inside db.transaction, then throws: all must roll back. */
  async failedTransaction(marker: string): Promise<void> {
    await this.db.transaction(async () => {
      this.marker = marker;
      this.counter = this.counter + 100;
      this.db.exec('CREATE TABLE IF NOT EXISTS probe_kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
      this.db.exec('INSERT INTO probe_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', 'rolled', marker);
      throw new Error('probe: intentional rollback');
    });
  }

  /** Same writes in a transaction that commits. */
  async committedTransaction(marker: string): Promise<void> {
    await this.db.transaction(async () => {
      this.marker = marker;
      this.counter = this.counter + 1;
      this.db.exec('CREATE TABLE IF NOT EXISTS probe_kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
      this.db.exec('INSERT INTO probe_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', 'rolled', marker);
    });
  }

  async sqlValue(): Promise<string | null> {
    this.db.exec('CREATE TABLE IF NOT EXISTS probe_kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    const rows = this.db.exec<{ v: string }>('SELECT v FROM probe_kv WHERE k = ?', 'rolled');
    return rows[0]?.v ?? null;
  }

  /** Generic SQL passthrough used to exercise the persistence adapter on a real actor DB. */
  async sql(statement: string, bindings: (string | number | null)[]): Promise<Record<string, string | number | null>[]> {
    return this.db.exec<Record<string, string | number | null>>(statement, ...bindings);
  }

  async sqlTx(statements: { sql: string; bindings: (string | number | null)[] }[], failAfter: boolean): Promise<void> {
    await this.db.transaction(async () => {
      for (const s of statements) this.db.exec(s.sql, ...s.bindings);
      if (failAfter) throw new Error('probe: intentional rollback');
    });
  }
}

// ---- RunPersistence over Terse SQLite, driving the real pure engine inside a real actor ----
import { createWorld } from '../../src/engine/world';
import { stepWorld } from '../../src/engine/runner';
import { phaseKey } from '../../src/engine/types';
import { RunPersistence, PersistenceError, createTerseCheckpointStorage } from '../../src/world/persistence';

// NOTE: Terse requires every method on an Actor class to be async, so helpers live outside the class.
const persistenceOf = (db: Actor['db'], key?: string): RunPersistence => new RunPersistence(createTerseCheckpointStorage(db), key);
const codeOf = (e: unknown): string => (e instanceof PersistenceError ? e.code : `non-persistence:${String(e)}`);

export class RunProbeActor extends Actor {
  @Persisted private flag = 'new';

  async initializeRollbackRetry(): Promise<number> {
    const p = new RunPersistence(createTerseCheckpointStorage(this.db, 'rollback_init'));
    const state = createWorld({runId:'rollback-init',seed:1,condition:'BLIND',agentCount:6});
    try { await this.db.transaction(async () => { await p.initialize(state); throw new Error('intentional-init-rollback'); }); }
    catch(e) { if(!String(e).includes('intentional-init-rollback')) throw e; }
    // Reuse the SAME adapter whose CREATE TABLE was rolled back.
    if(await p.load()) throw new Error('failed initialization persisted');
    return (await p.initialize(state)).state.seq;
  }

  async init(runId: string, seed: number, agentCount: number): Promise<{ seq: number }> {
    const cp = await persistenceOf(this.db).initialize(createWorld({ runId, seed, condition: 'LABELED', agentCount, epoch: 0 }));
    return { seq: cp.state.seq };
  }

  /** Resolves one phase from the stored checkpoint and commits it. */
  async step(): Promise<{ status: string; seq: number; duplicate: boolean }> {
    const p = persistenceOf(this.db);
    const cp = await p.load();
    if (!cp) throw new Error('not initialized');
    const r = await stepWorld(cp.state);
    const { checkpoint, duplicate } = await p.commit(phaseKey(cp.state), r.state, r.events);
    return { status: checkpoint.state.status, seq: checkpoint.state.seq, duplicate };
  }

  /** Commits the same resolved phase twice: the second must be a no-op duplicate. */
  async stepTwice(): Promise<{ first: boolean; second: boolean; seqAfter: number; eventsAfter: number }> {
    const p = persistenceOf(this.db);
    const cp = (await p.load())!;
    const r = await stepWorld(cp.state);
    const a = await p.commit(phaseKey(cp.state), r.state, r.events);
    const b = await p.commit(phaseKey(cp.state), r.state, r.events);
    return { first: a.duplicate, second: b.duplicate, seqAfter: b.checkpoint.state.seq, eventsAfter: b.checkpoint.events.length };
  }

  /** Valid commit inside db.transaction that then throws: the checkpoint row must roll back. */
  async commitThenThrow(): Promise<{ before: number; after: number }> {
    const p = persistenceOf(this.db);
    const before = (await p.load())!.state.seq;
    try {
      await this.db.transaction(async () => {
        const cp = (await p.load())!;
        const r = await stepWorld(cp.state);
        await p.commit(phaseKey(cp.state), r.state, r.events);
        this.flag = 'rolled-back-should-not-stick';
        throw new Error('probe: rollback after commit');
      });
    } catch (e) {
      if (!String(e).includes('rollback after commit')) throw e;
    }
    return { before, after: (await p.load())!.state.seq };
  }

  /** Error codes for malformed inputs; none may change the stored checkpoint. */
  async rejects(): Promise<Record<string, string>> {
    const p = persistenceOf(this.db);
    const cp = (await p.load())!;
    const r = await stepWorld(cp.state);
    const out: Record<string, string> = {};
    const attempt = async (name: string, fn: () => Promise<unknown>) => {
      try { await fn(); out[name] = 'NO_ERROR'; } catch (e) { out[name] = codeOf(e); }
    };
    await attempt('stale', () => p.commit('nope:0:negotiate:', r.state, r.events));
    await attempt('seqGap', () => p.commit(phaseKey(cp.state), { ...r.state, seq: r.state.seq + 1 }, r.events));
    await attempt('badEventSeq', () => p.commit(phaseKey(cp.state), r.state, r.events.map((e, i) => (i === 0 ? { ...e, seq: e.seq + 7, id: `${e.runId}-${e.seq + 7}` } : e))));
    await attempt('initSeqNonZero', () => persistenceOf(this.db, 'other:key').initialize({ ...createWorld({ runId: 'x', seed: 1, condition: 'BLIND', agentCount: 6, epoch: 0 }), seq: 5 }));
    await attempt('mismatch', () => p.initialize(createWorld({ runId: 'different', seed: 1, condition: 'BLIND', agentCount: 6, epoch: 0 })));
    // Tamper: hand-write a snapshot whose event stream starts at seq 3, then load it.
    const storage = createTerseCheckpointStorage(this.db);
    const fresh = createWorld({ runId: 'tamper', seed: 1, condition: 'BLIND', agentCount: 6, epoch: 0 });
    const ev = (seq: number) => ({ id: `tamper-${seq}`, runId: 'tamper', seq, round: 1, phase: 'negotiate', type: 'system', actorId: 'world', flags: [], ts: seq, text: 'x' });
    await storage.put('tampered', { version: 1, state: { ...fresh, seq: 3 }, events: [ev(2), ev(3)], committedKeys: [] });
    await attempt('streamNotFromOne', () => persistenceOf(this.db, 'tampered').load());
    await storage.put('tampered2', { version: 1, state: { ...fresh, seq: 2 }, events: [ev(1)], committedKeys: [] });
    await attempt('stateSeqMismatch', () => persistenceOf(this.db, 'tampered2').load());
    out.checkpointSeqAfter = String((await p.load())!.state.seq);
    return out;
  }

  /** Whole checkpoint as JSON text (compared byte-for-byte across restarts). */
  async dump(): Promise<string> {
    return JSON.stringify(await persistenceOf(this.db).load());
  }

  async flagValue(): Promise<string> {
    return this.flag;
  }
}
