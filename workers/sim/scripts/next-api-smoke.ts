// Product test: real Next.js routes + consolidated Terse, explicitly stub and no external credentials.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {EventSchema,computeRunMetrics} from '@simulization/shared';
const root=fileURLToPath(new URL('../../..',import.meta.url));
const port=()=>new Promise<number>(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=(s.address() as {port:number}).port;s.close(()=>resolve(p));});});
const actorPort=await port(),webPort=await port();
const dir=await mkdtemp(tmpdir()+'/sim-next-');
const env={...process.env,SIM_RUN_MODE:'stub',MODEL_MODE:'stub',AI_GATEWAY_API_KEY:'',AGENTRELAY_API_KEY:'',DATABASE_URL:'',ANTHROPIC_API_KEY:'',DURABLE_ACTORS_SECRET:'',DURABLE_ACTORS_URL:`http://127.0.0.1:${actorPort}`,DURABLE_ACTORS_PROJECT_ID:'local',DURABLE_ACTORS_DATA_DIR:dir,PORT:String(webPort)};
const spawn=(cmd:string[])=>Bun.spawn(cmd,{cwd:root,env,stdin:'pipe',stdout:'pipe',stderr:'pipe'});
const logTail=new Map<number,string>();
const ready=async(child:ReturnType<typeof spawn>,pattern:RegExp)=>{
  // Drain stderr without emitting provider bodies. Only local, credential-free logs exist in this test.
  const errors=new Response(child.stderr).text();void errors.then(s=>logTail.set(child.pid,s.slice(-1500)));
  const reader=child.stdout.getReader();let output='';
  const timeout=setTimeout(()=>child.kill(),45000);
  try{while(!pattern.test(output)){const {value,done}=await reader.read();if(done)throw new Error('Product process exited before readiness: '+(await errors).slice(-2500));output+=new TextDecoder().decode(value);}}
  finally{clearTimeout(timeout);reader.releaseLock();}
  void (async()=>{const remaining=child.stdout.getReader();while(!(await remaining.read()).done){}remaining.releaseLock();})();
};
let actors=spawn([process.execPath,'workers/sim/scripts/consolidated-dev.ts']);
let web:ReturnType<typeof spawn>|undefined;let ws:WebSocket|undefined;
const base=`http://127.0.0.1:${webPort}`;
const networkFetch=async(url:string,init?:RequestInit):Promise<Response>=>{for(let i=0;;i++){try{return await fetch(url,init);}catch(error){if(i>=2)throw error;await new Promise(r=>setTimeout(r,500));}}};
const request=async(path:string,body?:unknown,key?:string)=>{
 const response=await networkFetch(base+path,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(body)});
 assert.ok(response.ok,`${path}: HTTP ${response.status}`);return response.json() as Promise<any>;
};
try{
 await ready(actors,/Consolidated Terse ready/);
 web=spawn(['node',root+'/apps/web/node_modules/next/dist/bin/next','dev',root+'/apps/web','--port',String(webPort)]);await ready(web,/Ready in/);
 const invalid=await networkFetch(base+'/api/runs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({condition:'BLIND',seed:2147483648})});assert.equal(invalid.status,400);
 const runId=`next-stub-${Date.now()}`;
 const body={condition:'BLIND',seed:42};
 assert.deepEqual(await request('/api/runs',body,runId),{runId});
 assert.deepEqual(await request('/api/runs',body,runId),{runId});
 const path=`/api/runs/${runId}`;
 const initial=await request(path);assert.equal(initial.mode,'deterministic-stub');assert.equal(initial.agents.length,6);
 const grant=await request(path+'/socket',{});
 const firstSocket=new Promise<void>((resolve,reject)=>{
  ws=new WebSocket(grant.websocketUrl);const timer=setTimeout(()=>reject(new Error('No socket event')),12000);
  ws.onmessage=event=>{try{EventSchema.parse(JSON.parse(event.data));clearTimeout(timer);ws?.close();resolve();}catch(e){clearTimeout(timer);reject(e);}};
 });
 await firstSocket;
 const before=await request(path);assert.ok(before.seq>0);
 actors.kill('SIGTERM');await actors.exited;
 actors=spawn([process.execPath,'workers/sim/scripts/consolidated-dev.ts']);await ready(actors,/Consolidated Terse ready/);
 await new Promise(resolve=>setTimeout(resolve,12000)); // deliberately no status/socket requests
 const after=await request(path);assert.ok(after.seq>before.seq,'restart required viewer traffic');
 console.log('PASS consolidated restart: run directory resumed progress without viewer traffic');
 const deadline=Date.now()+90000;let status=after;let reported=false;
 while(status.status==='running'&&Date.now()<deadline){
  if(status.round>=2&&!reported){console.log('PASS Next.js create/status/socket + complete stub round');reported=true;}
  await new Promise(resolve=>setTimeout(resolve,2000));status=await request(path);
 }
 assert.equal(status.status,'done');assert.equal(status.reportStatus,'not-requested');
 const events=await request(path+'/events?after=0');
 events.forEach((raw:unknown,i:number)=>{const e=EventSchema.parse(raw);assert.equal(e.seq,i+1);assert.equal(e.id,`${runId}-${i+1}`);});
 assert.deepEqual(await request(path+'/events?after=20'),events.slice(20));
 assert.equal((await networkFetch(base+path+'/events?after=-1')).status,400);
 const metrics=computeRunMetrics(events,status.agents);assert.equal(metrics.evalAwareness.total,144);
 console.log(`PASS Next.js six-round stub completion: ${events.length} ordered events; E metrics ${metrics.evalAwareness.total} turns; no live model/Relay/Neon/report claim`);
}catch(error){console.log('Product exit codes',actors.exitCode,web?.exitCode);console.log(web?logTail.get(web.pid)??'no stderr captured':'no web process');throw error;}finally{ws?.close();web?.kill('SIGTERM');if(web)await web.exited;actors.kill('SIGTERM');await actors.exited;await rm(dir,{recursive:true,force:true});}
