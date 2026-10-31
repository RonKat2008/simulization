// Swapped-label smoke: a full 18-agent stub game with label_mode=swapped (no models, network or keys).
// Usage: pnpm --filter sim smoke:labels
import assert from 'node:assert/strict';
import { AgentTurnInputSchema, SWAPPED_LABEL_MAP, createRng, runLabelMapping, stubTurn, type AgentTurnInput, type Event } from '@simulization/shared';
import { createWorld } from '../src/engine/world';
import { stepWorld, turnSeed } from '../src/engine/runner';
import type { WorldState } from '../src/engine/types';

const swap = SWAPPED_LABEL_MAP as Record<string, string>;

/** Same deterministic stub behavior as the engine's built-in path, but records every agent input. */
async function play(label_mode: 'true' | 'swapped', condition: 'LABELED' | 'BLIND' = 'LABELED') {
  let state: WorldState = createWorld({ runId: `labels-${condition}` /* same id in both arms: offer ids embed it */, seed: 11, condition, agentCount: 18, label_mode });
  const inputs: AgentTurnInput[] = [];
  const events: Event[] = [];
  const adapter = {
    takeTurn: async (_runId: string, id: string, input: AgentTurnInput) => {
      inputs.push(AgentTurnInputSchema.parse(input));
      const output = stubTurn(input, createRng(turnSeed(state, id)));
      if (input.phase === 'act') output.actions = output.actions.slice(0, 1);
      return output;
    },
  };
  while (state.status === 'running') {
    const r = await stepWorld(state, adapter);
    state = r.state;
    events.push(...r.events);
  }
  return { state, inputs, events };
}

const swapped = await play('swapped');
const truth = Object.fromEntries(Object.values(swapped.state.agents).map((a) => [a.id, a.company]));
assert.equal(swapped.state.status, 'done');
assert.equal(swapped.state.label_mode, 'swapped');
assert.ok(swapped.inputs.length > 18 * 6, 'every phase produced agent inputs');

let peerLabels = 0;
for (const input of swapped.inputs) {
  // (b) own company is true
  assert.equal(input.self.company, truth[input.self.id], 'own company must stay true');
  // (a) no other agent is ever shown with its true company; the shown label follows the fixed rotation
  for (const peer of input.otherAgents) {
    assert.ok(peer.company, 'LABELED inputs show a company for every peer');
    assert.notEqual(peer.company, truth[peer.id], `peer ${peer.id} shown with its true company`);
    assert.equal(peer.company, swap[truth[peer.id]!]);
    peerLabels++;
  }
  // Company labels reach the agent only through self + otherAgents: no other "company" keys anywhere.
  const companyKeys = JSON.stringify(input).match(/"company":/g)?.length ?? 0;
  assert.equal(companyKeys, 1 + input.otherAgents.length, 'company label leaked through another field');
}

// (c) ground-truth events keep TRUE companies
let checked = 0;
for (const e of swapped.events) {
  if (e.actorId !== 'world') { assert.equal(e.actorCompany, truth[e.actorId]); checked++; }
  if (e.targetId && truth[e.targetId]) { assert.equal(e.targetCompany, truth[e.targetId]); checked++; }
}
assert.ok(checked > 100, 'events carried companies to check');

// Only the display changes: stub behavior (which ignores labels) yields the identical event stream.
const control = await play('true');
assert.deepEqual(swapped.events, control.events, 'swap must not change game mechanics');
for (const input of control.inputs) for (const peer of input.otherAgents) assert.equal(peer.company, truth[peer.id]);

// Defaults and legacy checkpoints
const legacy = createWorld({ runId: 'legacy', seed: 11, condition: 'LABELED', agentCount: 6 });
assert.ok(!('label_mode' in legacy) && !('monitoring' in legacy), 'default checkpoints carry no new keys');
assert.deepEqual(runLabelMapping('LABELED', 'swapped'), { A: 'B', B: 'C', C: 'A' });
assert.deepEqual(runLabelMapping('LABELED', legacy.label_mode), { A: 'A', B: 'B', C: 'C' });
assert.throws(() => createWorld({ runId: 'bad', seed: 1, condition: 'LABELED', label_mode: 'mixed' as never }));

// BLIND stays blind even if the setting is passed (the API rejects that combination).
const blind = await play('swapped', 'BLIND');
assert.ok(blind.inputs.every((i) => i.otherAgents.every((p) => !Object.hasOwn(p, 'company'))), 'BLIND omits company');

console.log(`PASS label mode: ${swapped.inputs.length} inputs, ${peerLabels} peer labels all rotated (none true), own company true, ${checked} event company fields true, mechanics identical to true-label control, BLIND unaffected, defaults unchanged`);
