// Offline integration: compile entrypoints with explicit in-memory module doubles.
// Never imports runtime/bootstrap or connects to actors, models, Relay or Neon.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {transformSync} = createRequire(require.resolve('tsx'))('esbuild');
import * as shared from '@simulization/shared';
import { createWorld, buildTurnInput } from '../src/engine/world';
import { takeTurn } from '../../../packages/agents/src/takeTurn';
import { RunPersistence } from '../src/world/persistence';

function isolated(path: string, mocks: Record<string, unknown>) {
  const filename = new URL(path, import.meta.url);
  const source = transformSync(readFileSync(filename, 'utf8'), {loader:'ts',target:'es2022',format:'cjs',tsconfigRaw:{compilerOptions:{experimentalDecorators:true}}}).code;
  const module = {exports:{} as any};
  new Function('require','module','exports',source)((name:string)=>{
    if (!(name in mocks)) throw new Error(`Unexpected dependency ${name}`);
    return mocks[name];
  },module,module.exports);
  return module.exports;
}
const calls: {actor:string; method:string;args:any[]}[]=[];
const transport={invoke:async(actor:string,_id:string,method:string,args:any[])=>{calls.push({actor,method,args});return '{}';}};
let storedConfig:Record<string,unknown>={};
const fakeSql=async(parts:TemplateStringsArray)=>parts.join('').includes('FROM agents')?[]:[{id:'historical',condition:'BLIND',status:'done',config:storedConfig}];
const api=isolated('../../../apps/web/src/app/api/runs/_service.ts',{
  'durable-actors/backend':{createActorTransport:()=>transport},'durable-actors/proxy':{},
  '@neondatabase/serverless':{neon:()=>fakeSql},'@simulization/shared':shared,'@/mastra/db':{},'./_report-status':{reportDeliveryStatus:async()=> 'not-requested'},
});
process.env.SIM_RUN_MODE='stub';
const settings={condition:'LABELED',seed:42,wealth_visibility:'public',label_mode:'swapped',monitoring:'unmonitored',product_project:'four-turn-v1'};
await api.createRun(settings,'runtime-contract');
assert.deepEqual(calls[1]!.args,['runtime-contract',42,'LABELED','stub',6,'public','swapped','unmonitored','four-turn-v1']);
assert.equal(calls[0]!.args[0].product_project,'four-turn-v1');
await api.createRun({condition:'BLIND',seed:1},'legacy');
assert.deepEqual(calls[3]!.args,['legacy',1,'BLIND','stub',6,'private','true','standard','off']);
assert.ok(!('product_project' in calls[2]!.args[0]));
for(const product_project of [null,true,'v2',0,{}])await assert.rejects(()=>api.createRun({...settings,product_project}),/product_project/);
await assert.rejects(()=>api.createRun({...settings,condition:'BLIND'}),/swapped/);
assert.equal(calls.length,4,'invalid API inputs do not touch transport');
process.env.DATABASE_URL='offline-fixture';
assert.equal((await api.runStatus('historical')).product_project,'off');
assert.equal((await api.listRuns())[0].product_project,'off');
storedConfig={product_project:'four-turn-v1',wealth_visibility:'public',label_mode:'swapped',monitoring:'unmonitored'};
assert.equal((await api.runStatus('historical')).product_project,'four-turn-v1');
assert.equal((await api.listRuns())[0].product_project,'four-turn-v1');
storedConfig={product_project:'future'};
await assert.rejects(()=>api.runStatus('historical'));
delete process.env.DATABASE_URL;
const sdk={Actor:class {},Persisted:()=>{}};
const {RunDirectory}=isolated('../../../actors/src/runDirectory.ts',{'durable-actors':sdk});
const directory=new RunDirectory();
await directory.register(calls[0]!.args[0]);
await directory.register(calls[0]!.args[0]);
assert.equal((await directory.list()).length,1);
await assert.rejects(()=>directory.register({...calls[0]!.args[0],product_project:'off'}),/conflict/);
await assert.rejects(()=>directory.register({...calls[0]!.args[0],product_project:'future'}),/Invalid/);
await directory.register(calls[2]!.args[0]);
await directory.register({...calls[2]!.args[0],product_project:'off'});
// Real checkpoint logic, in-memory storage; actor scheduler/transaction is a double.
let checkpoint:any=null;
const storage={get:async()=>checkpoint??undefined,put:async(_key:string,value:any)=>{checkpoint=structuredClone(value);}};
const {WorldActor}=isolated('../src/world/WorldActor.ts',{
  'durable-actors':sdk,'durable-actors/backend':{createActorTransport:()=>{throw Error('external access');}},
  '@simulization/shared':shared,'../engine/world':{createWorld},'../engine/runner':{},
  '../engine/types':{phaseKey:(s:any)=>`${s.round}:${s.phase}`},'./liveAdapter':{},
  './persistence':{RunPersistence,createTerseCheckpointStorage:()=>storage},'./neonProjection':{},
});
const world=new WorldActor();world.id='runtime-contract';world.db={transaction:async(fn:()=>unknown)=>fn()};
world.alarm={set:()=>{},get:()=>1,delete:()=>{}};
delete process.env.DATABASE_URL;
const status=JSON.parse(await world.startRun(...calls[1]!.args));
assert.equal(status.product_project,'four-turn-v1');
assert.equal(status.label_mode,'swapped');assert.equal(status.monitoring,'unmonitored');assert.equal(status.wealth_visibility,'public');
const before=structuredClone(checkpoint);
await world.startRun(...calls[1]!.args);
assert.deepEqual(checkpoint,before,'restart does not reinitialize state');
for(const [index,value] of [[8,'off'],[7,'standard'],[6,'true'],[5,'private']] as const){
  const args=[...calls[1]!.args];args[index]=value;await assert.rejects(()=>world.startRun(...args),/conflict/);
}
assert.deepEqual(checkpoint,before);
const bootstrap=readFileSync(new URL('./consolidated-dev.ts',import.meta.url),'utf8');
for(const setting of ['wealth_visibility','label_mode','monitoring','product_project'])assert.ok(bootstrap.includes(`run.${setting}??`));
// Capture the real turn pipeline request using a deterministic local fake (no model call).
for(const enabled of [false,true]){
 const state=createWorld({runId:'prompt',seed:1,condition:'BLIND',agentCount:6,...(enabled?{product_project:'four-turn-v1' as const}:{})});
 const a=state.agents['merchant-01']!;const company=shared.COMPANIES.find(c=>c.id===a.company)!;
 state.phase='act';
 const input=buildTurnInput(state,a.id);let captured:any;
 const outcome=await takeTurn({agentId:a.id,state:{name:a.name,company:a.company,provider:company.provider,model:company.model,memory:'',inboxCursor:null,monitoring:'unmonitored'},input,model:{complete:async(req)=>{captured=req;return {text:JSON.stringify({private_plan:'',actions:[enabled?{type:'improve',goodId:a.inventory[0]!.goodId}:{type:'pass'}],memory_update:''})};}}});
 assert.equal(outcome.output.actions[0]!.type,enabled?'improve':'pass');
 assert.equal(captured.system,shared.buildSystemPrompt(a.name,shared.RULES,{monitoring:'unmonitored',product_project:enabled?'four-turn-v1':'off'}));
 const enums=captured.jsonSchema.properties.actions.items.properties.type.enum;
 assert.equal(enums.includes('improve'),enabled);assert.ok(enums.every((s:string)=>!s.startsWith('product_')));
 assert.ok(input.otherAgents.every(a=>!('productProject' in a)));
}
console.log('PASS product runtime: API validation/defaults, registration, actor start/status/restart/conflicts, bootstrap settings, trusted prompt/output schema');
