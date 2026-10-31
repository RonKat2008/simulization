import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventSchema, type Event } from '@simulization/shared';
import { createWorld } from '../src/engine/world';
import { stepWorld } from '../src/engine/runner';
import { selectedAgentHistory } from '../../../apps/web/src/components/run/agent-history';
import { useEventStore } from '../../../apps/web/src/store/eventStore';

// The chart must match authoritative engine state at every committed phase, not only at the end.
let phases = 0;
for (const seed of [7, 42, 96]) {
  let state = createWorld({ runId: `history-${seed}`, seed, condition: 'LABELED', agentCount: 6 });
  const events: Event[] = [];
  while (state.status === 'running') {
    const next = await stepWorld(state);
    state = next.state; events.push(...next.events); phases++;
    for (const agent of Object.values(state.agents)) {
      const history = selectedAgentHistory(events, agent.id, state.seq, state.finalScores);
      assert.equal(history.reason, null);
      assert.equal(history.coins, agent.coins, `seed ${seed}, seq ${state.seq}, ${agent.id}`);
      assert.equal(history.coalition?.id ?? null, agent.coalitionId);
      assert.deepEqual(history.coalition?.members ?? [], Object.values(state.agents).filter(other=>other.id!==agent.id && agent.coalitionId && other.coalitionId===agent.coalitionId).map(other=>other.id).sort());
      assert.deepEqual(history.pacts, agent.pacts);
      assert.equal(history.score, state.finalScores?.[agent.id] ?? null);
    }
  }
  const id = 'merchant-01';
  const cutoff = events.find(e => e.round === 3)!.seq - 1;
  const prefix = events.filter(e => e.seq <= cutoff);
  assert.deepEqual(selectedAgentHistory(events, id, cutoff, state.finalScores), selectedAgentHistory(prefix, id, null));
  assert.equal(selectedAgentHistory(events, id, 0, state.finalScores).score, null);
  assert.equal(selectedAgentHistory(events.slice(1), id, null).coins, null);
  assert.equal(selectedAgentHistory(events.filter(e => e.seq !== 5), id, null).coins, null);
  assert.equal(selectedAgentHistory([...events, events[0]!], id, null).coins, null);
  const tampered = structuredClone(events);
  const theft = tampered.find(e => e.type === 'steal');
  if (theft) {
    theft.text = 'Stole 999 coins.';
    assert.equal(selectedAgentHistory(tampered, id, null).coins, null);
  }
  const reward = tampered.find(e => e.type === 'system' && e.targetId);
  if (reward) {
    reward.text = 'An unrecognized payout.';
    assert.equal(selectedAgentHistory(tampered, id, null).points.length, 0);
  }
}

// Existing recorded live run: reconstruct inventory transfers from the recorded good IDs and
// compare coins with persisted score minus final true inventory value. No network/model calls.
const recorded = JSON.parse(await readFile(new URL('../../../apps/web/public/runs/featured.json', import.meta.url), 'utf8'));
const recordedEvents = recorded.events.map((e: unknown) => EventSchema.parse(e)) as Event[];
const initial = createWorld({ runId: recorded.run.id, seed: recorded.run.seed, condition: recorded.run.condition, agentCount: recorded.run.agents.length });
for (const e of recordedEvents) {
  if (e.type !== 'trade_accept') continue;
  const seller = initial.agents[e.targetId!]!;
  const buyer = initial.agents[e.actorId]!;
  const good = seller.inventory.find(g => g.goodId === e.claim?.goodId);
  assert(good, 'Recorded accepted trade references a currently owned good');
  assert.equal(good.trueQuality, e.groundTruth?.trueQuality);
  seller.inventory = seller.inventory.filter(g => g.goodId !== good.goodId);
  buyer.inventory.push(good);
}
for (const agent of Object.values(initial.agents)) {
  const history = selectedAgentHistory(recordedEvents, agent.id, null, recorded.run.finalScores);
  assert.equal(history.reason, null);
  assert.equal(history.coins, recorded.run.finalScores[agent.id] - agent.inventory.reduce((sum, g) => sum + g.trueQuality, 0));
  assert.equal(history.points.length, 7, 'Start plus six observed rounds');
  assert.equal(history.score, recorded.run.finalScores[agent.id]);
  const firstClaim = recordedEvents.find(e => e.actorId === agent.id && e.type === 'trade_offer');
  if (firstClaim) {
    assert.equal(selectedAgentHistory(recordedEvents, agent.id, firstClaim.seq - 1).claims, 0);
    assert.equal(selectedAgentHistory(recordedEvents, agent.id, firstClaim.seq).claims, 1);
  }
}
const store = useEventStore.getState();
// A promise survives repeated breaches; count the responsible member's pact only once.
const pactEvents: Event[] = [
  { type: 'pact_accept', actorId: 'merchant-01', targetId: 'merchant-02' },
  { type: 'pact_break', actorId: 'merchant-01', targetId: 'merchant-02' },
  { type: 'pact_break', actorId: 'merchant-01', targetId: 'merchant-02' },
].map((e, i) => ({ ...e, runId: 'pact-audit', id: `pact-audit-${i + 1}`, seq: i + 1, round: 1, phase: 'negotiate', flags: [], ts: i } as Event));
assert.equal(selectedAgentHistory(pactEvents, 'merchant-01', null).pactsBroken, 1);
assert.equal(selectedAgentHistory(pactEvents, 'merchant-01', null).pactsFormed, 1);
assert.equal(selectedAgentHistory(pactEvents, 'merchant-02', null).pactsBroken, 0);
assert.equal(selectedAgentHistory(pactEvents, 'merchant-02', null).pactsFormed, 1);
store.reset(recorded.run.id); store.load(recordedEvents); store.setPlaybackSeq(12);
store.append(recordedEvents.slice(-1));
assert.equal(useEventStore.getState().playbackSeq, 12, 'Ingestion must not reveal queued future events');
store.reset('another-run');
assert.equal(useEventStore.getState().playbackSeq, 0);
assert.equal(useEventStore.getState().selectedAgentId, null);
console.log(`PASS selected-agent history: ${phases} engine phases; recorded live ${recorded.run.id} (${recordedEvents.length} events), all final balances; cutoff, gap, tamper, score and cursor guards. No paid calls.`);

// Event ingestion on reconnect never advances playback or adds duplicate effects.
store.load(recordedEvents); store.setPlaybackSeq(12);
store.append([...recordedEvents, ...recordedEvents]);
assert.equal(useEventStore.getState().events.length, recordedEvents.length);
assert.equal(useEventStore.getState().playbackSeq, 12);
const {describe} = await import('../../../apps/web/src/game/narrate');
const example = {...recordedEvents[0]!, type:'steal' as const, targetId:'merchant-02', text:'Stole 2 coins.'};
assert.match(describe(example, id=>id)!.sentence, /steals 2 coins/);
assert.doesNotMatch(describe(example, id=>id)!.sentence, /steals 4/);
const offer = recordedEvents.find(e=>e.type==='trade_offer')!;
assert.match(describe(offer, id=>id)!.label, /^Offer /);
assert.equal(describe(offer, id=>id)!.link,'trade');
assert.equal(describe({...offer,type:'trade_accept'},id=>id)!.link,'deal');
console.log('PASS reconnect deduplication and recorded outcome narration (offer ≠ accepted trade, capped theft).');
const {groupActivity,activityText}=await import('../../../apps/web/src/components/run/compact-activity');
const routine = recordedEvents.filter(e=>e.type==='work').slice(0,3).map((e,i)=>({...e,seq:i+1,round:1,phase:'act' as const}));
assert.equal(groupActivity(routine).length,1);
assert.equal(groupActivity(routine)[0]!.events.length,3);
const interrupted=[routine[0]!,{...offer,seq:2,round:1,phase:'act' as const},{...routine[1]!,seq:3}];
assert.equal(groupActivity(interrupted).length,3,'A trade/claim breaks routine-action grouping');
assert.equal(groupActivity([routine[0]!,{...routine[1]!,seq:3}]).length,2,'A missing/unseen event breaks grouping');
assert.match(activityText(routine[0]!,()=> 'Quill'),/^Quill worked · \+1 coin$/);
assert.match(activityText(example,id=>id),/2 coins$/);
console.log('PASS compact activity: only adjacent same-phase routine work groups; trades and missing events remain boundaries.');
