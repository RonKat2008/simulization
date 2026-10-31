// Track A. Serialized Terse actor; never mark this class or its methods @Interleave.
import { Actor, Persisted, type ActorSocket } from 'durable-actors';
import { PHASE_DELAY_MS, stubTurn, createRng } from '@simulization/shared';
import type { Event } from '@simulization/shared';
import { createWorld } from '../engine/world';
import { stepWorld, turnSeed } from '../engine/runner';
import { phaseKey } from '../engine/types';
import { initializeLive, liveStore, deliverLiveEvent } from './liveAdapter';
import { RunPersistence, createTerseCheckpointStorage } from './persistence';

export class WorldActor extends Actor<null, { after: number }, unknown> {
  @Persisted private live = false;
  @Persisted private relayTokens: Record<string,string> = {};
  @Persisted private deliveredSeq = 0;
  @Persisted private stopped = false;
  @Persisted private automatic = false;
  @Persisted private stalledStub = false;

  async initialize(runId: string, seed: number, condition: "BLIND" | "LABELED", agentCount = 6, automatic = true, stalledStub = false): Promise<string> {
    if (runId !== this.id) throw new Error('Run ID must match actor ID');
    if (!Number.isSafeInteger(seed) || !['BLIND','LABELED'].includes(condition)) throw new Error('Invalid run options');
    await this.db.transaction(async () => {
      const p = new RunPersistence(createTerseCheckpointStorage(this.db));
      const existing = await p.load();
      if (existing) {
        if (existing.state.seed !== seed || existing.state.condition !== condition || Object.keys(existing.state.agents).length !== agentCount) throw new Error('Run already initialized with different options');
        return;
      }
      await p.initialize(createWorld({runId,seed,condition,agentCount,epoch:Date.now()}));
      this.automatic = automatic;
      this.stalledStub = stalledStub;
      if (automatic) this.alarm.set(Date.now() + PHASE_DELAY_MS);
    });
    return this.status();
  }

  async enableLive(): Promise<string> {
    const cp=await new RunPersistence(createTerseCheckpointStorage(this.db)).load();
    if(!cp || cp.state.seq !== 0 || this.automatic) throw new Error('Live setup requires a new manually stepped run');
    if(!this.live) { this.relayTokens=await initializeLive(cp.state); this.live=true; }
    return this.status();
  }
  async flushRelay(): Promise<void> {
    if(!this.live) return;
    const cp=await new RunPersistence(createTerseCheckpointStorage(this.db)).load();
    for(const event of cp?.events ?? []) if(event.seq>this.deliveredSeq) {
      await deliverLiveEvent(event,this.relayTokens);
      this.deliveredSeq=event.seq;
    }
  }
  async status(): Promise<string> {
    const cp = await new RunPersistence(createTerseCheckpointStorage(this.db)).load();
    if (!cp) throw new Error('Run not found');
    const s = cp.state;
    // Terse local restart can restore the checkpoint without its scheduled alarm.
    // Reconcile on access; never advance state during a status read.
    if (this.automatic && !this.stopped && s.status === 'running' && this.alarm.get() === null) this.alarm.set(Date.now() + PHASE_DELAY_MS);
    return JSON.stringify({id:s.runId,condition:s.condition,seed:s.seed,status:s.status,round:s.round,phase:s.phase,tradeStep:s.tradeStep,finalScores:s.finalScores,stopped:this.stopped,mode:this.live ? 'live-model-relay' : this.stalledStub ? 'stalled-stub-test' : 'deterministic-stub',nextKey:phaseKey(s),seq:s.seq,nextAlarm:this.alarm.get()});
  }

  /** expectedKey makes client retries safe even after the next phase has begun. */
  async advance(expectedKey: string): Promise<string> {
    const p = new RunPersistence(createTerseCheckpointStorage(this.db));
    const cp = await p.load();
    if (!cp) throw new Error('Run not found');
    await this.flushRelay();
    if (cp.committedKeys.includes(expectedKey)) return this.status();
    if (expectedKey !== phaseKey(cp.state)) throw new Error('Stale phase key');
    if (this.stopped || cp.state.status !== 'running') return this.status();
    const result = await stepWorld(cp.state, this.live ? liveStore() : this.stalledStub ? {
      takeTurn: async (_runId, id, input) => {
        if (id === Object.keys(cp.state.agents).sort()[0] && input.phase === 'act') return new Promise<never>(() => {});
        const output = stubTurn(input,createRng(turnSeed(cp.state,id)));
        if (input.phase === 'act') output.actions = output.actions.slice(0,1);
        return output;
      },
    } : undefined);
    await this.db.transaction(async () => {
      await p.commit(expectedKey,result.state,result.events);
      if (this.automatic && result.state.status === 'running') this.alarm.set(Date.now() + PHASE_DELAY_MS);
      else this.alarm.delete();
    });
    // Commit first. A lost broadcast is recovered through events(after), never by reapplying actions.
    for (const event of result.events) this.broadcast(event);
    await this.flushRelay();
    return this.status();
  }

  async onAlarm(): Promise<void> {
    const cp = await new RunPersistence(createTerseCheckpointStorage(this.db)).load();
    if (cp && !this.stopped && cp.state.status === 'running') await this.advance(phaseKey(cp.state));
  }

  async events(after = 0): Promise<string> {
    if (!Number.isSafeInteger(after) || after < 0) throw new Error('Invalid event cursor');
    const cp = await new RunPersistence(createTerseCheckpointStorage(this.db)).load();
    if (!cp) throw new Error('Run not found');
    return JSON.stringify(cp.events.filter(e => e.seq > after));
  }

  async stop(): Promise<string> {
    await this.status(); // Reject nonexistent runs before any persistent mutation.
    await this.db.transaction(async () => { this.stopped = true; this.alarm.delete(); });
    return this.status();
  }

  async onConnect(socket: ActorSocket<null, unknown>): Promise<void> {
    for (const event of JSON.parse(await this.events()) as Event[]) socket.send(event);
  }

  async onMessage(socket: ActorSocket<null, unknown>, message: {after: number}): Promise<void> {
    for (const event of JSON.parse(await this.events(message.after)) as Event[]) socket.send(event);
  }
}
