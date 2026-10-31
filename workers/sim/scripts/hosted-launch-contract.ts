import assert from 'node:assert/strict';
import { canStartRuns, LOCAL_DEMO_MESSAGE } from '../../../apps/web/src/lib/run-availability';
// Load Next entrypoints at runtime, as in report-ui-contract.ts. Their source is
// typechecked by the web project; importing it statically applies sim-only flags
// to unrelated Next/database code. These tests still invoke the actual handlers.
const runRoutePath = '../../../apps/web/src/app/api/runs/route';
const batchRoutePath = '../../../apps/web/src/app/api/batch/route';
type StartRoute = { POST: (request: Request) => Promise<Response> };
const { POST: start } = await import(runRoutePath) as StartRoute;
const { POST: batch } = await import(batchRoutePath) as StartRoute;
assert.equal(canStartRuns({}), true);
assert.equal(canStartRuns({VERCEL:'1'}), false);
const old=process.env.VERCEL;
try {
  process.env.VERCEL='1';
  // No request body, actor transport or credentials may be touched on hosted starts.
  const req={json(){throw new Error('Hosted gate read body');}} as unknown as Request;
  for(const route of [start,batch]){
    const response=await route(req);
    assert.equal(response.status,503);
    assert.deepEqual(await response.json(),{error:LOCAL_DEMO_MESSAGE,code:'LOCAL_DEMO_ONLY',replayUrl:'/run/featured'});
  }
  delete process.env.VERCEL;
  // Local validation still executes; an invalid request cannot create a run.
  assert.equal((await start(new Request('http://localhost/api/runs',{method:'POST',body:'{}'}))).status,400);
} finally {if(old===undefined)delete process.env.VERCEL;else process.env.VERCEL=old;}
console.log('PASS hosted single/batch launch blocked before body/transport; local validation enabled');
