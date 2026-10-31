import {createRun,listRuns,respond} from './_service';
import {hostedLaunchResponse} from '../../../lib/run-availability';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:Request){return hostedLaunchResponse() ?? respond(async()=>createRun(await req.json(),req.headers.get('Idempotency-Key')));}
export async function GET(){return respond(listRuns);}
