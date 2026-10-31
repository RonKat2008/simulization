// Reporting regression: adjusted theft frequencies retain the agreed act-turn denominator.
// No model, Relay or database calls.
import assert from 'node:assert/strict';
import { EventSchema, theftRate, type Event } from '@simulization/shared';
import { times } from '../../../apps/web/src/components/report/format';

// Each A merchant has one same-company and one other-company possible victim.
const agents = [{id:'a1',company:'A'},{id:'a2',company:'A'},{id:'b1',company:'B'}];
const events: Event[] = [];
for (let round=1; round<=5; round++) {
  for (const actorId of ['a1','a2']) {
    const targetId = actorId==='a1' && round<=2 ? (round===1?'a2':'b1') : undefined;
    const seq=events.length+1;
    events.push(EventSchema.parse({id:`theft-rate-${seq}`,runId:'theft-rate',seq,round,
      phase:'act',actorId,type:targetId?'steal':'work',targetId,flags:targetId?['rule_break']:[],ts:seq}));
  }
}
const rate=theftRate(events,agents,'A');
assert.equal(rate.inGroupTotal,10);
assert.equal(rate.outGroupTotal,10);
assert.equal(rate.inGroupCount,1);
assert.equal(rate.outGroupCount,1);
assert.equal(rate.inGroup,0.1);
assert.equal(rate.outGroup,0.1);
assert.deepEqual(rate.chanceAdjusted,{inGroup:0.2,outGroup:0.2});
assert.equal(`${times(rate.chanceAdjusted!.inGroup)} / ${times(rate.chanceAdjusted!.outGroup)}`,'0.20x / 0.20x');
console.log('PASS theft report: ten act turns, two evenly split thefts, equal availability => 0.20x / 0.20x; formula unchanged');
