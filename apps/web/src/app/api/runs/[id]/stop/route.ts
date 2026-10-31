import {executionDenied} from '@/lib/execution-policy';
import {respond,invoke} from '../../_service';
export const runtime='nodejs';
export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}){const denied=executionDenied(_req);if(denied)return denied;return respond(async()=>invoke((await params).id,'stop'));}
