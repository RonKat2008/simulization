import assert from 'node:assert/strict';
import { ActionSchema, EventSchema, AgentTurnInputSchema, buildSystemPrompt, createRng, RULES, CATCH_CHANCE, type Action } from '@simulization/shared';
import { createWorld, buildTurnInput } from '../src/engine/world';
import { legalActions, resolvePhase } from '../src/engine/rules';
import type { WorldState, Turns } from '../src/engine/types';

const id = 'merchant-01', other = 'merchant-02', goodId = 'good-1-1';
const output = (actions: Action[]) => ({private_plan:'', actions, memory_update:''});
function world(quality = 2) {
  const s = createWorld({runId:'contract', seed:1, condition:'BLIND', agentCount:2, product_project:'four-turn-v1'});
  s.phase = 'act'; s.agents[id]!.inventory[0]!.trueQuality = quality; return s;
}
function act(s: WorldState, round: number, action: unknown = {type:'improve',goodId}) {
  const before = structuredClone(s); const input = structuredClone(s); input.round = round; input.phase = 'act';
  const r = resolvePhase(input, {[id]: action === null ? {} : output([action as Action]), [other]:output([{type:'pass'}])} as Turns, createRng(2));
  assert.deepEqual(s, before, 'pure resolver'); r.events.forEach(e => EventSchema.parse(e)); return r;
}
for (const start of [1,3]) for (const quality of [2,8,10]) {
  let s = world(quality);
  for(let r=start;r<start+4;r++) {
    const result=act(s,r); s=result.state;
    assert.equal(s.agents[id]!.inventory[0]!.trueQuality, r===start+3 ? Math.min(10,quality+6) : quality);
    assert.equal(result.events[0]!.type,r===start+3?'product_complete':'product_progress');
  }
  assert.equal(s.productProjects![id]!.completed,true);
  assert.equal(legalActions(s,id).includes('improve'),false);
  assert.equal(act(s,6).events[0]!.type,'pass');
}
for (const action of [{type:'work'}, {type:'pass'}, {type:'contribute'}, {type:'steal',targetId:other}, null]) {
  const s = act(world(),1).state; const r=act(s,2,action);
  assert.equal(r.events[0]!.type,'product_reset'); assert.equal(r.state.productProjects![id]!.progress,undefined);
  assert.equal(r.state.agents[id]!.inventory[0]!.trueQuality,2);
  assert.equal(act(r.state,3).state.productProjects![id]!.progress!.turns,1);
}
let s=act(world(),1).state;
const switched=act(s,2,{type:'improve',goodId:'good-1-2'});
assert.deepEqual(switched.events.slice(0,2).map(e=>e.type),['product_reset','product_progress']);
assert.equal(switched.state.productProjects![id]!.progress!.turns,1);
s=act(s,2).state; s=act(s,3).state;
assert.deepEqual(act(s,4,{type:'improve',goodId:'good-1-2'}).events.slice(0,2).map(e=>e.type),['product_reset','pass']);
assert.equal(act(world(),4).events[0]!.type,'pass');
assert.equal(act(act(world(),1).state,4).state.productProjects![id]!.progress,undefined);
s=act(world(),1).state; s.agents[id]!.skipActRound=2;
assert.equal(act(s,2).events[0]!.productProject!.reason,'forced_skip');
s=act(world(),1).state;
const empty=resolvePhase({...s,round:2},{[id]:output([])},createRng(1));
assert.equal(empty.events[0]!.type,'product_reset');
// Trade atomically cancels seller progress; a later return never resurrects it.
s.phase='trade';s.tradeStep='responses';s.round=2;
s.offers=[{offerId:'offer',fromId:id,targetId:other,goodId,claimedQuality:2,price:0}];
let trade=resolvePhase(s,{[id]:output([{type:'pass'}]),[other]:output([{type:'trade_accept',offerId:'offer'}])},createRng(1));
assert.deepEqual(trade.events.map(e=>e.type),['pass','product_reset','trade_accept']);
assert.equal(trade.state.productProjects![id]!.progress,undefined);
assert.equal(trade.state.productProjects![other]!.progress,undefined);
s=trade.state;s.offers=[{offerId:'return',fromId:other,targetId:id,goodId,claimedQuality:2,price:0}];
s=resolvePhase(s,{[id]:output([{type:'trade_accept',offerId:'return'}])},createRng(1)).state;
assert.equal(act(s,2).state.productProjects![id]!.progress!.turns,1);
// An invalid second response rolls back the first response and its cancellation.
s=act(world(),1).state;s.phase='trade';s.tradeStep='responses';
s.offers=[{offerId:'offer',fromId:id,targetId:other,goodId,claimedQuality:2,price:0}];
trade=resolvePhase(s,{[other]:output([{type:'trade_accept',offerId:'offer'},{type:'trade_accept',offerId:'missing'}])},createRng(1));
assert.equal(trade.state.productProjects![id]!.progress!.turns,1);
assert(trade.state.agents[id]!.inventory.some(g=>g.goodId===goodId));
// Self-only observation, all label/wealth modes.
for(const condition of ['LABELED','BLIND'] as const) for(const wealth_visibility of ['public','private'] as const) {
  s=act(world(),1).state;s.condition=condition;s.wealth_visibility=wealth_visibility;
  const self=AgentTurnInputSchema.parse(buildTurnInput(s,id));
  assert.equal(self.self.productProject!.progress!.goodId,goodId);
  const observer=buildTurnInput(s,other);
  assert(!JSON.stringify(observer).includes(goodId));
  assert(observer.otherAgents.every(a=>!('inventory' in a)&&!('productProject' in a)&&!('trueQuality' in a)));
}
const options={runId:'off',seed:1,condition:'BLIND' as const,agentCount:2};
const omitted=createWorld(options), off=createWorld({...options,product_project:'off'});
assert.deepEqual(off,omitted);assert(!('productProjects' in off));
assert.deepEqual(buildTurnInput(off,id),buildTurnInput(omitted,id));
assert.deepEqual(act(off,1,{type:'work'}),act(omitted,1,{type:'work'}));
assert.equal(buildSystemPrompt('Wick',RULES),buildSystemPrompt('Wick',RULES,{product_project:'off'}));
assert(!buildSystemPrompt('Wick',RULES).includes('improve'));
assert(buildSystemPrompt('Wick',RULES,{product_project:'four-turn-v1'}).includes('Four consecutive'));
ActionSchema.parse({type:'improve',goodId});
// Actual engine payoff checks: work and theft remain unchanged.
s=world();const coins=s.agents[id]!.coins;
assert.equal(act(s,1,{type:'work'}).state.agents[id]!.coins,coins+1);
s.agents[other]!.coins=2;
let theft=act(s,1,{type:'steal',targetId:other}).state;
assert.equal(theft.agents[id]!.coins,coins+2);assert.equal(theft.agents[other]!.coins,0);
theft.phase='reveal';
const caught=resolvePhase(theft,{}, {...createRng(1),next:()=>0}).state;
assert.equal(caught.agents[id]!.coins,coins+2-6);assert.equal(caught.agents[id]!.skipActRound,2);
assert.equal(resolvePhase(theft,{}, {...createRng(1),next:()=>CATCH_CHANCE}).events.some(e=>e.type==='caught'),false);
s=world();s.agents[id]!.coins=0;s.agents[other]!.coins=1;
theft=act(s,1,{type:'steal',targetId:other}).state;theft.phase='reveal';
assert.equal(resolvePhase(theft,{}, {...createRng(1),next:()=>0}).state.agents[id]!.coins,0);
s=world();for(let r=1;r<=4;r++)s=act(s,r).state;
s.round=6;s.phase='reveal';const final=resolvePhase(s,{},createRng(1)).state;
assert.equal(final.finalScores![id],s.agents[id]!.coins+s.agents[id]!.inventory.reduce((v,g)=>v+g.trueQuality,0));
console.log('product-project-contract: PASS');
