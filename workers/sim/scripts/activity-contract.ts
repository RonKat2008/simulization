import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventSchema, type Event } from '@simulization/shared';
import { activityAtCursor, activityGroupText, activityText, groupActivity } from '../../../apps/web/src/components/run/compact-activity';

const event = (seq: number, patch: Partial<Event> = {}): Event => ({
  id: `activity-${seq}`, runId: 'activity', seq, round: 1, phase: 'act',
  type: 'work', actorId: `agent-${seq}`, flags: [], ts: seq, ...patch,
});
const label = (id: string) => id === 'agent-1' ? 'Quill' : id;
const works = [event(1), event(2), event(3)];
assert.equal(activityGroupText(groupActivity(works)[0]!, label), '3 agents worked · +1 coin each');
assert.equal(activityText(works[0]!, label), 'Quill worked · +1 coin');
assert.equal(activityGroupText(groupActivity([event(1), event(2, { actorId: 'agent-1' })])[0]!, label), '2 work actions · +2 coins total');

// Each boundary must remain visible and must never be swallowed by a routine group.
for (const patch of [
  { type: 'trade_accept' }, { type: 'trade_offer', flags: ['lie'] },
  { type: 'steal', flags: ['theft'] }, { type: 'pact_accept' },
  { type: 'pact_break', flags: ['broken_pact'] }, { flags: ['eval_aware'] },
  { round: 2 }, { phase: 'reveal' },
] as Partial<Event>[]) {
  const groups = groupActivity([event(1), event(2, patch), event(3)]);
  assert.equal(groups.length, 3, JSON.stringify(patch));
}
assert.equal(groupActivity([event(1), event(3)]).length, 2, 'Missing sequences break routine groups');
assert.equal(groupActivity([event(1), event(2, { type: 'system', actorId: 'world' }), event(3)]).length, 2, 'Hidden world markers still break routine groups');
assert.equal(activityAtCursor(works, 0).length, 0);
assert.equal(activityAtCursor(works, 2)[0]!.events.length, 2, 'Future group members must not leak');
assert.equal(activityAtCursor(works, null)[0]!.events.length, 3, 'Null explicitly requests the full loaded overview');
assert.equal(activityText(event(1, { type: 'steal', targetId: 'agent-2', text: 'Stole 2 coins.' }), label), 'Quill stole from agent-2 · 2 coins');
assert.equal(activityText(event(1, { type: 'caught' }), label), 'Quill was caught', 'Missing penalty amounts are not invented');
assert.equal(activityText(event(1, { type: 'trade_offer', targetId: 'agent-2', claim: { goodId: 'good', claimedQuality: 8, price: 3 } }), label), 'Quill offered an item to agent-2 · claimed quality 8 · 3 coins');

// Replaying a finished real recording must expose exactly the same groups as a prefix-only log.
// This reads local data only; no model, Relay, backend or database requests.
const recorded = JSON.parse(await readFile(new URL('../../../apps/web/public/runs/featured.json', import.meta.url), 'utf8'));
const events = recorded.events.map((e: unknown) => EventSchema.parse(e)) as Event[];
for (const cutoff of [0, ...events.map(e => e.seq)]) {
  const actual = activityAtCursor(events, cutoff);
  assert.deepEqual(actual, groupActivity(events.filter(e => e.seq <= cutoff)));
  assert(actual.every(g => g.events.every(e => e.seq <= cutoff)));
}
const round4 = events.find(e => e.round === 4)!.seq;
const round4Groups = activityAtCursor(events, round4);
assert(round4Groups.every(g => g.events.every(e => e.round <= 4)), 'No Round 6 actions in Round 4');
assert.equal(activityAtCursor(events, 0).length, 0, 'Seeking backward clears completed-run actions');
console.log(`PASS activity contract: grouping boundaries, accurate copy, and all ${events.length + 1} recorded cursor positions.`);

const contributions = [event(1,{type:'contribute'}), event(2,{type:'contribute'})];
assert.equal(activityGroupText(groupActivity(contributions)[0]!,label), '2 agents contributed · −1 coin each');
const rewards = [1,2].map(seq=>event(seq,{type:'system',actorId:'world',targetId:`agent-${seq}`,phase:'reveal',text:'Coalition reward: 2 coins.'}));
assert.equal(activityGroupText(groupActivity(rewards)[0]!,label), '2 coalition rewards · +2 coins each');
assert.equal(groupActivity([rewards[0]!,{...rewards[1]!,text:'Coalition reward: 3 coins.'}]).length,2);
assert.equal(activityAtCursor(rewards,1)[0]!.events.length,1);
assert.equal(groupActivity([contributions[0]!,{...contributions[1]!,flags:['eval_aware']}]).length,2);
console.log('PASS contribution/reward grouping: exact recorded amounts, flags, and cursor boundaries.');
