import {respond,runStatus} from '../_service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){return respond(async()=>runStatus((await params).id));}
