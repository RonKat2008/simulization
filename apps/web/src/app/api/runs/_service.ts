// Track A. Server-only run transport; never pass control-plane credentials to browsers.
import {createActorTransport} from 'durable-actors/backend';
import {SocketProxy} from 'durable-actors/proxy';
import {neon} from '@neondatabase/serverless';
import {EventSchema,LabelModeSchema,MonitoringSchema,WealthVisibilitySchema,runLabelMapping} from '@simulization/shared';
import {rowToEvent} from '@/mastra/db';
import {reportDeliveryStatus} from './_report-status';

export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export function actorOptions(){
  for(const key of ['DURABLE_ACTORS_SECRET','DURABLE_ACTORS_API_KEY'])if(process.env[key]==='')delete process.env[key];
  return {
  controlPlaneUrl:process.env.DURABLE_ACTORS_URL??'http://127.0.0.1:7100',
  projectId:process.env.DURABLE_ACTORS_PROJECT_ID??'local',
  apiKey:process.env.DURABLE_ACTORS_SECRET||undefined,
};}
export function validId(id:string){if(!/^[A-Za-z0-9._-]{1,128}$/.test(id)||id==='.'||id==='..')throw new ApiError(400,'Invalid run ID');return id;}
export async function invoke(id:string,method:string,args:unknown[]=[]):Promise<any>{
  const value=await createActorTransport(actorOptions()).invoke('WorldActor',validId(id),method,args);
  return typeof value==='string'?JSON.parse(value):value;
}
function db(){if(!process.env.DATABASE_URL)throw new ApiError(503,'DATABASE_URL is not configured');return neon(process.env.DATABASE_URL);}
export async function createRun(body:unknown,requestedId?:string|null){
  const b=body as {condition?:unknown;seed?:unknown;wealth_visibility?:unknown;label_mode?:unknown;monitoring?:unknown};
  if(!b||(b.condition!=='BLIND'&&b.condition!=='LABELED')||!Number.isInteger(b.seed)||Number(b.seed)<-2147483648||Number(b.seed)>2147483647)throw new ApiError(400,'condition and signed 32-bit integer seed are required');
  const visibility=WealthVisibilitySchema.safeParse(b.wealth_visibility===undefined?'private':b.wealth_visibility);
  if(!visibility.success)throw new ApiError(400,'wealth_visibility must be private or public');
  const wealth_visibility=visibility.data;
  const labelMode=LabelModeSchema.safeParse(b.label_mode===undefined?'true':b.label_mode);
  if(!labelMode.success)throw new ApiError(400,'label_mode must be true or swapped');
  if(labelMode.data==='swapped'&&b.condition!=='LABELED')throw new ApiError(400,'label_mode swapped requires condition LABELED');
  const label_mode=labelMode.data;
  const monitoringResult=MonitoringSchema.safeParse(b.monitoring===undefined?'standard':b.monitoring);
  if(!monitoringResult.success)throw new ApiError(400,'monitoring must be standard or unmonitored');
  const monitoring=monitoringResult.data;
  const mode=process.env.SIM_RUN_MODE??'live';
  if(!['live','stub'].includes(mode))throw new ApiError(503,'SIM_RUN_MODE must be live or stub');
  if(mode==='live'){
    const missing=['DATABASE_URL','AI_GATEWAY_API_KEY','AGENTRELAY_API_KEY'].filter(key=>!process.env[key]);
    if(missing.length)throw new ApiError(503,`Missing live configuration: ${missing.join(', ')}`);
    if(process.env.MODEL_MODE==='stub')throw new ApiError(503,'Live mode requires MODEL_MODE unset');
  }
  const agentCount=mode==='stub'?6:18;
  const runId=validId(requestedId||crypto.randomUUID());
  if(runId.length>110)throw new ApiError(400,'Run ID must be at most 110 characters');
  const registration={runId,seed:b.seed,condition:b.condition,mode,agentCount,wealth_visibility,...(label_mode!=='true'?{label_mode}:{}),...(monitoring!=='standard'?{monitoring}:{})};
  await createActorTransport(actorOptions()).invoke('RunDirectory','main','register',[registration]);
  await invoke(runId,'startRun',[runId,b.seed,b.condition,mode,agentCount,wealth_visibility,label_mode,monitoring]);
  return {runId};
}
async function initializingStatus(id:string):Promise<any|null>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([invoke(id,'status'),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Actor busy')),750);})]);}
  catch{return null;}
  finally{if(timer!==undefined)clearTimeout(timer);}
}
export async function runStatus(id:string){
  validId(id);
  // Reading the committed projection never queues behind a serialized actor's model calls.
  if(process.env.DATABASE_URL){
    const sql=db();
    const rows=await sql`SELECT r.*,v.id AS review_id FROM runs r LEFT JOIN reviews v ON v.run_id=r.id AND v.kind='run' WHERE r.id=${id}`;
    if(rows.length){
      const row=rows[0]!;
      const agents=await sql`SELECT agent_id AS id,name,company FROM agents WHERE run_id=${id} ORDER BY agent_id`;
      const config=row.config as Record<string,unknown>;
      if(config?.mode==='initializing-live'){const current=await initializingStatus(id);if(current)return current;}
      const reportStatus=await reportDeliveryStatus(row.status,config?.mode,Boolean(row.review_id),()=>createActorTransport(actorOptions()).invoke('ReportJob',id,'status',[]));
      return {id:row.id,condition:row.condition,seed:row.seed,status:row.status,round:row.current_round,phase:row.current_phase,finalScores:row.final_scores,agents,mode:config?.mode,wealth_visibility:config?.wealth_visibility??'private',...experimentSettings(row.condition,config),seq:config?.projectedSeq,projection:'synced',reportStatus,source:'neon'};
    }
    const runs=await createActorTransport(actorOptions()).invoke('RunDirectory','main','list',[]) as {runId:string;condition:string;mode:string;wealth_visibility?:string;label_mode?:string;monitoring?:string}[];
    const pending=runs.find(r=>r.runId===id);
    if(!pending)throw new ApiError(404,'Run not found');
    const initializing=await initializingStatus(id);
    if(initializing)return initializing;
    return {id,condition:pending.condition,wealth_visibility:pending.wealth_visibility??'private',...experimentSettings(pending.condition,pending as Record<string,unknown>),status:'running',round:1,phase:'negotiate',mode:pending.mode==='live'?'initializing-live':'deterministic-stub',seq:0,agents:[],projection:'pending',reportStatus:'not-requested'};
  }
  return invoke(id,'status');
}
export async function events(id:string,after:string|null){
  validId(id);const cursor=after===null?0:Number(after);
  if(!Number.isSafeInteger(cursor)||cursor<0)throw new ApiError(400,'Invalid event cursor');
  if(process.env.DATABASE_URL){
    const sql=db();
    const exists=await sql`SELECT id FROM runs WHERE id=${id}`;
    if(!exists.length){await runStatus(id);return [];} // registered, projection not yet published
    const rows=await sql`SELECT * FROM events WHERE run_id=${id} AND seq>${cursor} ORDER BY seq`;
    return rows.map(rowToEvent);
  }
  // Credential-free local rehearsal only. Live runs always require the agreed Neon projection.
  if(process.env.SIM_RUN_MODE!=='stub')throw new ApiError(503,'DATABASE_URL is not configured');
  return (await invoke(id,'events',[cursor])).map((event:unknown)=>EventSchema.parse(event));
}
export async function socket(id:string){
  await invoke(id,'status');
  return new SocketProxy({WorldActor:{}},actorOptions()).handle({actorName:'WorldActor',actorId:id,metadata:null});
}
export async function listRuns(){
  if(process.env.DATABASE_URL){
    const rows=await db()`SELECT id,condition,seed,status,current_round,current_phase,config,final_scores,created_at FROM runs ORDER BY created_at DESC LIMIT 100`;
    return rows.map(r=>({id:r.id,condition:r.condition,seed:r.seed,status:r.status,round:r.current_round,phase:r.current_phase,mode:(r.config as Record<string,unknown>)?.mode,wealth_visibility:(r.config as Record<string,unknown>)?.wealth_visibility??'private',...experimentSettings(r.condition,r.config as Record<string,unknown>),finalScores:r.final_scores,createdAt:r.created_at}));
  }
  if(process.env.SIM_RUN_MODE!=='stub')throw new ApiError(503,'DATABASE_URL is not configured');
  const runs=await createActorTransport(actorOptions()).invoke('RunDirectory','main','list',[]) as {runId:string}[];
  return Promise.all(runs.slice(-100).reverse().map(r=>runStatus(r.runId)));
}
/** label_mode/monitoring/label_mapping for API responses; historical rows without them read as defaults. */
function experimentSettings(condition:unknown,config:Record<string,unknown>|null|undefined){
  const label_mode=config?.label_mode==='swapped'?'swapped' as const:'true' as const;
  const monitoring=config?.monitoring==='unmonitored'?'unmonitored' as const:'standard' as const;
  return {label_mode,monitoring,label_mapping:runLabelMapping(condition==='LABELED'?'LABELED':'BLIND',label_mode)};
}
export async function respond(work:()=>Promise<unknown>){
  try{return Response.json(await work(),{headers:{'cache-control':'no-store'}});}
  catch(error){
    if(error instanceof ApiError)return Response.json({error:error.message},{status:error.status});
    if(String(error).includes('Run not found'))return Response.json({error:'Run not found'},{status:404});
    if(String(error).includes('registration conflict'))return Response.json({error:'Run ID already registered with different options'},{status:409});
    if(error instanceof SyntaxError)return Response.json({error:'Invalid JSON request'},{status:400});
    // Provider/SQL errors can contain credentials; expose only a stable service error.
    return Response.json({error:'Run service unavailable; check actor runtime and configuration'},{status:503});
  }
}
