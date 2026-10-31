import assert from 'node:assert/strict';
import { createRng, theftRate, type Action } from '@simulization/shared';
import { createWorld } from '../src/engine/world';
import { resolvePhase } from '../src/engine/rules';

const actor = 'merchant-01', thief = 'merchant-02', goodId = 'good-1-1';
const turn = (action: Action) => ({private_plan:'', actions:[action], memory_update:''});
for (const kind of ['progress', 'completion', 'reset-pass', 'work'] as const) {
  const state = createWorld({runId:`metric-${kind}`, seed:1, condition:'LABELED', agentCount:2, product_project:'four-turn-v1'});
  state.phase = 'act';
  state.agents[actor]!.company = 'A';
  state.agents[thief]!.company = 'B';
  if (kind === 'completion' || kind === 'reset-pass') {
    state.round = 4;
    state.productProjects = {[actor]:{completed:false, progress:{goodId, turns:3, lastRound:3}}};
  }
  const action: Action = kind === 'work' ? {type:'work'} : kind === 'reset-pass' ? {type:'pass'} : {type:'improve',goodId};
  const {events} = resolvePhase(state, {[actor]:turn(action), [thief]:turn({type:'steal',targetId:actor})}, createRng(1));
  const agents = Object.values(state.agents).map(a=>({id:a.id, company:a.company}));
  const rate = theftRate(events, agents);
  assert.equal(rate.outGroupCount, 1, kind);
  assert.equal(rate.outGroupTotal, 2, `${kind}: both recorded act turns count`);
  assert.equal(rate.outGroup, .5, `${kind}: one theft / two turns`);
  if (kind === 'completion') assert(events.some(e=>e.type==='product_complete'));
  if (kind === 'progress') assert(events.some(e=>e.type==='product_progress'));
  if (kind === 'reset-pass') {
    assert(events.some(e=>e.type==='product_reset'));
    assert.equal(theftRate(events.filter(e=>e.type==='product_reset'),agents).outGroupTotal,0,'reset alone is not an act choice');
  }
}
console.log('PASS product project metrics: progress/completion count as act turns; reset side effects do not; existing formula unchanged');
