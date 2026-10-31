import { neon } from '@neondatabase/serverless';
import { initialInventoryValues } from '../../../../../../../../packages/shared/src/starting-luck';
import { initialEvidenceForRun } from '../../../../../components/report/initial-evidence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Observer-only initial totals. Never wakes an actor, reads final holdings, or calls a model. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return Response.json({ error: 'Invalid run ID' }, { status: 400 });
  const unavailable = () => Response.json({ runId: id, values: null, reason: 'Initial goods value was not recorded or could not be verified.' });
  if (!process.env.DATABASE_URL) return unavailable();
  try {
    const sql = neon(process.env.DATABASE_URL);
    const [runs = [], agents = []] = await sql.transaction([
      sql`SELECT config FROM runs WHERE id=${id}`,
      sql`SELECT agent_id AS id FROM agents WHERE run_id=${id} ORDER BY agent_id`,
    ]);
    if (!runs.length) return unavailable();
    const result = initialInventoryValues(id, agents as { id: string }[], initialEvidenceForRun(id, runs[0]!.config));
    return Response.json({ runId: id, values: result.values, reason: result.values ? null : 'Initial goods value was not recorded or could not be verified.' });
  } catch {
    return Response.json({ runId: id, values: null, reason: 'Starting values are temporarily unavailable.' }, { status: 503 });
  }
}
