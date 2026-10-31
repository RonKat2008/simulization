import { neon } from '@neondatabase/serverless';
import { ReviewSchema, type Review } from '@simulization/shared';
import { rowToEvent } from '../../mastra/db';
import type { LoadedRun } from './data';

/** Newest completed runs kept per condition, so a long history cannot bloat the page. */
const MAX_RUNS_PER_CONDITION = 12;

export interface NeonReport {
  runs: LoadedRun[];
  /** Latest stored kind='run' review per run id; runs without a valid one are absent. */
  reviews: Map<string, Review>;
}

const asScores = (v: unknown): Record<string, number> => {
  if (typeof v !== 'object' || v === null) return {};
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => typeof e[1] === 'number'));
};

/**
 * Reads completed runs ('done'; the schema has no dropped flag) with agents, events, final scores and
 * the latest stored review. Returns null when DATABASE_URL is unset. Throws on any DB error; the
 * caller reports an explicit unavailable state.
 */
export async function loadNeonReport(runId?: string): Promise<NeonReport | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const sql = neon(url);

  const runRows = runId
    ? await sql`SELECT id,condition,status,config,final_scores FROM runs WHERE id=${runId}`
    : await sql`SELECT id,condition,status,config,final_scores FROM (
        SELECT id,condition,status,config,final_scores,created_at,
          row_number() OVER (PARTITION BY condition,COALESCE(config->>'wealth_visibility','private'),config->>'mode' ORDER BY created_at DESC) AS rn
        FROM runs WHERE status='done'
      ) t WHERE rn <= ${MAX_RUNS_PER_CONDITION} ORDER BY created_at`;
  if (runRows.length === 0) return { runs: [], reviews: new Map() };
  const ids = runRows.map((r) => r.id as string);

  const [agentRows, eventRows, reviewRows, metricRows] = await sql.transaction([
    sql`SELECT run_id, agent_id, name, company FROM agents WHERE run_id = ANY(${ids}) ORDER BY run_id, agent_id`,
    sql`SELECT * FROM events WHERE run_id = ANY(${ids}) ORDER BY run_id, seq`,
    sql`SELECT DISTINCT ON (run_id) run_id, content FROM reviews
        WHERE kind = 'run' AND run_id = ANY(${ids}) ORDER BY run_id, created_at DESC`,
    sql`SELECT run_id, metrics FROM metrics WHERE run_id = ANY(${ids})`,
  ]);

  const runs: LoadedRun[] = runRows.map((r) => ({
    id: r.id as string,
    condition: r.condition as LoadedRun['condition'],
    status: r.status as string,
    config: r.config as LoadedRun['config'],
    storedMetrics: metricRows.find(m=>m.run_id===r.id)?.metrics as LoadedRun['storedMetrics'],
    agents: agentRows
      .filter((a) => a.run_id === r.id)
      .map((a) => ({ id: a.agent_id as string, name: a.name as string, company: a.company as string })),
    events: eventRows.filter((e) => e.run_id === r.id).map(rowToEvent),
    finalScores: asScores(r.final_scores),
  }));

  const reviews = new Map<string, Review>();
  for (const row of reviewRows) {
    const parsed = ReviewSchema.safeParse(row.content);
    if (parsed.success) reviews.set(row.run_id as string, parsed.data);
    else console.error(`[report] review for run ${String(row.run_id)} failed validation; ignoring it`, parsed.error.message);
  }
  return { runs, reviews };
}
