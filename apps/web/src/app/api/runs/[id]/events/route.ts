import {events,respond} from '../../_service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){return respond(async()=>events((await params).id,new URL(req.url).searchParams.get('after')));}
