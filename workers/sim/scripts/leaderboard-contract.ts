import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventSchema, type Event } from '@simulization/shared';
import { buildLeaderboardRows } from '../../../apps/web/src/components/run/leaderboard-data';
import { useEventStore } from '../../../apps/web/src/store/eventStore';
import type { RunAgent } from '../../../apps/web/src/components/run/run-helpers';

// Read-only recorded data; no actor, model, Relay, or database calls.
const recorded = JSON.parse(await readFile(new URL('../../../apps/web/public/runs/featured.json', import.meta.url), 'utf8'));
const events: Event[] = recorded.events.map((event: unknown) => EventSchema.parse(event));
const agents: RunAgent[] = recorded.run.agents;
const finalScores: Record<string, number> = recorded.run.finalScores;
const initial = buildLeaderboardRows(agents, events, 0, finalScores);
assert.equal(initial.length, agents.length);
assert(initial.every(row => row.history.coins === null && row.rank === null && row.history.claims === 0 && row.history.thefts === 0));

// The complete recording and an actually truncated log must produce identical standings.
// This catches accidental final-wealth ranking, counts, scores, and denominator leakage.
for (const round of [1, 2, 3, 4, 5, 6]) {
  const cutoff = events.find(event => event.round === round)!.seq;
  const rows = buildLeaderboardRows(agents, events, cutoff, finalScores);
  const truncated = buildLeaderboardRows(agents, events.filter(event => event.seq <= cutoff), null, finalScores);
  assert.deepEqual(rows, truncated, `Round ${round} follows the applied cursor`);
  assert(rows.every(row => row.history.score === null), 'Final score cannot influence early standings');
  for (const row of rows) {
    const own = events.filter(event => event.seq <= cutoff && event.actorId === row.agent.id);
    assert.equal(row.history.claims, own.filter(event => event.type === 'trade_offer').length);
    assert.equal(row.history.falseClaims, own.filter(event => event.type === 'trade_offer' && event.flags.includes('lie')).length);
    assert.equal(row.history.thefts, own.filter(event => event.type === 'steal').length);
  }
}
const finished = buildLeaderboardRows(agents, events, events.at(-1)!.seq, finalScores);
assert.deepEqual(finished, buildLeaderboardRows(agents, events, null, finalScores));
for (let index = 1; index < finished.length; index++) {
  const previous = finished[index - 1]!, current = finished[index]!;
  assert(previous.history.coins! >= current.history.coins!);
  assert.equal(current.rank, previous.history.coins === current.history.coins ? previous.rank : index + 1);
}
assert.equal(new Set(buildLeaderboardRows(agents, events, 1, finalScores).map(row => row.rank)).size, 1, 'Equal starting wealth shares rank');
assert(buildLeaderboardRows(agents, events.filter(event => event.seq !== 2), null, finalScores).every(row => row.rank === null && row.history.coins === null), 'Incomplete histories cannot be ranked as known wealth');
assert.deepEqual(buildLeaderboardRows([], events, null, finalScores), []);

// The featured recording has no thefts, so exercise a future theft and false claim explicitly.
const sampleOffer = events.find(event => event.type === 'trade_offer')!;
const boundaryEvents: Event[] = [
  { ...events[0]!, type: 'work' as const, actorId: 'merchant-01', targetId: undefined, flags: [] },
  { ...sampleOffer, actorId: 'merchant-01', targetId: 'merchant-02', flags: ['lie'] as Event['flags'] },
  { ...events[0]!, type: 'steal' as const, actorId: 'merchant-01', targetId: 'merchant-02', text: 'Stole 4 coins.', flags: ['theft'] as Event['flags'] },
].map((event, index) => ({ ...event, id: `leaderboard-boundary-${index + 1}`, runId: 'leaderboard-boundary', seq: index + 1, round: 1, phase: 'negotiate' }));
const at = (seq: number) => buildLeaderboardRows(agents, boundaryEvents, seq, finalScores).find(row => row.agent.id === 'merchant-01')!.history;
assert.deepEqual([at(1).coins, at(1).claims, at(1).falseClaims, at(1).thefts], [11, 0, 0, 0]);
assert.deepEqual([at(2).coins, at(2).claims, at(2).falseClaims, at(2).thefts], [11, 1, 1, 0]);
assert.deepEqual([at(3).coins, at(3).claims, at(3).falseClaims, at(3).thefts], [15, 1, 1, 1]);
const invertedScores = Object.fromEntries(agents.map((agent, index) => [agent.id, index * 1000]));
assert.deepEqual(buildLeaderboardRows(agents, events, null, invertedScores).map(row => row.agent.id), finished.map(row => row.agent.id), 'Wealth rank does not use game score');

const store = useEventStore.getState();
store.reset(recorded.run.id); store.load(events); store.setPlaybackSeq(20);
const beforeReconnect = buildLeaderboardRows(agents, useEventStore.getState().events, useEventStore.getState().playbackSeq, finalScores);
store.append(events.slice(-4));
assert.deepEqual(buildLeaderboardRows(agents, useEventStore.getState().events, useEventStore.getState().playbackSeq, finalScores), beforeReconnect);
store.select(agents[0]!.id);
assert.equal(useEventStore.getState().selectedAgentId, agents[0]!.id);
store.select(null);
assert.equal(useEventStore.getState().selectedAgentId, null);
store.reset();
console.log(`PASS leaderboard: ${events.length} recorded events, ${agents.length} agents, six replay cutoffs, ties, no-data, missing history, reconnect and selection state.`);
