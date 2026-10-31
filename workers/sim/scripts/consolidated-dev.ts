import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {startLocalActors} from 'durable-actors/dev';
import {createActorTransport} from 'durable-actors/backend';
import {loadProjectEnv} from './load-env';
import type {Registration} from '../../../actors/src/runDirectory';

loadProjectEnv();
const project=fileURLToPath(new URL('../../../actors',import.meta.url));
const url=new URL(process.env.DURABLE_ACTORS_URL??'http://127.0.0.1:7100');
if (!['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Local actors require a loopback DURABLE_ACTORS_URL');
process.env.DURABLE_ACTORS_URL=url.origin;
process.env.DURABLE_ACTORS_PROJECT_ID??='local';
if (!process.env.DURABLE_ACTORS_SECRET) delete process.env.DURABLE_ACTORS_SECRET;
process.env.MERCHANT_ACTORS_URL=url.origin;
process.env.MERCHANT_PROJECT_ID=process.env.DURABLE_ACTORS_PROJECT_ID;
const vendor=Bun.spawn(['node','scripts/prepare-runtime.mjs'],{cwd:project,stdout:'inherit',stderr:'inherit'});
if (await vendor.exited!==0) throw new Error('Actor source preparation failed');
const runtime=await startLocalActors({quiet:true,project,entrypoint:'src/runtime.ts',port:Number(url.port||7100),projectId:process.env.DURABLE_ACTORS_PROJECT_ID,apiKey:process.env.DURABLE_ACTORS_SECRET||undefined,dataDir:resolve(project,process.env.DURABLE_ACTORS_DATA_DIR??'.durable-actors')});
try {
  const {controlPlaneUrl,projectId,apiKey}=runtime.connection;
  const transport=createActorTransport({controlPlaneUrl,projectId,apiKey});
  const runs=await transport.invoke('RunDirectory','main','list',[]) as Registration[];
  for(const run of runs) {
    try {await transport.invoke('WorldActor',run.runId,'startRun',[run.runId,run.seed,run.condition,run.mode,run.agentCount,run.wealth_visibility??'private']);}
    catch {console.warn(`Run ${run.runId} could not resume; other runs remain available`);}
  }
} catch(error) {await runtime.stop();throw error;}
console.log(`Consolidated Terse ready: ${runtime.connection.controlPlaneUrl} (WorldActor, MerchantAgent, RunDirectory, ExperimentRunner)`);
let stopping=false;
const stop=async()=>{if(stopping)return;stopping=true;await runtime.stop();};
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
await runtime.closed;
