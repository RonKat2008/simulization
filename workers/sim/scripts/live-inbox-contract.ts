// Credential-free regression gate for B's live inbox merge. A owns this test, not B's implementation.
import assert from 'node:assert/strict';
import {createRng,type AgentState} from '@simulization/shared';
import {withRelayInbox} from '../../../packages/agents/src/relayInbox';
import type {RunRelay} from '../../../packages/agents/src/runRelay';
import {createWorld,buildTurnInput} from '../src/engine/world';
import {resolvePhase} from '../src/engine/rules';
const world=createWorld({runId:'inbox-contract',seed:42,condition:'BLIND',agentCount:6});
const [sender,recipient]=Object.keys(world.agents) as [string,string];
const merchant=world.agents[recipient]!;
const state={name:merchant.name,company:merchant.company,provider:'anthropic',model:'test',memory:'',inboxCursor:null,relayToken:'fixture-only'} as AgentState;
// A healthy Relay can return no messages. This must not erase trusted World notices.
const relay={pullInbox:async()=>({inbox:[],inboxCursor:'fixture-cursor'})} as unknown as RunRelay;
const stolen=structuredClone(world);stolen.phase='act';
const act=resolvePhase(stolen,{[sender]:{actions:[{type:'steal',targetId:recipient}],private_plan:'',memory_update:''}},createRng(1));
act.state.phase='reveal';
const revealed=resolvePhase(act.state,{},createRng(1)).state;
const input=buildTurnInput(revealed,recipient);
const expected=input.inbox.find(m=>m.from==='world')!;
assert.ok(expected,'fixture must generate an authoritative theft notice');
assert.equal(expected.channel,'referee','engine must tag trusted notice provenance');
const merged=await withRelayInbox(relay,world.runId,recipient,state,input);
assert.ok(merged.input.inbox.some(m=>m.from===expected.from&&m.text.replace(/^\[referee notice\] /,'')===expected.text),
 'healthy Relay pull erased authoritative World theft notification');
assert.equal(merged.state.inboxCursor,'fixture-cursor');
const proposed=resolvePhase(world,{[sender]:{actions:[{type:'pact_propose',targetId:recipient}],private_plan:'',memory_update:''}},createRng(1)).state;
const pactInput=buildTurnInput(proposed,recipient);
assert.ok(pactInput.inbox.some(m=>m.from===sender&&m.channel==='referee'),'engine must tag pact proposal provenance');
const pact=await withRelayInbox(relay,world.runId,recipient,state,pactInput);
assert.ok(pact.input.inbox.some(m=>m.from===sender&&m.text.includes('I propose a pact')),'pact proposer notice erased');
assert.ok(pact.input.legalActions.includes('pact_accept'));
console.log('PASS live inbox contract: trusted World notification survives successful Relay retrieval; no paid calls');
