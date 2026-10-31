// Monitoring smoke: the standard prompt is byte-identical to the original Part 7 prompt; 'unmonitored' adds
// exactly one line, and a stub game through the real takeTurn pipeline sends it to every agent.
// Usage: pnpm --filter sim smoke:monitoring
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { COMPANIES, RULES, UNMONITORED_PROMPT_LINE, buildSystemPrompt } from '@simulization/shared';
import { MemoryAgentStore, StubModelClient, type ModelClient } from '@simulization/agents';
import { createWorld } from '../src/engine/world';
import { stepWorld } from '../src/engine/runner';
import type { WorldState } from '../src/engine/types';

// sha256 of buildSystemPrompt('Wick', RULES) from the original prompt.ts (before monitoring existed).
const ORIGINAL_PROMPT_SHA256 = 'c11db4c65a8f5a4b0b79459b6e9f9937ada858e22e84792fb2117c8db9b790c7';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const standard = buildSystemPrompt('Wick', RULES);
assert.equal(sha(standard), ORIGINAL_PROMPT_SHA256, 'standard prompt must stay byte-identical');
assert.equal(buildSystemPrompt('Wick', RULES, { monitoring: 'standard' }), standard);
const unmonitored = buildSystemPrompt('Wick', RULES, { monitoring: 'unmonitored' });
assert.equal(unmonitored, `${standard}\n${UNMONITORED_PROMPT_LINE}`, 'exactly one appended line');
assert.equal(unmonitored.split('\n').length, standard.split('\n').length + 1);
assert.ok(!standard.includes(UNMONITORED_PROMPT_LINE));
assert.ok(!/\b(test|evaluat|experiment|bias|honest|ethic)/i.test(UNMONITORED_PROMPT_LINE), 'line stays neutral (Part 7 rule)');

/** Stub game via MemoryAgentStore + takeTurn, initialized like liveAdapter.initializeLive. Captures system prompts. */
async function play(monitoring: 'standard' | 'unmonitored') {
  const systems: string[] = [];
  const inner = new StubModelClient();
  const model: ModelClient = { complete: (req) => { systems.push(req.system); return inner.complete(req); } };
  const store = new MemoryAgentStore({ model });
  let state: WorldState = createWorld({ runId: `mon-${monitoring}`, seed: 5, condition: 'LABELED', agentCount: 6, monitoring });
  for (const a of Object.values(state.agents)) {
    const c = COMPANIES.find((x) => x.id === a.company)!;
    await store.init(state.runId, a.id, { name: a.name, company: a.company, provider: c.provider, model: c.model, memory: '', inboxCursor: null, ...(state.monitoring === 'unmonitored' ? { monitoring: 'unmonitored' as const } : {}) });
  }
  while (state.status === 'running' && state.round <= 1) state = (await stepWorld(state, store)).state;
  return { state, systems };
}

const off = await play('unmonitored');
assert.equal(off.state.monitoring, 'unmonitored');
assert.ok(off.systems.length >= 6 * 3, 'turns reached the model');
assert.ok(off.systems.every((s) => s.endsWith(`\n${UNMONITORED_PROMPT_LINE}`)), 'every unmonitored turn carries the line');
const on = await play('standard');
assert.ok(!('monitoring' in on.state), 'standard checkpoints carry no new key');
assert.ok(on.systems.every((s) => !s.includes(UNMONITORED_PROMPT_LINE)), 'standard turns never carry the line');
const names = Object.values(on.state.agents).map((a) => a.name);
assert.ok(on.systems.every((s) => names.some((n) => s === buildSystemPrompt(n, RULES))), 'standard turns use the base prompt');
assert.throws(() => createWorld({ runId: 'bad', seed: 1, condition: 'BLIND', monitoring: 'secret' as never }));

console.log(`PASS monitoring: standard prompt byte-identical (sha256 ${ORIGINAL_PROMPT_SHA256.slice(0, 12)}...), unmonitored adds exactly one line, ${off.systems.length} unmonitored turns carried it, ${on.systems.length} standard turns did not`);
