import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const dataDir=await mkdtemp(tmpdir()+'/sim-recovery-');
let child:ReturnType<typeof Bun.spawn>|undefined;
async function start():Promise<string>{
 child=Bun.spawn([process.execPath,'scripts/dev.ts'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,PORT:'0',DURABLE_ACTORS_DATA_DIR:dataDir},stdout:'pipe',stderr:'inherit'});
 const reader=(child.stdout as ReadableStream<Uint8Array>).getReader();let text='';
 try {while(true){const r=await reader.read();if(r.done)throw new Error('bootstrap failed');text+=new TextDecoder().decode(r.value);const url=text.match(/Simulization deterministic-stub API: (http:\/\/[^\s]+)/)?.[1];if(url)return url;}}
 finally{reader.releaseLock();}
}
async function stop(){child?.kill('SIGTERM');await child?.exited;child=undefined;}
try {
 let base=await start();
 const r=await fetch(new URL('/runs',base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({condition:'BLIND',seed:42})});
 assert.ok(r.ok);const {runId}=await r.json() as {runId:string};
 const stoppedResponse=await fetch(new URL('/runs',base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({condition:'BLIND',seed:7})});
 const stoppedRun=await stoppedResponse.json() as {runId:string};
 await fetch(new URL(`/runs/${stoppedRun.runId}/stop`,base),{method:'POST'});
 const stoppedBefore=await (await fetch(new URL(`/runs/${stoppedRun.runId}/events`,base))).json();
 await stop();base=await start();
 // No status calls, sockets, polling, or manual phase requests after restart.
 await new Promise(resolve=>setTimeout(resolve,16000));
 const events=await (await fetch(new URL(`/runs/${runId}/events`,base))).json() as {round:number;phase:string;seq:number}[];
 assert.ok(events.some(e=>e.round===1&&e.phase==='reveal'),'unattended round did not complete');
 events.forEach((e,i)=>assert.equal(e.seq,i+1));
 assert.deepEqual(await (await fetch(new URL(`/runs/${stoppedRun.runId}/events`,base))).json(),stoppedBefore,'bootstrap resumed stopped run');
 console.log(`PASS unattended product bootstrap restart: ${events.length} ordered events; complete round without status/polling`);
}finally{await stop();await rm(dataDir,{recursive:true,force:true});}
