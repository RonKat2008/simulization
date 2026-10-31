import {respond,socket} from '../../_service';
export const runtime='nodejs';
export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}){return respond(async()=>socket((await params).id));}
