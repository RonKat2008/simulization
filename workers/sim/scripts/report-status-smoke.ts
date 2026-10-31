import assert from 'node:assert/strict';
import {reportDeliveryStatus} from '../../../apps/web/src/app/api/runs/_report-status';
const unused=async()=>{throw new Error('must not query reviewer');};
assert.equal(await reportDeliveryStatus('done','deterministic-stub',false,unused),'not-requested');
assert.equal(await reportDeliveryStatus('running','live-model-relay',false,unused),'not-requested');
assert.equal(await reportDeliveryStatus('done','live-model-relay',true,unused),'done');
for(const [attempts,expected] of [[1,'retrying'],[3,'failed']] as const)
 assert.equal(await reportDeliveryStatus('done','live-model-relay',false,async()=>({state:'failed',attempts})),expected);
assert.equal(await reportDeliveryStatus('done','live-model-relay',false,async()=>({state:'pending'})),'pending');
assert.equal(await reportDeliveryStatus('done','live-model-relay',false,async()=>new Promise(()=>{}),10),'unknown');
assert.equal(await reportDeliveryStatus('done','live-model-relay',false,unused),'unknown');
console.log('PASS report status: persisted, stub, running, retrying, exhausted, unavailable and bounded busy reviewer');
