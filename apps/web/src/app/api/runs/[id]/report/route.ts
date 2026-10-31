import {neon} from '@neondatabase/serverless';
import {ApiError,respond,validId} from '../../_service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){return respond(async()=>{
  const id=validId((await params).id);
  if(!process.env.DATABASE_URL)throw new ApiError(503,'DATABASE_URL is not configured');
  const sql=neon(process.env.DATABASE_URL);
  const rows=await sql`SELECT r.id,r.condition,r.status,r.config,m.metrics,v.content AS review
    FROM runs r LEFT JOIN metrics m ON m.run_id=r.id
    LEFT JOIN reviews v ON v.run_id=r.id AND v.kind='run' WHERE r.id=${id}`;
  if(!rows.length)throw new ApiError(404,'Run not found');
  return rows[0];
});}
