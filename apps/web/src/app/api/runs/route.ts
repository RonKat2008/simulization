import {executionDenied} from '@/lib/execution-policy';
import {createRun,listRuns,respond} from './_service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:Request){const denied=executionDenied(req);if(denied)return denied;return respond(async()=>createRun(await req.json(),req.headers.get('Idempotency-Key')));}
export async function GET(){return respond(listRuns);}
