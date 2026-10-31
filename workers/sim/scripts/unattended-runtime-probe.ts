import {startLocalActors} from 'durable-actors/dev';
import {createActorTransport} from 'durable-actors/backend';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const dataDir=await mkdtemp(tmpdir()+'/sim-unattended-');
const options={project:fileURLToPath(new URL('..',import.meta.url)),entrypoint:'src/actors.ts',dataDir,quiet:true};
let rt=await startLocalActors(options);
const connect=()=>createActorTransport({projectId:rt.connection.projectId,controlPlaneUrl:rt.connection.controlPlaneUrl,apiKey:rt.connection.apiKey});
try {
 await connect().invoke('WorldActor','unattended','initialize',['unattended',42,'BLIND',6,true]);
 await rt.stop();rt=await startLocalActors(options);
 // No RPC, status, socket, HTTP polling, or manual wake during this interval.
 await new Promise(resolve=>setTimeout(resolve,16000));
 // events() is read-only and does not re-arm alarms (unlike status()).
 const events=JSON.parse(await connect().invoke('WorldActor','unattended','events',[0]) as string) as {phase:string;round:number}[];
 const complete=events.some(e=>e.round===1&&e.phase==='reveal');
 console.log(`${complete?'PASS':'FAIL'} unattended product restart: ${events.length} events after 16s with no requests; complete round=${complete}`);
 if(!complete) process.exitCode=1;
}finally{await rt.stop();await rm(dataDir,{recursive:true,force:true});}
