// Live smoke: one manually stepped WorldActor with real gateway + Relay + MerchantAgent actors.
// Env: SIM_CONTROL_PLANE_URL (the control plane printed by `pnpm dev:sim`, NOT the :8787 HTTP API),
//      SIM_HTTP_URL (default http://127.0.0.1:8787), LIVE_ROUNDS (default 6), LIVE_SEED (default 42).
// Never prints credentials.
import {loadProjectEnv} from './load-env';
import {createActorTransport} from 'durable-actors/backend';
loadProjectEnv();
const controlPlaneUrl=process.env.SIM_CONTROL_PLANE_URL;
if(!controlPlaneUrl) throw new Error('Set SIM_CONTROL_PLANE_URL to the control plane URL printed by dev:sim');
const http=process.env.SIM_HTTP_URL??'http://127.0.0.1:8787';
const rounds=Number(process.env.LIVE_ROUNDS??6);
const seed=Number(process.env.LIVE_SEED??42);
const transport=createActorTransport({projectId:'local',controlPlaneUrl,apiKey:process.env.DURABLE_ACTORS_SECRET||undefined} as never);
const call=async(id:string,m:string,...a:unknown[])=>transport.invoke('WorldActor',id,m,a) as Promise<string>;
const runId=`live-${Date.now().toString(36)}`;
const t0=Date.now();
await call(runId,'initialize',runId,seed,'LABELED',6,false);
console.log(`runId=${runId}`);
console.log(JSON.parse(await call(runId,'enableLive')).mode,`setup ${Date.now()-t0}ms`);
let st=JSON.parse(await call(runId,'status'));
const timings:{key:string;ms:number;error?:string}[]=[];
while(st.status==='running'&&st.round<=rounds){
  const t=Date.now();
  try{st=JSON.parse(await call(runId,'advance',st.nextKey));timings.push({key:st.nextKey,ms:Date.now()-t});}
  catch(e){timings.push({key:st.nextKey,ms:Date.now()-t,error:String(e).slice(0,300)});console.log('advance error',timings.at(-1));
    if(timings.filter(x=>x.error).length>=2) break; st=JSON.parse(await call(runId,'status'));}
  console.log(`advanced -> round ${st.round} ${st.phase} seq=${st.seq} (${timings.at(-1)!.ms}ms)`);
}
const events=await (await fetch(`${http}/runs/${runId}/events?after=0`)).json() as {type:string;flag?:string;seq:number}[];
const by:Record<string,number>={};const flags:Record<string,number>={};
for(const e of events){by[e.type]=(by[e.type]??0)+1;if(e.flag)flags[e.flag]=(flags[e.flag]??0)+1;}
console.log(JSON.stringify({runId,final:st,timings,eventCount:events.length,byType:by,byFlag:flags,totalMs:Date.now()-t0}));
