// Transport-only Neon check. No database, credentials, or network calls.
import assert from 'node:assert/strict';
import { neon, neonConfig } from '@neondatabase/serverless';
import { createWorld, advancePhase } from '../src/engine/world';
import { resolvePhase } from '../src/engine/rules';
import type { Turns } from '../src/engine/types';
import { createRng, type Event } from '@simulization/shared';
import { projectCheckpoint } from '../src/world/neonProjection';
// E's module is typechecked by web's own tsconfig; load the real reader at runtime.
const readerPath = '../../../apps/web/src/mastra/db';
const {rowToEvent} = await import(readerPath) as {rowToEvent:(row:Record<string,unknown>)=>unknown};

let state=createWorld({runId:'project-projection',seed:42,condition:'LABELED',agentCount:6,epoch:0,product_project:'four-turn-v1',label_mode:'swapped',monitoring:'unmonitored',wealth_visibility:'public'});
const events:Event[]=[];
while(state.status==='running'){
 const turns:Turns=state.phase==='act'?{
  'merchant-01':{private_plan:'private',actions:[{type:'improve' as const,goodId:'good-1-1'}],memory_update:''},
  'merchant-02':{private_plan:'private',actions:state.round%2?[{type:'improve' as const,goodId:'good-2-1'}]:[{type:'pass' as const}],memory_update:''},
 }:{};
 const result=resolvePhase(state,turns,createRng(42));events.push(...result.events);state=advancePhase(result.state);
}
const result={state,events};
for(const type of ['product_progress','product_reset','product_complete'])assert.ok(events.some(e=>e.type===type));
const checkpoint = {...result, committedKeys: []};
const originalFetch = neonConfig.fetchFunction;
const requests: {queries:{query:string;params:string[]}[]}[] = [];
let fail = false;
neonConfig.fetchFunction = async (_url:unknown, options:RequestInit) => {
  assert.ok(options.signal instanceof AbortSignal, 'projection request needs a bounded abort signal');
  requests.push(JSON.parse(String(options.body)));
  if (fail) throw new Error('simulated uncertain transport failure');
  return Response.json({results:Array.from({length:3},()=>({fields:[],rows:[]}))});
};
try {
  // This deliberately invalid-domain DSN is passed only to the intercepted transport.
  const sql = neon('postgresql://fixture:fixture@example.invalid/fixture');
  await projectCheckpoint(checkpoint,'deterministic-stub',sql);
  assert.equal(requests.length,1,'one snapshot must be one transaction request');
  const queries=requests[0]!.queries;
  assert.equal(queries.length,3);
  assert.match(queries[0]!.query,/INSERT INTO runs/);
  assert.match(queries[0]!.query,/projectedSeq/);
  assert.ok(queries[0]!.params.includes('done'));
  const metadata=queries[0]!.params.map(p=>{try{return JSON.parse(p);}catch{return null;}}).find(p=>p?.projectedSeq===result.events.length);
  assert.equal(metadata.wealth_visibility,'public');
  assert.equal(metadata.product_project,'four-turn-v1');
  assert.equal(metadata.label_mode,'swapped');
  assert.equal(metadata.monitoring,'unmonitored');
  const agents=JSON.parse(queries[1]!.params[0]!);
  assert.equal(agents.length,6);
  assert.ok(agents.every((a:Record<string,unknown>)=>a.provider && a.model && !('state' in a)));
  const rows=JSON.parse(queries[2]!.params[0]!);
  assert.deepEqual(JSON.parse(JSON.stringify(rows.map(rowToEvent))),result.events,'E must read the exact projected JSON event contract');
  assert.match(queries[2]!.query,/ON CONFLICT \(id\) DO NOTHING/);
  await projectCheckpoint(checkpoint,'deterministic-stub',sql);
  assert.deepEqual(requests[1],requests[0],'retry must use the same event IDs and payload');
  fail=true;
  await assert.rejects(projectCheckpoint(checkpoint,'deterministic-stub',sql),/simulated uncertain/);
  fail=false;
  await projectCheckpoint(checkpoint,'deterministic-stub',sql);
  assert.deepEqual(requests[3],requests[0]);
  await projectCheckpoint({...checkpoint,state:{...checkpoint.state,wealth_visibility:'public'}},'deterministic-stub',sql);
  assert.ok(requests.at(-1)!.queries[0]!.params.some(p=>p.includes('\"wealth_visibility\":\"public\"')),'public policy persisted');
  const count=requests.length;
  await assert.rejects(projectCheckpoint({...checkpoint,state:{...checkpoint.state,seq:0}},'deterministic-stub',sql),/sequence mismatch/);
  await assert.rejects(projectCheckpoint({...checkpoint,events:[...checkpoint.events].reverse()},'deterministic-stub',sql),/contiguous/);
  assert.equal(requests.length,count,'invalid checkpoints must not reach the database');
  const projectRow=rows.find((r:any)=>r.type==='product_complete');
  assert.throws(()=>rowToEvent({...projectRow,ground_truth:{__productProjectV1:{...projectRow.ground_truth.__productProjectV1,version:'future'},groundTruth:{trueQuality:8}}}));
  assert.throws(()=>rowToEvent({...projectRow,ground_truth:{__productProjectV1:{...projectRow.ground_truth.__productProjectV1,turns:5}}}));
  assert.throws(()=>rowToEvent({...projectRow,ground_truth:{__productProjectV1:projectRow.ground_truth.__productProjectV1,groundTruth:{trueQuality:11}}}));
  console.log(`PASS mocked Neon transport: one transaction, ${rows.length} events round-trip through E's reader, stable retries, transport failure propagates, malformed checkpoints rejected. Real SQL/Neon execution NOT VERIFIED.`);
} finally {
  neonConfig.fetchFunction=originalFetch;
}
