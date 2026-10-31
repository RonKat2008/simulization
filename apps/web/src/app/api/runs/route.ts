import {createRun,listRuns,respond} from './_service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:Request){return respond(async()=>createRun(await req.json(),req.headers.get('Idempotency-Key')));}
export async function GET(){return respond(listRuns);}
