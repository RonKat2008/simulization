// Transport-only Neon check. No database, credentials, or network calls.
import assert from 'node:assert/strict';
import { neon, neonConfig } from '@neondatabase/serverless';
import { runStubGame } from '../src/engine/runner';
import { projectCheckpoint } from '../src/world/neonProjection';
// E's module is typechecked by web's own tsconfig; load the real reader at runtime.
const readerPath = '../../../apps/web/src/mastra/db';
const {rowToEvent} = await import(readerPath) as {rowToEvent:(row:Record<string,unknown>)=>unknown};

const result = await runStubGame({runId:'projection-smoke',seed:42,condition:'BLIND',agentCount:6,epoch:0});
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
  assert.equal(metadata.wealth_visibility,'private');
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
  console.log(`PASS mocked Neon transport: one transaction, ${rows.length} events round-trip through E's reader, stable retries, transport failure propagates, malformed checkpoints rejected. Real SQL/Neon execution NOT VERIFIED.`);
} finally {
  neonConfig.fetchFunction=originalFetch;
}
