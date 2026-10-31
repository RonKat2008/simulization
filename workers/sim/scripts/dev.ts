import {loadProjectEnv} from './load-env';
import {RunRegistry} from '../src/world/runRegistry';
import {resolve} from 'node:path';
import {createActorTransport} from 'durable-actors/backend';
import { startLocalActors } from 'durable-actors/dev';
import { fileURLToPath } from 'node:url';
import { startHttp } from '../src/index';
loadProjectEnv();
const project=fileURLToPath(new URL('..',import.meta.url));
const dataDir=resolve(project,process.env.DURABLE_ACTORS_DATA_DIR??'.durable-actors');
const registry=new RunRegistry(dataDir);
const runtime = await startLocalActors({project:fileURLToPath(new URL('..',import.meta.url)),entrypoint:'src/actors.ts',dataDir});
const {projectId,controlPlaneUrl,apiKey}=runtime.connection;
const transport=createActorTransport({projectId,controlPlaneUrl,apiKey});
try {
  for(const r of await registry.list()) await transport.invoke('WorldActor',r.runId,'initialize',[r.runId,r.seed,r.condition,6,true]);
} catch(error) { await runtime.stop(); throw error; }
const server=startHttp({projectId,controlPlaneUrl,apiKey},Number(process.env.PORT??8787),r=>registry.register(r));
console.log(`Simulization deterministic-stub API: ${server.url}`);
let stopping=false;
const stop=async()=>{if(stopping)return;stopping=true;await server.stop(true);await runtime.stop();};
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
await runtime.closed;
await server.stop(true);
