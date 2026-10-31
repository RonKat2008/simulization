import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {EventSchema} from '@simulization/shared';
const dir=await mkdtemp(tmpdir()+'/sim-http-');
const child=Bun.spawn([process.execPath,'scripts/dev.ts'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,PORT:'0',DURABLE_ACTORS_DATA_DIR:dir},stdout:'pipe',stderr:'inherit'});
let socket:WebSocket|undefined;
try {
  const reader=child.stdout.getReader();let output='';let base='';
  const timeout=setTimeout(()=>child.kill(),30000);
  try {while(!base){const {value,done}=await reader.read();if(done)throw new Error('bootstrap exited before API ready');output+=new TextDecoder().decode(value);base=output.match(/Simulization deterministic-stub API: (http:\/\/[^\s]+)/)?.[1]??'';}}
  finally{clearTimeout(timeout);reader.releaseLock();}
  const request=async(path:string,body?:unknown)=>{const r=await fetch(new URL(path,base),body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.ok(r.ok,await r.clone().text());return r.json() as Promise<any>;};
  const {runId}=await request('/runs',{condition:'BLIND',seed:42});
  assert.equal((await request(`/runs/${runId}`)).mode,'deterministic-stub');
  const firstEvent=new Promise<unknown>((resolve,reject)=>{
    socket=new WebSocket(new URL(`/runs/${runId}/ws`,base).toString().replace('http:','ws:'));
    const timer=setTimeout(()=>reject(new Error('No websocket event')),15000);
    socket.onmessage=e=>{try{const event=EventSchema.parse(JSON.parse(e.data));clearTimeout(timer);resolve(event);}catch(error){clearTimeout(timer);reject(error);}};
    socket.onerror=()=>{clearTimeout(timer);reject(new Error('Websocket failed'));};
  });
  await firstEvent;
  const deadline=Date.now()+20000;
  while((await request(`/runs/${runId}`)).round===1 && Date.now()<deadline) await new Promise(r=>setTimeout(r,300));
  assert.equal((await request(`/runs/${runId}`)).round,2);
  const events=await request(`/runs/${runId}/events?after=0`);
  assert.deepEqual([...new Set(events.filter((e:any)=>e.round===1).map((e:any)=>e.phase))],['negotiate','trade','act','reveal']);
  const stopped=await request(`/runs/${runId}/stop`,{});assert.equal(stopped.stopped,true);
  console.log(`PASS actual dev bootstrap: Terse runtime + HTTP create/status/events/stop + WebSocket, automatic complete round (${events.length} events)`);
}finally{socket?.close();child.kill('SIGTERM');await child.exited;await rm(dir,{recursive:true,force:true});}
