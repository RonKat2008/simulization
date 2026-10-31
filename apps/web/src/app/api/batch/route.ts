import {ApiError,createRun,respond} from '../runs/_service';
import {hostedLaunchResponse} from '../../../lib/run-availability';
export const runtime='nodejs';
export async function POST(req:Request){return hostedLaunchResponse() ?? respond(async()=>{
  const {n}=await req.json() as {n:number};if(!Number.isInteger(n)||n<1||n>100)throw new ApiError(400,'n must be 1..100');
  const runIds:string[]=[];for(let i=1;i<=n;i++)runIds.push((await createRun({condition:i%2?'LABELED':'BLIND',seed:i})).runId);
  return {runIds};
});}
