// Track A. Serialized Terse actor; never mark this class or its methods @Interleave.
import { Actor, Persisted, type ActorSocket } from 'durable-actors';
import {createActorTransport} from 'durable-actors/backend';
import { PHASE_DELAY_MS, stubTurn, createRng, runLabelMapping } from '@simulization/shared';
import type { Event, LabelMode, Monitoring, WealthVisibility } from '@simulization/shared';
import { createWorld } from '../engine/world';
import { stepWorld, turnSeed } from '../engine/runner';
import { phaseKey } from '../engine/types';
import { initializeLive, liveStore, deliverLiveEvent } from './liveAdapter';
import { RunPersistence, createTerseCheckpointStorage } from './persistence';
import { projectCheckpoint } from './neonProjection';

export class WorldActor extends Actor<null, { after: number }, unknown> {
  @Persisted private live = false;
  @Persisted private relayTokens: Record<string,string> = {};
  @Persisted private deliveredSeq = 0;
  @Persisted private stopped = false;
  @Persisted private automatic = false;
  @Persisted private stalledStub = false;
  @Persisted private projectionEnabled = false;
  @Persisted private requestedLive = false;
  @Persisted private projectedSeq = -1;
  @Persisted private projectedStopped = false;
  @Persisted private reportStatus = 'not-requested';
  @Persisted private setupError: string | null = null;

  /** Idempotent product entrypoint, also replayed by bootstrap's durable run directory. */
  async startRun(runId:string, seed:number, condition:'BLIND'|'LABELED', mode:'live'|'stub', agentCount=18, wealth_visibility:WealthVisibility='private', label_mode:LabelMode='true', monitoring:Monitoring='standard'):Promise<string> {
    if (!['private','public'].includes(wealth_visibility))throw new Error('Invalid wealth visibility');
    if (!['true','swapped'].includes(label_mode))throw new Error('Invalid label mode');
    if (!['standard','unmonitored'].includes(monitoring))throw new Error('Invalid monitoring');
    if (!['live','stub'].includes(mode)) throw new Error('Invalid run mode');
    const existing=await new RunPersistence(createTerseCheckpointStorage(this.db)).load();
    if(existing){
      if(existing.state.runId!==runId||existing.state.seed!==seed||existing.state.condition!==condition||Object.keys(existing.state.agents).length!==agentCount||this.requestedLive!==(mode==='live')||(existing.state.wealth_visibility??'private')!==wealth_visibility||(existing.state.label_mode??'true')!==label_mode||(existing.state.monitoring??'standard')!==monitoring)throw new Error('Run registration conflict');
      if(!this.setupError)this.alarm.set(Date.now()+PHASE_DELAY_MS);
      return this.status();
    }
    if (mode==='live' && (!process.env.DATABASE_URL || !process.env.AI_GATEWAY_API_KEY || !process.env.AGENTRELAY_API_KEY || process.env.MODEL_MODE==='stub')) throw new Error('Live runs require DATABASE_URL, AI_GATEWAY_API_KEY, AGENTRELAY_API_KEY and MODEL_MODE unset');
    if(runId!==this.id||!Number.isInteger(seed)||seed<-2147483648||seed>2147483647||!['BLIND','LABELED'].includes(condition)||![6,18].includes(agentCount))throw new Error('Invalid run options');
    await this.db.transaction(async()=>{
      await new RunPersistence(createTerseCheckpointStorage(this.db)).initialize(createWorld({runId,seed,condition,agentCount,wealth_visibility,label_mode,monitoring,epoch:Date.now()}));
      this.requestedLive=mode==='live';
      this.projectionEnabled=Boolean(process.env.DATABASE_URL);
      this.automatic=true;
      this.alarm.set(Date.now()+PHASE_DELAY_MS);
    });
    return this.status();
  }

  async syncProjection():Promise<void> {
    const cp=await new RunPersistence(createTerseCheckpointStorage(this.db)).load();
    if (cp && this.projectionEnabled && (this.projectedSeq!==cp.state.seq||this.projectedStopped!==this.stopped)) {
      await projectCheckpoint(this.stopped?{...cp,state:{...cp.state,status:'failed'}}:cp,this.live?'live-model-relay':this.requestedLive?'initializing-live':'deterministic-stub');
      this.projectedSeq=cp.state.seq;
      this.projectedStopped=this.stopped;
    }
  }

  async finishReport():Promise<void> {
    if (!this.live || !this.requestedLive) return;
    const result=await createActorTransport({controlPlaneUrl:process.env.DURABLE_ACTORS_URL??'http://127.0.0.1:7100',projectId:process.env.DURABLE_ACTORS_PROJECT_ID??'local',apiKey:process.env.DURABLE_ACTORS_SECRET||undefined}).invoke('ReportJob',this.id,'request',[]);
    this.reportStatus=String(result);
  }

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
    if(!this.live) { this.relayTokens=await initializeLive(cp.state,async(id,token)=>{this.relayTokens={...this.relayTokens,[id]:token};},this.relayTokens); this.live=true; }
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
    if (this.automatic && !this.stopped && !this.setupError && s.status === 'running' && this.alarm.get() === null) this.alarm.set(Date.now() + PHASE_DELAY_MS);
    return JSON.stringify({id:s.runId,condition:s.condition,wealth_visibility:s.wealth_visibility??'private',label_mode:s.label_mode??'true',monitoring:s.monitoring??'standard',label_mapping:runLabelMapping(s.condition,s.label_mode),seed:s.seed,status:this.stopped?'failed':s.status,round:s.round,phase:s.phase,tradeStep:s.tradeStep,finalScores:s.finalScores,agents:Object.values(s.agents).map(({id,name,company})=>({id,name,company})),stopped:this.stopped,setupError:this.setupError,mode:this.requestedLive && !this.live ? 'initializing-live' : this.live ? 'live-model-relay' : this.stalledStub ? 'stalled-stub-test' : 'deterministic-stub',projection:this.projectionEnabled?(this.projectedSeq===s.seq&&this.projectedStopped===this.stopped?'synced':'pending'):'disabled',reportStatus:this.reportStatus,nextKey:phaseKey(s),seq:s.seq,nextAlarm:this.alarm.get()});
  }

  /** expectedKey makes client retries safe even after the next phase has begun. */
  async advance(expectedKey: string): Promise<string> {
    if(this.requestedLive&&!this.live)throw new Error('Live initialization is not complete');
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
    await this.syncProjection();
    return this.status();
  }

  async onAlarm(): Promise<void> {
    try {
      const cp = await new RunPersistence(createTerseCheckpointStorage(this.db)).load();
      if (!cp) return;
      if(this.stopped){await this.syncProjection();this.alarm.delete();return;}
      if(!this.live)await this.syncProjection();
      if (this.requestedLive && !this.live) {
        if(this.setupError){this.alarm.delete();return;}
        try {this.relayTokens=await initializeLive(cp.state,async(id,token)=>{this.relayTokens={...this.relayTokens,[id]:token};},this.relayTokens);}
        catch(error){
          if(String(error).includes('agent_already_exists'))this.setupError='Relay registration token unavailable; start a new run or recover the token with Track B';
          throw error;
        }
        this.live=true;
      }
      await this.flushRelay();
      await this.syncProjection();
      if (cp.state.status === 'running') {
        await this.advance(phaseKey(cp.state));
        // Completion still needs a tick for report creation after the final projection.
        if (this.automatic) this.alarm.set(Date.now()+PHASE_DELAY_MS);
      } else {
        await this.finishReport();
        this.alarm.delete();
      }
    } catch {
      // Do not log provider bodies/credentials. The checkpoint and delivery cursors are retry-safe.
      if (this.automatic) this.alarm.set(Date.now()+5000);
    }
  }

  async events(after = 0): Promise<string> {
    if (!Number.isSafeInteger(after) || after < 0) throw new Error('Invalid event cursor');
    const cp = await new RunPersistence(createTerseCheckpointStorage(this.db)).load();
    if (!cp) throw new Error('Run not found');
    return JSON.stringify(cp.events.filter(e => e.seq > after));
  }

  async stop(): Promise<string> {
    await this.status(); // Reject nonexistent runs before any persistent mutation.
    const cp=await new RunPersistence(createTerseCheckpointStorage(this.db)).load();
    if(cp?.state.status!=='running')return this.status(); // Completion and its report remain final.
    await this.db.transaction(async () => {
      this.stopped = true;
      if(this.projectionEnabled)this.alarm.set(Date.now()+PHASE_DELAY_MS);else this.alarm.delete();
    });
    return this.status();
  }

  async onConnect(socket: ActorSocket<null, unknown>): Promise<void> {
    for (const event of JSON.parse(await this.events()) as Event[]) socket.send(event);
  }

  async onMessage(socket: ActorSocket<null, unknown>, message: {after: number}): Promise<void> {
    for (const event of JSON.parse(await this.events(message.after)) as Event[]) socket.send(event);
  }
}
