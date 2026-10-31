// A integration check of E's actual pipeline with an injected reviewer; no paid requests.
import assert from 'node:assert/strict';
import {computeRunMetrics} from '@simulization/shared';
// E is checked under web's tsconfig; load its pipeline without rechecking it under sim's stricter options.
const pipelinePath='../../../apps/web/src/mastra/pipeline';
const {runSynthesis}=await import(pipelinePath);
const runs:{id:string;condition:string;seed:number;status:string;config:{wealth_visibility:string;mode:string};metrics:ReturnType<typeof computeRunMetrics>;review:object}[]=[];
for(const condition of ['BLIND','LABELED'] as const)
 for(const wealth_visibility of ['private','public'] as const)
  for(const mode of ['deterministic-stub','live-model-relay']){
   runs.push({id:`${condition}-${wealth_visibility}-${mode}`,condition,seed:42,status:'done',
    config:{wealth_visibility,mode},metrics:computeRunMetrics([],[]),
    review:{summary:'fixture',claims:[],limitations:[],droppedClaims:0,groupMap:{}}});
  }
let prompt='';let saved:unknown;
const result=await runSynthesis({loadRuns:async()=>runs,loadEventIds:async()=>[],
 synthesize:async (input:string)=>{prompt=input;return {summary:'fixture',claims:[],limitations:[]};},
 save:async (value:unknown)=>{saved=value;}});
assert.equal(Object.keys(result.aggregated).length,8);
for(const run of runs){
 const config=run.config as {wealth_visibility:string;mode:string};
 const stratum=result.aggregated[`${run.condition}/${config.wealth_visibility}/${config.mode}`]!;
 assert.ok(stratum);assert.equal(stratum.runs,1);assert.deepEqual(stratum.runIds,[run.id]);
 const line=prompt.split('Run reviews (JSON lines):\n')[1]!.split('\n').find(line=>line.includes(`"runId":"${run.id}"`));
 assert.ok(line);const record=JSON.parse(line);
 assert.equal(record.condition,run.condition);assert.equal(record.wealthVisibility,config.wealth_visibility);assert.equal(record.mode,config.mode);
}
assert.deepEqual(saved,result);
console.log('PASS synthesis contract: eight condition × visibility × mode strata, labeled reviewer inputs and saved result; injected reviewer, no paid calls');

const hierarchyPath='../../../apps/web/src/mastra/hierarchy';
const {wealthVisibilityOf}=await import(hierarchyPath);
assert.equal(wealthVisibilityOf({}),'private');
assert.equal(wealthVisibilityOf({wealth_visibility:'invalid'}),'unrecorded');
const {stratumKey,labelModeOf,monitoringOf}=await import(hierarchyPath);
assert.equal(labelModeOf({}),'true');assert.equal(monitoringOf({}),'standard');
assert.equal(labelModeOf({label_mode:'swapped'}),'swapped');assert.equal(monitoringOf({monitoring:'unmonitored'}),'unmonitored');
const stratum={condition:'LABELED',wealthVisibility:'private',mode:'live-model-relay'};
assert.equal(stratumKey(stratum),'LABELED/private/live-model-relay','legacy stratum keys unchanged');
assert.equal(stratumKey({...stratum,labelMode:'true',monitoring:'standard'}),stratumKey(stratum));
assert.notEqual(stratumKey({...stratum,labelMode:'swapped'}),stratumKey(stratum));
assert.notEqual(stratumKey({...stratum,monitoring:'unmonitored'}),stratumKey(stratum));
console.log('PASS strata: label_mode and monitoring separate strata; legacy configs read as defaults with unchanged keys');
