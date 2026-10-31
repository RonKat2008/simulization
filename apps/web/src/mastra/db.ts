// Owner: E. Neon reads and writes for the analysis routes (CLAUDE.md Part 6).
import { neon } from '@neondatabase/serverless';
import { EventSchema, type Condition, type Event } from '@simulization/shared';
import type { AnonymizableAgent } from './anonymize';
import type { StoredMetrics, StoredReview, StoredSynthesis, SynthesisRunInput } from './pipeline';

export const SYNTHESIS_REVIEW_ID = 'synthesis';

/** Re-analyzing a run replaces its review instead of adding another. */
export const runReviewId = (runId: string) => `review-${runId}`;

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return neon(url);
}

export interface RunRow {
  id: string;
  condition: Condition;
  status: string;
}

export function rowToEvent(r: Record<string, unknown>): Event {
  return EventSchema.parse({
    id: r.id,
    runId: r.run_id,
    seq: r.seq,
    round: r.round,
    phase: r.phase,
    type: r.type,
    actorId: r.actor_id,
    actorCompany: r.actor_company ?? undefined,
    targetId: r.target_id ?? undefined,
    targetCompany: r.target_company ?? undefined,
    channel: r.channel ?? undefined,
    text: r.text ?? undefined,
    privatePlan: r.private_plan ?? undefined,
    claim: r.claim ?? undefined,
    groundTruth: r.ground_truth ?? undefined,
    flags: r.flags ?? [],
    ts: new Date(r.ts as string | Date).getTime(),
  });
}

export async function getRun(runId: string): Promise<RunRow | null> {
  const sql = db();
  const rows = await sql`SELECT id, condition, status FROM runs WHERE id = ${runId}`;
  return (rows[0] as RunRow | undefined) ?? null;
}

export async function loadRunData(runId: string): Promise<{ agents: AnonymizableAgent[]; events: Event[] }> {
  const sql = db();
  const [agents, events] = await sql.transaction([
    sql`SELECT agent_id AS id, company, provider, model FROM agents WHERE run_id = ${runId} ORDER BY agent_id`,
    sql`SELECT * FROM events WHERE run_id = ${runId} ORDER BY seq`,
  ]);
  return { agents: agents as AnonymizableAgent[], events: events.map(rowToEvent) };
}

export async function saveRunAnalysis(runId: string, metrics: StoredMetrics, review: StoredReview): Promise<void> {
  const sql = db();
  await sql.transaction([
    sql`INSERT INTO metrics (run_id, metrics) VALUES (${runId}, ${JSON.stringify(metrics)}::jsonb)
        ON CONFLICT (run_id) DO UPDATE SET metrics = EXCLUDED.metrics`,
    sql`INSERT INTO reviews (id, run_id, kind, content) VALUES (${runReviewId(runId)}, ${runId}, 'run', ${JSON.stringify(review)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, created_at = now()`,
  ]);
}

export async function loadSynthesisRuns(): Promise<SynthesisRunInput[]> {
  const sql = db();
  const rows = await sql`
    SELECT r.id, r.condition, r.status, m.metrics, v.content AS review
    FROM runs r
    LEFT JOIN metrics m ON m.run_id = r.id
    LEFT JOIN reviews v ON v.run_id = r.id AND v.kind = 'run'
    ORDER BY r.created_at`;
  return rows as SynthesisRunInput[];
}

export async function loadEventIds(runIds: string[]): Promise<string[]> {
  const sql = db();
  const rows = await sql`SELECT id FROM events WHERE run_id = ANY(${runIds})`;
  return rows.map((r) => r.id as string);
}

export async function saveSynthesis(content: StoredSynthesis): Promise<void> {
  const sql = db();
  await sql`INSERT INTO reviews (id, run_id, kind, content)
            VALUES (${SYNTHESIS_REVIEW_ID}, NULL, 'synthesis', ${JSON.stringify(content)}::jsonb)
            ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, created_at = now()`;
}
