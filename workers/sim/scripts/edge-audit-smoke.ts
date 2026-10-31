import assert from 'node:assert/strict';
import { CATCH_CHANCE, LANTERN_BONUS, LANTERN_GOAL, ROUNDS, createRng, type Action, type AgentTurnOutput, type Rng } from '@simulization/shared';
import { resolvePhase } from '../src/engine/rules';
import { advancePhase, buildTurnInput, createWorld } from '../src/engine/world';
import type { WorldState } from '../src/engine/types';

const fresh = () => createWorld({runId:'edge-audit',seed:42,condition:'BLIND',agentCount:6});
const [a,b,c] = Object.keys(fresh().agents) as [string,string,string];
const turn = (...actions: Action[]): AgentTurnOutput => ({actions,private_plan:'audit-private-plan',memory_update:'audit-memory'});
const fixed = (next:number):Rng => ({...createRng(1),next:()=>next});
const money = (s:WorldState) => Object.values(s.agents).reduce((n,m)=>n+m.coins,s.lanternFund);
let checks = 0;
function check(name:string,run:()=>void) {run();checks++;console.log(`PASS ${name}`);}

check('coalition leave revokes channel access; empty coalitions disappear',()=>{
 let s=resolvePhase(fresh(),{[a]:turn({type:'coalition_create',name:'edge'})},fixed(1)).state;
 const id=s.coalitions[0]!.id;
 s=resolvePhase(s,{[b]:turn({type:'coalition_join',coalitionId:id})},fixed(1)).state;
 s=resolvePhase(s,{[b]:turn({type:'coalition_leave'})},fixed(1)).state;
 const r=resolvePhase(s,{[b]:turn({type:'message',channel:id,text:'unauthorized'})},fixed(1));
 assert.deepEqual(r.state.agents,s.agents);
 assert.ok(!r.events.some(e=>e.type==='message'));
 s=resolvePhase(s,{[a]:turn({type:'coalition_leave'})},fixed(1)).state;
 assert.equal(s.coalitions.length,0);assert.equal(s.agents[a]!.coalitionId,null);
});

check('unsolicited pact acceptance rejected; crossed proposals become one reciprocal pact',()=>{
 let s=fresh();
 assert.deepEqual(resolvePhase(s,{[a]:turn({type:'pact_accept',targetId:b})},fixed(1)).state.agents,s.agents);
 s=resolvePhase(s,{[a]:turn({type:'pact_propose',targetId:b}),[b]:turn({type:'pact_propose',targetId:a})},fixed(1)).state;
 s=resolvePhase(s,{[b]:turn({type:'pact_accept',targetId:a})},fixed(1)).state;
 assert.deepEqual(s.agents[a]!.pacts,[b]);assert.deepEqual(s.agents[b]!.pacts,[a]);assert.deepEqual(s.proposals,[]);
 assert.deepEqual(resolvePhase(s,{[a]:turn({type:'pact_accept',targetId:b})},fixed(1)).state.agents,s.agents);
});

check('uncaught pact theft keeps membership and hides thief identity from victim input',()=>{
 let s=fresh();s.agents[a]!.pacts=[b];s.agents[b]!.pacts=[a];s.phase='act';
 const theft=resolvePhase(s,{[a]:turn({type:'steal',targetId:b})},fixed(1));
 assert.equal(money(theft.state),money(s));
 assert.ok(theft.events.find(e=>e.type==='steal')!.flags.includes('broken_pact'));
 s=theft.state;s.phase='reveal';s=resolvePhase(s,{},fixed(1)).state;
 assert.deepEqual(s.agents[b]!.pacts,[a]);
 const input=buildTurnInput(s,b);
 assert.ok(input.inbox.some(m=>m.text.includes('thief was not caught')));
 assert.ok(input.inbox.every(m=>!m.text.includes(a)));
 assert.ok(!JSON.stringify(input).includes('audit-private-plan'));
});

check('catch threshold is strict and zero-coin victims never mint money',()=>{
 let s=fresh();s.phase='act';s.agents[b]!.coins=0;
 s=resolvePhase(s,{[a]:turn({type:'steal',targetId:b})},fixed(1)).state;
 assert.equal(s.thefts[0]!.amount,0);assert.equal(s.agents[a]!.coins,fresh().agents[a]!.coins);
 s.phase='reveal';
 assert.ok(!resolvePhase(s,{},fixed(CATCH_CHANCE)).events.some(e=>e.type==='caught'));
 assert.ok(resolvePhase(s,{},fixed(CATCH_CHANCE-Number.EPSILON)).events.some(e=>e.type==='caught'));
});

check('free trades conserve money, decline isolates one offer, response-window expiry clears offers',()=>{
 let s=fresh();s.phase='trade';s.tradeStep='offers';const [g1,g2]=s.agents[a]!.inventory;
 s=resolvePhase(s,{[a]:turn(...[g1!,g2!].map(g=>({type:'trade_offer' as const,targetId:b,goodId:g.goodId,claimedQuality:g.trueQuality,price:0})))},fixed(1)).state;
 s.tradeStep='responses';const [o1,o2]=s.offers;
 const rejected=resolvePhase(s,{[c]:turn({type:'trade_accept',offerId:o1!.offerId})},fixed(1));
 assert.deepEqual(rejected.state.agents,s.agents);assert.deepEqual(rejected.state.offers,s.offers);
 const total=money(s);
 s=resolvePhase(s,{[b]:turn({type:'trade_decline',offerId:o1!.offerId},{type:'trade_accept',offerId:o2!.offerId})},fixed(1)).state;
 assert.equal(money(s),total);assert.ok(s.agents[a]!.inventory.some(g=>g.goodId===g1!.goodId));
 assert.ok(s.agents[b]!.inventory.some(g=>g.goodId===g2!.goodId));assert.equal(s.offers.length,0);
 const pending=fresh();pending.phase='trade';pending.tradeStep='responses';pending.offers=[o1!];
 assert.deepEqual(advancePhase(pending).offers,[]);
});

check('raw public observations expose coins only; offered quality remains a claim',()=>{
 let s=fresh();s.wealth_visibility='public';s.phase='trade';s.tradeStep='offers';
 const good=s.agents[a]!.inventory[0]!;
 s=resolvePhase(s,{[a]:turn({type:'trade_offer',targetId:b,goodId:good.goodId,claimedQuality:10,price:2})},fixed(1)).state;
 const input=buildTurnInput(s,b);
 assert.ok(input.otherAgents.every(peer=>Object.keys(peer).sort().join(',')==='coins,id,name'));
 assert.deepEqual(Object.keys(input.openOffers[0]!).sort(),['claimedQuality','fromId','goodId','offerId','price']);
 assert.equal(input.openOffers[0]!.claimedQuality,10);
 assert.equal(buildTurnInput(s,c).openOffers.length,0);
 input.otherAgents[0]!.coins=999;assert.notEqual(s.agents[input.otherAgents[0]!.id]!.coins,999);
});

check('final scoring uses true held quality; lantern threshold exact and final-round-only',()=>{
 const s=fresh();s.phase='reveal';s.round=ROUNDS;s.lanternFund=LANTERN_GOAL;
 const r=resolvePhase(s,{},fixed(1));
 for(const merchant of Object.values(s.agents)) {
  assert.equal(r.state.finalScores![merchant.id],merchant.coins+LANTERN_BONUS+merchant.inventory.reduce((n,g)=>n+g.trueQuality,0));
 }
 const low=structuredClone(s);low.lanternFund--;
 assert.equal(resolvePhase(low,{},fixed(1)).state.finalScores![a],r.state.finalScores![a]!-LANTERN_BONUS);
 const early=structuredClone(s);early.round--;
 const e=resolvePhase(early,{},fixed(1));assert.equal(e.state.finalScores,undefined);assert.equal(money(e.state),money(early));
});
console.log(`PASS ${checks} independent engine edge checks; no model/Relay/database calls`);
