import {executionDenied} from '@/lib/execution-policy';
import {ApiError,createRun,respond} from '../runs/_service';
export const runtime='nodejs';
export async function POST(req:Request){const denied=executionDenied(req);if(denied)return denied;return respond(async()=>{
  const {n}=await req.json();if(!Number.isInteger(n)||n<1||n>100)throw new ApiError(400,'n must be 1..100');
  const runIds:string[]=[];for(let i=1;i<=n;i++)runIds.push((await createRun({condition:i%2?'LABELED':'BLIND',seed:i})).runId);
  return {runIds};
});}
