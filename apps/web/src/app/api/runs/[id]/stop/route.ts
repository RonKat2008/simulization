import {respond,invoke} from '../../_service';
export const runtime='nodejs';
export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}){return respond(async()=>invoke((await params).id,'stop'));}
