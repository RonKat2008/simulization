import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { startingLuck, type StartingLuckInput } from '../../../packages/shared/src/starting-luck.ts';
import type { Event } from '../../../packages/shared/src/schemas';
const fixture: StartingLuckInput = {
  runId: 'fixture', status: 'done', agents: [{ id: 'a', name: 'A', model: 'exact-model' }, { id: 'b', name: 'B' }], terminalSeq: 2,
  initial: { runId: 'fixture', phase: 'initial', source: 'hand-calculated fixture', expectedGoods: { a: 2, b: 0 }, inventories: { a: [{ goodId: 'x', trueValue: 12 }, { goodId: 'y', trueValue: 8 }], b: [] } },
  events: [1, 2].map(seq => ({ id: String(seq), seq, runId: 'fixture', actorId: 'a', type: 'trade_offer', flags: seq === 1 ? ['lie', 'lie'] : [], claim: { goodId: 'x', claimedQuality: 9, price: 30 }, groundTruth: { trueQuality: 3 }, round: 1, phase: 'trade', ts: seq } as Event)),
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
  assert.ok(actual.issues.some(i => i.includes('Persisted initial')));
  console.log(name, raw.events.length, 'events; initial value unavailable');
}
console.log('Starting luck contracts passed');
