// Owner: Person A. Durable checkpointing for one run. Dependency-free (no durable-actors import).
// Storage backends: any async get/put (tests), or Terse actor SQLite via createTerseCheckpointStorage(this.db).
// See PERSISTENCE.md for the contract and limitations.
import { EventSchema, type Event } from '@simulization/shared';
import { phaseKey, type WorldState } from '../engine/types';

/** Minimal key/value storage surface. `put` must be all-or-nothing for a single call. */
export interface CheckpointStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export type SqlValue = string | number | bigint | Uint8Array | null;

/** The part of Terse's `ActorDatabase` (`this.db` inside an Actor) that the adapter uses; structurally compatible. */
export interface SqlDatabase {
  exec<Row extends object = Record<string, SqlValue>>(sql: string, ...bindings: SqlValue[]): Row[];
}

const CHECKPOINT_TABLE = 'run_checkpoint';

/**
 * CheckpointStorage over Terse actor SQLite: each key is ONE row (key, JSON text value), written with a single
 * `INSERT ... ON CONFLICT DO UPDATE` statement. A single SQLite statement is atomic, so a snapshot is either the old
 * or the new value, never partial. Must be used while an actor call is active (the db is only valid then); the
 * table is created lazily on first use.
 *
 * To make the checkpoint atomic with other `@Persisted` fields, call `commit` inside `this.db.transaction(...)`
 * (verified by scripts/terse-probe.ts: a throw rolls back both SQL rows and `@Persisted` fields).
 */
export class TerseSqlCheckpointStorage implements CheckpointStorage {

  constructor(private readonly db: SqlDatabase, private readonly table: string = CHECKPOINT_TABLE) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new PersistenceError('invalid', `bad table name ${table}`);
  }

  private ensure(): void {
    this.db.exec(`CREATE TABLE IF NOT EXISTS ${this.table} (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`);
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    this.ensure();
    const rows = this.db.exec<{ value: unknown }>(`SELECT value FROM ${this.table} WHERE key = ?`, key);
    const row = rows[0];
    if (!row) return undefined;
    if (typeof row.value !== 'string') throw new PersistenceError('corrupt', `stored value for ${key} is not text`);
    try {
      return JSON.parse(row.value) as T;
    } catch (e) {
      throw new PersistenceError('corrupt', `stored value for ${key} is not valid JSON: ${(e as Error).message}`);
    }
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.ensure();
    const text = JSON.stringify(value);
    if (text === undefined) throw new PersistenceError('invalid', `value for ${key} is not JSON-serializable`);
    this.db.exec(
      `INSERT INTO ${this.table} (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      text,
    );
  }
}

/** `new RunPersistence(createTerseCheckpointStorage(this.db))` inside a Terse Actor. */
export function createTerseCheckpointStorage(db: SqlDatabase, table?: string): CheckpointStorage {
  return new TerseSqlCheckpointStorage(db, table);
}

export interface Checkpoint {
  state: WorldState;
  events: Event[];
  /** Phase keys (phaseKey of the state BEFORE resolution) already committed, in commit order. */
  committedKeys: string[];
}

export type PersistenceErrorCode = 'uninitialized' | 'stale' | 'invalid' | 'corrupt' | 'mismatch';

export class PersistenceError extends Error {
  constructor(public readonly code: PersistenceErrorCode, message: string) {
    super(`[persistence:${code}] ${message}`);
    this.name = 'PersistenceError';
  }
}

export const CHECKPOINT_KEY = 'run:checkpoint';

interface Snapshot extends Checkpoint {
  version: 1;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Throws 'invalid' unless `events` are schema-valid, belong to runId, and have ids/seqs contiguous from startSeq+1. */
function validateEvents(runId: string, startSeq: number, events: readonly Event[], code: PersistenceErrorCode): Event[] {
  const out: Event[] = [];
  events.forEach((raw, i) => {
    const parsed = EventSchema.safeParse(raw);
    if (!parsed.success) throw new PersistenceError(code, `event[${i}] fails EventSchema: ${parsed.error.message}`);
    const e = parsed.data;
    if (e.runId !== runId) throw new PersistenceError(code, `event[${i}] runId ${e.runId} != ${runId}`);
    const want = startSeq + 1 + i;
    if (e.seq !== want) throw new PersistenceError(code, `event[${i}] seq ${e.seq}, expected ${want}`);
    if (e.id !== `${runId}-${e.seq}`) throw new PersistenceError(code, `event[${i}] id ${e.id} != ${runId}-${e.seq}`);
    out.push(e);
  });
  return out;
}

/**
 * One durable snapshot per run, written with a single atomic put (one SQLite row on Terse).
 * Single-caller: WorldActor must serialize calls (commits are also queued internally).
 */
export class RunPersistence {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly storage: CheckpointStorage, private readonly key: string = CHECKPOINT_KEY) {}

  /** Load and integrity-check the snapshot; undefined if the run was never initialized. */
  async load(): Promise<Checkpoint | undefined> {
    const snap = await this.storage.get<Snapshot>(this.key);
    if (snap === undefined) return undefined;
    return this.verifyStored(snap);
  }

  /** Create the first checkpoint. Idempotent: if one exists for the same run it is returned unchanged. */
  initialize(state: WorldState): Promise<Checkpoint> {
    return this.enqueue(async () => {
      const existing = await this.load();
      if (existing) {
        if (existing.state.runId !== state.runId) {
          throw new PersistenceError('mismatch', `storage holds run ${existing.state.runId}, not ${state.runId}`);
        }
        return existing;
      }
      if (!state.runId) throw new PersistenceError('invalid', 'state.runId is empty');
      if (state.seq !== 0) throw new PersistenceError('invalid', `initial state.seq must be 0 (event stream starts at 1), got ${state.seq}`);
      const snap: Snapshot = { version: 1, state: clone(state), events: [], committedKeys: [] };
      await this.storage.put(this.key, snap);
      return clone({ state: snap.state, events: snap.events, committedKeys: snap.committedKeys });
    });
  }

  /**
   * Atomically record the result of resolving the phase identified by `expectedKey`
   * (= phaseKey of the state that was resolved). Nothing is written unless all checks pass.
   * - key already committed -> { duplicate: true }, existing checkpoint, no write
   * - key != phaseKey(current checkpoint state) -> 'stale' error
   */
  commit(expectedKey: string, state: WorldState, events: Event[]): Promise<{ checkpoint: Checkpoint; duplicate: boolean }> {
    return this.enqueue(async () => {
      const cur = await this.load();
      if (!cur) throw new PersistenceError('uninitialized', 'commit before initialize');
      if (cur.committedKeys.includes(expectedKey)) return { checkpoint: cur, duplicate: true };

      const curKey = phaseKey(cur.state);
      if (expectedKey !== curKey) throw new PersistenceError('stale', `expected ${expectedKey}, checkpoint is at ${curKey}`);
      if (cur.state.status !== 'running') throw new PersistenceError('stale', `run is ${cur.state.status}; no further commits`);

      if (state.runId !== cur.state.runId) throw new PersistenceError('invalid', `state.runId ${state.runId} != ${cur.state.runId}`);
      if (state.seq !== cur.state.seq + events.length) {
        throw new PersistenceError('invalid', `state.seq ${state.seq} != ${cur.state.seq} + ${events.length} events`);
      }
      if (state.status === 'running' && phaseKey(state) === expectedKey) {
        throw new PersistenceError('invalid', `running state did not advance past ${expectedKey}`);
      }
      const validated = validateEvents(cur.state.runId, cur.state.seq, events, 'invalid');

      const next: Snapshot = {
        version: 1,
        state: clone(state),
        events: [...cur.events, ...clone(validated)],
        committedKeys: [...cur.committedKeys, expectedKey],
      };
      await this.storage.put(this.key, next); // single atomic write
      const { version: _v, ...checkpoint } = clone(next);
      return { checkpoint, duplicate: false };
    });
  }

  private verifyStored(snap: Snapshot): Checkpoint {
    if (!snap || snap.version !== 1 || !snap.state || !Array.isArray(snap.events) || !Array.isArray(snap.committedKeys)) {
      throw new PersistenceError('corrupt', 'unrecognized snapshot shape');
    }
    // The stream always starts at seq 1 and state.seq is the last event's seq (0 when there are no events).
    const events = validateEvents(snap.state.runId, 0, snap.events, 'corrupt');
    if (snap.state.seq !== events.length) {
      throw new PersistenceError('corrupt', `state.seq ${snap.state.seq} != ${events.length} stored events`);
    }
    return clone({ state: snap.state, events, committedKeys: snap.committedKeys });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
