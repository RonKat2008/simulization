// Real Neon transport with deterministic stub data. Deletes only this test's unique run afterward.
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {neon} from '@neondatabase/serverless';
import {loadProjectEnv} from './load-env';
import {projectCheckpoint} from '../src/world/neonProjection';
import {createWorld} from '../src/engine/world';
import {runStubGame} from '../src/engine/runner';
const readerPath='../../../apps/web/src/mastra/db.ts';
const {rowToEvent}=await import(readerPath);
loadProjectEnv();
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
const sql=neon(process.env.DATABASE_URL);
const options={runId:`track-a-projection-test-${crypto.randomUUID()}`,seed:42,condition:'BLIND' as const,wealth_visibility:'public' as const,agentCount:6,epoch:Date.now()};
try{
 const initial={state:createWorld(options),events:[],committedKeys:[]};
 const result=await runStubGame(options);
 const completed={...result,committedKeys:[]};
 await projectCheckpoint(initial,'deterministic-stub');
 await projectCheckpoint(completed,'deterministic-stub');
 await projectCheckpoint(completed,'deterministic-stub');
 await projectCheckpoint(initial,'deterministic-stub');
 const [runs,agents,events]=await sql.transaction([
  sql`SELECT status,config,final_scores FROM runs WHERE id=${options.runId}`,
  sql`SELECT agent_id FROM agents WHERE run_id=${options.runId}`,
  sql`SELECT * FROM events WHERE run_id=${options.runId} ORDER BY seq`,
 ]);
 assert.equal(runs![0]!.status,'done');assert.equal(runs![0]!.config.wealth_visibility,'public');assert.equal(runs![0]!.config.projectedSeq,result.events.length);
 assert.equal(agents!.length,6);assert.ok(isDeepStrictEqual(JSON.parse(JSON.stringify(events!.map(rowToEvent))),JSON.parse(JSON.stringify(result.events))),'Neon event JSON differs from committed events');
 assert.deepEqual(runs![0]!.final_scores,result.state.finalScores);
 console.log(`PASS real Neon projection with stub data: ${events!.length} exact events through E reader, six agents, final scores, duplicate and stale replay safe`);
}finally{await sql`DELETE FROM runs WHERE id=${options.runId}`;}
