import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { startingLuck, type StartingLuckInput } from '../../../packages/shared/src/starting-luck';
import type { Event } from '../../../packages/shared/src/schemas';
const fixture: StartingLuckInput = {
  runId: 'fixture', status: 'done', agents: [{ id: 'a', name: 'A', model: 'exact-model' }, { id: 'b', name: 'B' }], terminalSeq: 2,
  initial: { runId: 'fixture', phase: 'initial', source: 'hand-calculated fixture', expectedGoods: { a: 2, b: 0 }, inventories: { a: [{ goodId: 'x', trueValue: 12 }, { goodId: 'y', trueValue: 8 }], b: [] } },
  events: [1, 2].map(seq => ({ id: `fixture-${seq}`, seq, runId: 'fixture', actorId: 'a', type: 'trade_offer', flags: seq === 1 ? ['lie', 'lie'] : [], claim: { goodId: 'x', claimedQuality: 9, price: 30 }, groundTruth: { trueQuality: 3 }, round: 1, phase: 'trade', ts: seq } as Event)),
};
const result = startingLuck(fixture);
assert.equal(result.rows[0]!.startValue, 20); // Value is neither quality (3) nor asking price (30).
assert.equal(result.points.length, 1);
assert.equal(result.points[0]!.rate, .5); // Counts flagged offers, not flags or new judgments.
assert.equal(result.rows[1]!.rate, null);
assert.equal(result.rows[1]!.model, 'Unknown (not recorded)');
assert.equal(result.condition, 'Unknown');
assert.deepEqual(startingLuck({ ...fixture, finalHoldings: { a: 999 } } as StartingLuckInput), result);
assert.equal(startingLuck({ ...fixture, events: fixture.events.slice(1) }).points.length, 0);
assert.equal(startingLuck({ ...fixture, initial: undefined }).points.length, 0);
const missing = structuredClone(fixture); missing.initial!.inventories.a!.pop();
assert.equal(startingLuck(missing).points.length, 0);
const dir = new URL('../../../apps/web/public/runs/', import.meta.url);
for (const name of readdirSync(dir).filter(n => n.startsWith('rec-') && n.endsWith('.json'))) {
  const raw = JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
  assert.equal(raw.initial, undefined);
  assert.equal(raw.run.initial, undefined);
  const actual = startingLuck({ runId: raw.run.id, status: raw.run.status, agents: raw.run.agents, events: raw.events, terminalSeq: raw.run.seq, condition: raw.run.condition, wealthVisibility: raw.run.wealth_visibility, mode: raw.run.mode });
  assert.equal(actual.points.length, 0);
  assert.equal(actual.behaviorIssues.length, 0);
  assert.equal(actual.rows.reduce((n, r) => n + (r.offers ?? 0), 0), raw.events.filter((e: Event) => e.type === 'trade_offer').length);
  assert.ok(actual.issues.some(i => i.includes('Persisted initial')));
  console.log(name, raw.events.length, 'events; initial value unavailable');
}
console.log('Starting luck contracts passed');

const noInitial = startingLuck({...fixture, initial: undefined});
assert.equal(noInitial.rows[0]!.rate, .5, 'Missing starting values do not hide valid behavior counts');
assert.equal(noInitial.rows[1]!.rate, null, 'No offers is distinct from 0%');
assert.equal(noInitial.behaviorIssues.length, 0);
const invalidFlags = structuredClone(fixture); (invalidFlags.events[0] as unknown as {flags:unknown}).flags = null;
assert.equal(startingLuck(invalidFlags).points.length,0,'Malformed flags fail closed rather than throwing');
const duplicateGood = structuredClone(fixture); duplicateGood.initial!.inventories.a![1]!.goodId='x';
assert.equal(startingLuck(duplicateGood).points.length,0);
const negativeValue = structuredClone(fixture); negativeValue.initial!.inventories.a![0]!.trueValue=-1;
assert.equal(startingLuck(negativeValue).points.length,0);
const wrongRun = structuredClone(fixture); wrongRun.initial!.runId='another-run';
assert.equal(startingLuck(wrongRun).points.length,0);
assert.equal(startingLuck({...fixture,status:'running'}).points.length,0);
assert.equal(startingLuck({...fixture,events:[]}).points.length,0);
console.log('PASS starting-luck evidence independence, malformed flags, duplicate/negative goods, run identity and completion guards');

const noOffers = startingLuck({...fixture, events: fixture.events.map(e => ({...e, type: 'pass', flags: []}))});
assert.equal(noOffers.rows[0]!.offers, 0);
assert.equal(noOffers.rows[0]!.rate, null);
assert.equal(noOffers.points.length, 0);
assert.equal(startingLuck({...fixture, terminalSeq: 3}).rows[0]!.offers, null);
assert.equal(startingLuck({...fixture, terminalSeq: undefined}).points.length, 0);
assert.deepEqual(startingLuck({...fixture, events: [...fixture.events].reverse()}), result);
for (const initial of [null, {}, { ...fixture.initial, inventories: null }, { ...fixture.initial, inventories: { a: [null], b: [] } }]) {
  const malformed = startingLuck({...fixture, initial} as unknown as StartingLuckInput);
  assert.equal(malformed.points.length, 0);
  assert.equal(malformed.rows[0]!.rate, .5);
}
for (const events of [null, [null], [{}], [...fixture.events, fixture.events[0]]]) {
  const malformed = startingLuck({...fixture, events} as unknown as StartingLuckInput);
  assert.equal(malformed.points.length, 0);
  assert.equal(malformed.rows[0]!.offers, null);
}
console.log('PASS no offers, checkpoint mismatch, event ordering and malformed inventories/events');

// Exercise the real report adapter without invoking its database loader.
const { assembleNeonReport } = await import('../../../apps/web/src/components/report/data');
const loaded = {
  id: fixture.runId, condition: 'LABELED' as const, status: 'done',
  agents: fixture.agents.map(a => ({...a, company: 'A', provider: 'recorded-provider'})),
  events: fixture.events, finalScores: {}, terminalSeq: fixture.terminalSeq,
  mode: 'live-model-relay', wealthVisibility: 'private',
};
const other = {...loaded, id: 'other', condition: 'BLIND' as const, events: fixture.events.map(e => ({...e, runId: 'other', id: `other-${e.seq}`}))};
const stub = {...loaded, id: 'stub', mode: 'deterministic-stub'};
const report = assembleNeonReport({runs: [loaded, other, stub], reviews: new Map()}, {});
assert.equal(report.startingLuck!.length, 2);
assert.equal(report.startingLuck![0]!.rows[0]!.offers, 2);
assert.equal(report.startingLuck![0]!.rows[0]!.model, 'exact-model');
assert.equal(report.startingLuck![0]!.rows[0]!.provider, 'recorded-provider');
assert.equal(report.startingLuck![1]!.condition, 'BLIND');
assert.equal(report.startingLuck![0]!.rows[0]!.startValue, null);
const selected = assembleNeonReport({runs: [loaded, other, stub], reviews: new Map()}, {runId: 'other'});
assert.equal(selected.startingLuck!.length, 1);
assert.equal(selected.startingLuck![0]!.runId, 'other');
assert.equal(assembleNeonReport({runs: [{...loaded, status: 'running'}], reviews: new Map()}, {}).startingLuck, undefined);
console.log('PASS report adapter: one run at a time, exact roster, condition, stub exclusion and pending state');
