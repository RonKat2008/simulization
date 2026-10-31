// Report data integration only: no database/network/model calls.
import assert from 'node:assert/strict';
import {computeRunMetrics} from '@simulization/shared';
const modulePath='../../../apps/web/src/components/report/data';
const {assembleNeonReport,selectReportRuns,loadReportData}=await import(modulePath);
const metrics=computeRunMetrics([],[]);metrics.evalAwareness.total=123;
const runs=[];
for(const mode of ['deterministic-stub','live-model-relay'])
 for(const wealth_visibility of ['private','public'])
  for(const condition of ['LABELED','BLIND'])runs.push({id:`${mode}-${wealth_visibility}-${condition}`,condition,status:'done',config:{mode,wealth_visibility},agents:[],events:[],finalScores:{},storedMetrics:metrics});
const target=runs.at(-1)!;
const review={summary:'Persisted actual review',claims:[],limitations:['Single run']};
const source={runs,reviews:new Map([[target.id,review]])};
const single=assembleNeonReport(source,{runId:target.id});
assert.equal(single.source,'neon');assert.equal(single.state,'ready');assert.equal(single.review.summary,review.summary);
assert.equal(single.conditions.BLIND.runs,1);assert.equal(single.conditions.LABELED,undefined);
assert.equal(single.conditions.BLIND.mean.evalAwareness.total,123,'persisted metrics must be used');
assert.deepEqual(single.selection,{runId:target.id,wealthVisibility:'public',mode:'live-model-relay'});
for(const mode of ['deterministic-stub','live-model-relay'])for(const wealthVisibility of ['private','public']){
 const selected:any[]=selectReportRuns(runs,{mode,wealthVisibility});assert.equal(selected.length,2);
 assert.ok(selected.every((r:any)=>r.config.mode===mode&&r.config.wealth_visibility===wealthVisibility));
}
assert.equal(selectReportRuns(runs,{}).length,2);
// Main's group selector and integration's per-run URL must coexist without pooling.
const grouped=assembleNeonReport(source,{group:'live-model-relay/public'});
assert.equal(grouped.conditions.LABELED.runs,1);
assert.equal(grouped.conditions.BLIND.runs,1);
assert.equal(grouped.group.key,'live-model-relay/public');
assert.equal(assembleNeonReport(source,{group:'missing/group'}).state,'empty');
const precedence=assembleNeonReport(source,{runId:target.id,group:'deterministic-stub/private'});
assert.deepEqual(precedence.selection,single.selection);
assert.equal(precedence.conditions.BLIND.mean.evalAwareness.total,123);
assert.ok(precedence.conditions.BLIND.cooperation,'new metrics coexist with older persisted metrics');
assert.equal(assembleNeonReport(source,{runId:'missing'}).state,'empty');
for(const [status,expected] of [['running','pending'],['failed','failed']]){
 const data=assembleNeonReport({runs:[{...target,status}],reviews:new Map()},{runId:target.id});
 assert.equal(data.state,expected);assert.equal(data.source,'neon');assert.deepEqual(data.conditions,{});
}
const pending=assembleNeonReport({runs:[target],reviews:new Map()},{runId:target.id});
assert.equal(pending.pendingReview,true);assert.equal(pending.review.claims.length,0);assert.equal(pending.review.isSample,false);
const saved=process.env.DATABASE_URL;delete process.env.DATABASE_URL;
try{assert.equal((await loadReportData()).state,'error');assert.equal((await loadReportData({mock:true})).source,'mock');}
finally{if(saved!==undefined)process.env.DATABASE_URL=saved;}
console.log('PASS report UI contract: persisted single-run metrics/review, four isolated visibility/mode groups with separate conditions, pending/failed/empty/unconfigured states, explicit fixtures only');
