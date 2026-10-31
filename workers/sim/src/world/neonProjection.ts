// Track A. Replayable reporting projection; Terse remains authoritative actor storage.
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { COMPANIES, EventSchema, runLabelMapping } from '@simulization/shared';
import { validateInitialInventoryEvidence, type Checkpoint } from './persistence';

export const PROJECTION_TIMEOUT_MS = 10_000;
export type ProjectionSql = NeonQueryFunction<false, false>;

/**
 * Publish one committed snapshot atomically to the agreed Neon schema. Retrying an
 * uncertain HTTP result is safe: events keep their IDs, and older snapshots cannot
 * regress the run's progress. Never use this as an AgentStore or checkpoint store.
 * The optional SQL function exists for transport-level smoke checks without secrets.
 */
export async function projectCheckpoint(checkpoint: Checkpoint, mode: string, injectedSql?: ProjectionSql): Promise<void> {
  const { state, events } = checkpoint;
  if (!mode.trim()) throw new Error('Projection mode is required');
  if (state.seq !== events.length) throw new Error('Projection checkpoint sequence mismatch');
  const initialInventory = checkpoint.initialInventory === undefined ? undefined : validateInitialInventoryEvidence(checkpoint.initialInventory, state);
  const rows = events.map((raw, index) => {
    const e = EventSchema.parse(raw);
    if (e.runId !== state.runId || e.seq !== index + 1 || e.id !== `${state.runId}-${e.seq}`) {
      throw new Error('Projection events must have contiguous run-scoped IDs and sequence numbers');
    }
    return {
      id: e.id, run_id: e.runId, seq: e.seq, round: e.round, phase: e.phase,
      type: e.type, actor_id: e.actorId, actor_company: e.actorCompany ?? null,
      target_id: e.targetId ?? null, target_company: e.targetCompany ?? null,
      channel: e.channel ?? null, text: e.text ?? null, private_plan: e.privatePlan ?? null,
      claim: e.claim ?? null, ground_truth: e.groundTruth ?? null, flags: e.flags,
      ts: new Date(e.ts).toISOString(),
    };
  });
  const agents = Object.values(state.agents).sort((a,b) => a.id.localeCompare(b.id)).map(agent => {
    const company = COMPANIES.find(c => c.id === agent.company);
    if (!company) throw new Error(`Unknown projection company for agent ${agent.id}`);
    return { run_id: state.runId, agent_id: agent.id, name: agent.name, company: agent.company,
      provider: company.provider, model: company.model };
  });
  const url = process.env.DATABASE_URL;
  if (!injectedSql && !url) throw new Error('DATABASE_URL is required for Neon projection');
  const sql = injectedSql ?? neon(url!);
  const config = JSON.stringify({ mode, wealth_visibility: state.wealth_visibility??'private', label_mode: state.label_mode??'true', monitoring: state.monitoring??'standard', label_mapping: runLabelMapping(state.condition, state.label_mode), agentCount: agents.length, projectedSeq: state.seq, ...(initialInventory ? { initialInventory } : {}) });
  // One HTTP request / Postgres transaction. No completed run is visible until its
  // entire event stream is visible. Failed/uncertain requests must be retried by World.
  await sql.transaction([
    sql`INSERT INTO runs (id, condition, seed, status, current_round, current_phase, config, final_scores, created_at)
        VALUES (${state.runId}, ${state.condition}, ${state.seed}, ${state.status}, ${state.round}, ${state.phase},
          ${config}::jsonb, ${state.finalScores ? JSON.stringify(state.finalScores) : null}::jsonb, ${new Date(state.epoch).toISOString()}::timestamptz)
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, current_round = EXCLUDED.current_round,
          current_phase = EXCLUDED.current_phase, config = runs.config || EXCLUDED.config, final_scores = EXCLUDED.final_scores
        WHERE COALESCE((runs.config->>'projectedSeq')::integer, 0) <= ${state.seq}`,
    sql`INSERT INTO agents (run_id, agent_id, name, company, provider, model)
        SELECT run_id, agent_id, name, company, provider, model
        FROM jsonb_to_recordset(${JSON.stringify(agents)}::jsonb)
          AS a(run_id text, agent_id text, name text, company text, provider text, model text)
        ON CONFLICT (run_id, agent_id) DO NOTHING`,
    sql`INSERT INTO events (id, run_id, seq, round, phase, type, actor_id, actor_company,
          target_id, target_company, channel, text, private_plan, claim, ground_truth, flags, ts)
        SELECT id, run_id, seq, round, phase, type, actor_id, actor_company,
          target_id, target_company, channel, text, private_plan, claim, ground_truth, flags, ts
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
          AS e(id text, run_id text, seq integer, round integer, phase text, type text,
            actor_id text, actor_company text, target_id text, target_company text, channel text,
            text text, private_plan text, claim jsonb, ground_truth jsonb, flags text[], ts timestamptz)
        ORDER BY seq
        ON CONFLICT (id) DO NOTHING`,
  ], { fetchOptions: { signal: AbortSignal.timeout(PROJECTION_TIMEOUT_MS) } });
}
