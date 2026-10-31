import { createRng, stubTurn, TURN_TIMEOUT_MS, TURN_RETRIES, type AgentStore, type AgentTurnOutput, type Event } from '@simulization/shared';
import { createWorld, buildTurnInput, advancePhase, type WorldOptions } from './world';
import { resolvePhase } from './rules';
import { phaseKey, type WorldState, type Turns } from './types';
export function turnSeed(s: WorldState, suffix: string): number {
  let n = s.seed >>> 0; for (const c of `${s.round}:${s.phase}:${s.tradeStep ?? ""}:${suffix}`) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0; return n;
}
export async function collectTurns(s: WorldState, adapter?: Pick<AgentStore, 'takeTurn'>, timeoutMs = TURN_TIMEOUT_MS): Promise<Turns> {
  const turns: Turns = {}; if (s.phase === 'reveal') return turns;
  const ids = Object.keys(s.agents).sort();
  for (let start = 0; start < ids.length; start += 6) await Promise.all(ids.slice(start,start+6).map(async id => {
    const input = buildTurnInput(s,id);
    if (adapter) {
      const requestId = `${phaseKey(s)}:${id}`;
      for (let attempt = 0; attempt <= TURN_RETRIES; attempt++) {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          turns[id] = await Promise.race([
            Promise.resolve().then(() => adapter.takeTurn(s.runId,id,structuredClone(input),controller.signal,requestId,Date.now()+timeoutMs)),
            new Promise<never>((_,reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Agent turn timeout')); },timeoutMs); }),
          ]);
          break;
        } catch {
          if (attempt === TURN_RETRIES) turns[id] = {private_plan:'',actions:[{type:'pass'}],memory_update:input.memory};
        } finally { if (timer !== undefined) clearTimeout(timer); controller.abort(); }
      }
    } else {
      const output: AgentTurnOutput = stubTurn(input,createRng(turnSeed(s,id)));
      if (s.phase === 'act') output.actions = output.actions.slice(0,1);
      turns[id] = output;
    }
  }));
  return turns;
}
export async function stepWorld(s: WorldState, adapter?: Pick<AgentStore, 'takeTurn'>, timeoutMs = TURN_TIMEOUT_MS) {
  const result = resolvePhase(s,await collectTurns(s,adapter,timeoutMs),createRng(turnSeed(s,'resolution')));
  const seq = ++result.state.seq;
  result.events.push({id:`${s.runId}-${seq}`,runId:s.runId,seq,round:s.round,phase:s.phase,type:'system',actorId:'world',flags:[],ts:s.epoch+seq,text:`Completed ${s.phase}${s.tradeStep ? `/${s.tradeStep}` : ''}.`});
  return {state:advancePhase(result.state),events:result.events};
}
export async function runStubGame(o: WorldOptions & {rounds?:number}) {
  let state = createWorld(o); const events: Event[] = [];
  while (state.status === 'running' && state.round <= (o.rounds ?? 6)) { const r = await stepWorld(state); state = r.state; events.push(...r.events); }
  return {state,events};
}
