// Credential-free contracts for UI event draining and launch metadata/retry identity.
import assert from 'node:assert/strict';
import {contiguousCursor,terminalDrained} from '../../../apps/web/src/components/run/event-progress';
import {startRun} from '../../../apps/web/src/components/launch/start-run';
import {useEventStore} from '../../../apps/web/src/store/eventStore';
import {DEFAULT_WEALTH_VISIBILITY} from '../../../apps/web/src/components/launch/schemas';
assert.equal(DEFAULT_WEALTH_VISIBILITY,'private');
useEventStore.getState().reset('previous-run');
useEventStore.getState().select('previous-agent');
useEventStore.getState().setQuery('previous-filter');
useEventStore.getState().reset('next-run');
assert.equal(useEventStore.getState().runId,'next-run');
assert.equal(useEventStore.getState().selectedAgentId,null);
assert.equal(useEventStore.getState().query,'');
assert.deepEqual(useEventStore.getState().events,[]);
let events=[{seq:1},{seq:2}];
assert.equal(terminalDrained({status:'done',seq:4},events),false,'status can lead events');
events.push({seq:4});
assert.equal(contiguousCursor(events),2,'gap cannot advance cursor');
assert.equal(terminalDrained({status:'done',seq:4},events),false);
events.splice(2,0,{seq:3});
assert.equal(terminalDrained({status:'done',seq:4},events),true);
assert.equal(terminalDrained({status:'failed',seq:5},events),false,'failed runs still drain');
assert.equal(terminalDrained({status:'done'},events),false,'missing seq is not completion proof');
assert.equal(terminalDrained({status:'running',seq:4},events),false);
assert.equal(terminalDrained({status:'done',seq:0},[]),true);
const original=globalThis.fetch;
const calls:RequestInit[]=[];
try{
 globalThis.fetch=(async(_url:unknown,init?:RequestInit)=>{calls.push(init!);return Response.json({runId:'contract-run'});}) as typeof fetch;
 const body={condition:'LABELED' as const,seed:42,wealth_visibility:'public' as const};
 for(let i=0;i<2;i++)assert.deepEqual(await startRun(body,'stable-retry'),{ok:true,runId:'contract-run'});
 assert.ok(calls.every(c=>JSON.parse(String(c.body)).wealth_visibility==='public'));
 assert.ok(calls.every(c=>new Headers(c.headers).get('Idempotency-Key')==='stable-retry'));
 globalThis.fetch=(async()=>Response.json({error:'Unavailable'},{status:503})) as unknown as typeof fetch;
 assert.equal((await startRun(body,'stable-retry')).ok,false,'failure must not claim a launched run');
}finally{globalThis.fetch=original;}
console.log('PASS viewer contract: delayed/gapped terminal events drain, public launch payload and stable retry header, failure surfaced; no paid calls');
