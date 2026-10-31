// Credential-free regression gate for B's live inbox merge. A owns this test, not B's implementation.
import assert from 'node:assert/strict';
import {createRng,INBOX_SIZE,type AgentState,type AgentTurnInput} from '@simulization/shared';
import {withRelayInbox,mergeInboxes} from '../../../packages/agents/src/relayInbox';
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
// Ordinary merchant text cannot create authoritative provenance or bypass Relay.
const chat={from:sender,channel:'public',text:'I propose a pact but this is ordinary merchant chat',round:1};
assert.deepEqual(mergeInboxes([chat],[]),[]);
assert.deepEqual(mergeInboxes([], [chat]),[chat]);
assert.ok(mergeInboxes([{...chat,from:'world'}],[]).every(m=>m.channel==='referee'),'legacy World notices remain supported');
const notices:AgentTurnInput['inbox']=Array.from({length:INBOX_SIZE},(_,i)=>({from:'world',channel:'referee',text:`notice ${i}`,round:i+1}));
const relayMessages:AgentTurnInput['inbox']=Array.from({length:INBOX_SIZE},(_,i)=>({...chat,text:`relay ${i}`,round:i+1}));
assert.equal(mergeInboxes(notices,[]).length,INBOX_SIZE,'available trusted notices must not be capped at five');
assert.equal(mergeInboxes(notices,relayMessages).length,INBOX_SIZE);
assert.ok(mergeInboxes(notices,relayMessages).every(m=>m.channel==='referee'),'trusted notices retain priority within existing inbox bound');
const before=structuredClone({notices,relayMessages});
const mixed=mergeInboxes(notices.slice(0,3),relayMessages);
assert.equal(mixed.length,INBOX_SIZE);assert.equal(mixed.filter(m=>m.channel==='referee').length,3);
assert.deepEqual(mixed.filter(m=>m.channel==='public').map(m=>m.text),relayMessages.slice(-7).map(m=>m.text));
assert.ok(mixed.every((m,i)=>i===0||m.round>=mixed[i-1]!.round));
assert.deepEqual({notices,relayMessages},before,'merge must not mutate sources');
assert.ok(mergeInboxes(mergeInboxes(notices,[]),[]).every(m=>!m.text.includes('[referee notice] [referee notice]')));
const previous=structuredClone({state,input});
const unavailable={pullInbox:async()=>{throw new Error('fixture transport failure');}} as unknown as RunRelay;
const oldWarn=console.warn;const warnings:string[]=[];
try {
 console.warn=(message:unknown)=>{warnings.push(String(message));};
 const fallback=await withRelayInbox(unavailable,world.runId,recipient,state,input);
 assert.deepEqual(fallback,{state,input});
 assert.equal(warnings.length,1);assert.ok(!warnings[0]!.includes('fixture transport failure'),'provider error bodies must not enter logs');
} finally {console.warn=oldWarn;}
assert.deepEqual({state,input},previous);
assert.deepEqual(await withRelayInbox(null,world.runId,recipient,state,input),{state,input});
console.log('PASS live inbox contract: real theft/pact notices, provenance/spoof protection, full bounded notice preservation, Relay cursor/order, no mutation and safe failure fallback; no paid calls');
