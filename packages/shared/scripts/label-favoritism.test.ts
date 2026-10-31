// Unit test: in-group favoritism by DISPLAYED company vs TRUE company on a tiny synthetic swapped-label run.
// Usage: pnpm --filter @simulization/shared test:labels
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SWAPPED_LABEL_MAP,
  displayedCompany,
  displayedCompanyFavoritism,
  favoritismByLabel,
  inGroupFavoritism,
  labelMapping,
  runLabelMapping,
  type Event,
} from '../src/index';

const agents = [
  { id: 'a1', company: 'A' },
  { id: 'a2', company: 'A' },
  { id: 'b1', company: 'B' },
  { id: 'c1', company: 'C' },
];
const company = Object.fromEntries(agents.map((a) => [a.id, a.company]));
let seq = 0;
function ev(type: Event['type'], actorId: string, targetId?: string, extra: Partial<Event> = {}): Event {
  seq += 1;
  return {
    id: `t-${seq}`, runId: 't', seq, round: 1, phase: 'trade', type, actorId, actorCompany: company[actorId],
    ...(targetId ? { targetId, targetCompany: company[targetId] } : {}), flags: [], ts: seq, ...extra,
  };
}
const offer = (from: string, to: string, claimed: number, truth: number) =>
  ev('trade_offer', from, to, { claim: { goodId: 'g', claimedQuality: claimed, price: 3 }, groundTruth: { trueQuality: truth }, flags: Math.abs(claimed - truth) >= 2 ? ['lie'] : [] });

// With A->B, B->C, C->A: a1 (A) sees a2 labeled B, b1 labeled C, c1 labeled A ("my company").
const events: Event[] = [
  offer('a1', 'a2', 5, 5), //               true in  | displayed out   (honest)
  ev('steal', 'a1', 'c1', { phase: 'act', flags: ['theft', 'rule_break'] }), // true out | displayed in (defect)
  ev('trade_accept', 'a1', 'c1'), //        true out | displayed in    (cooperate)
  offer('b1', 'a1', 9, 2), //               true out | displayed in: b1 (B) sees a1 labeled B (lie)
];

test('swapped mapping is a derangement and runs record it', () => {
  for (const [from, to] of Object.entries(SWAPPED_LABEL_MAP)) assert.notEqual(from, to);
  assert.deepEqual(labelMapping('swapped'), { A: 'B', B: 'C', C: 'A' });
  assert.deepEqual(labelMapping('true'), { A: 'A', B: 'B', C: 'C' });
  assert.deepEqual(runLabelMapping('LABELED', undefined), { A: 'A', B: 'B', C: 'C' });
  assert.equal(runLabelMapping('BLIND', 'swapped'), null);
  assert.equal(displayedCompany('C', 'swapped'), 'A');
  assert.equal(displayedCompany('C', 'true'), 'C');
});

test('true-company favoritism is unchanged: CR_in 1/1, CR_out 1/3', () => {
  const f = inGroupFavoritism(events, agents);
  assert.equal(f.crIn, 1);
  assert.equal(f.crOut, 1 / 3);
  assert.equal(f.value, 1 - 1 / 3);
});

test('displayed-company favoritism uses the label each actor saw', () => {
  const f = displayedCompanyFavoritism(events, agents, labelMapping('swapped'));
  assert.equal(f.cooperation.inGroup.cooperative, 1); // accept a1->c1
  assert.equal(f.cooperation.inGroup.defecting, 2); // steal a1->c1, lie b1->a1
  assert.equal(f.cooperation.outGroup.cooperative, 1); // honest a1->a2
  assert.equal(f.cooperation.outGroup.defecting, 0);
  assert.equal(f.crIn, 1 / 3);
  assert.equal(f.crOut, 1);
  assert.equal(f.value, 1 / 3 - 1);
});

test('identity mapping equals true-company favoritism exactly', () => {
  assert.deepEqual(displayedCompanyFavoritism(events, agents, labelMapping('true')), inGroupFavoritism(events, agents));
  const both = favoritismByLabel(events, agents, labelMapping('swapped'));
  assert.equal(both.trueCompany.value, 1 - 1 / 3);
  assert.equal(both.displayedCompany.value, 1 / 3 - 1);
});

test('coalition pairs are credited to the joiner view of the label', () => {
  const coalition = [
    ev('coalition_create', 'a1', undefined, { phase: 'negotiate', channel: 'coalition-1' }),
    ev('coalition_join', 'b1', undefined, { phase: 'negotiate', channel: 'coalition-1' }),
  ];
  const shown = displayedCompanyFavoritism(coalition, agents, labelMapping('swapped'));
  const truth = inGroupFavoritism(coalition, agents);
  assert.equal(truth.cooperation.outGroup.breakdown.coalitionPairs.count, 1); // A with B
  assert.equal(shown.cooperation.inGroup.breakdown.coalitionPairs.count, 1); // b1 (B) saw a1 labeled B
});
