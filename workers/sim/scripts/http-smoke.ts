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
  for (const cursor of ['-1','1.5','not-a-number']) {
    const response=await fetch(new URL(`/runs/${runId}/events?after=${cursor}`,base));
    assert.equal(response.status,400,'invalid event cursor must be rejected');
  }
  assert.equal((await fetch(new URL('/runs/missing-run/events',base))).status,404);
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
  events.forEach((event:unknown,index:number)=>{
    const parsed=EventSchema.parse(event);
    assert.equal(parsed.runId,runId);
    assert.equal(parsed.seq,index+1);
    assert.equal(parsed.id,`${runId}-${index+1}`);
  });
  assert.deepEqual([...new Set(events.filter((e:any)=>e.round===1).map((e:any)=>e.phase))],['negotiate','trade','act','reveal']);
  const stopped=await request(`/runs/${runId}/stop`,{});assert.equal(stopped.stopped,true);
  const committed=await request(`/runs/${runId}/events?after=0`);
  const cursor=Math.floor(committed.length/2);
  assert.deepEqual(await request(`/runs/${runId}/events?after=${cursor}`),committed.slice(cursor));
  assert.deepEqual(await request(`/runs/${runId}/events?after=${committed.length}`),[]);
  assert.deepEqual(await request(`/runs/${runId}/events?after=0`),committed,'repeated reads must preserve event identity and order');
  assert.deepEqual(await request(`/runs/${runId}/stop`,{}),stopped,'duplicate stop must be idempotent');
  console.log(`PASS actual dev bootstrap: Terse runtime + HTTP create/status/events/stop + WebSocket, automatic complete round (${events.length} events); schema, contiguous IDs/order, cursor catch-up, invalid cursors, missing run, duplicate stop`);
}finally{socket?.close();child.kill('SIGTERM');await child.exited;await rm(dir,{recursive:true,force:true});}
