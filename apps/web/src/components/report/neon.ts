import { neon } from '@neondatabase/serverless';
import { ReviewSchema, type Review } from '@simulization/shared';
import { z } from 'zod';
import { CrossJudgeSchema, type CrossJudge } from '../../mastra/crossJudge';
import { EnsembleSchema, type Ensemble } from '../../mastra/ensemble';
import { rowToEvent } from '../../mastra/db';
import { labelModeOf, monitoringOf, productProjectOfConfig, runModeOf, wealthVisibilityOf } from '../../mastra/hierarchy';
import type { LoadedRun } from './data';
import { initialEvidenceForRun } from './initial-evidence';

/** Newest completed runs kept per condition and compatible group, so a long history cannot bloat the page. */
const MAX_RUNS_PER_CONDITION = 12;

export interface NeonReport {
  runs: LoadedRun[];
  /** Latest stored kind='run' review per run id; runs without a valid one are absent. */
  reviews: Map<string, Review>;
  /** Extra stored fields ReviewSchema strips: the anonymization map, the legacy cross judge and the judge ensemble. */
  extras?: Map<string, StoredExtras>;
}

export interface StoredExtras {
  /** Anonymized group label -> company id ("Group 1" -> "A"). */
  groupMap: Record<string, string>;
  crossJudge?: CrossJudge;
  /** 3-lab judge ensemble; absent on reviews written before it. */
  ensemble?: Ensemble;
}

const GroupMapSchema = z.record(z.string(), z.string());

const asScores = (v: unknown): Record<string, number> => {
  if (typeof v !== 'object' || v === null) return {};
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => typeof e[1] === 'number'));
};

/** Independent completion evidence; never substitute the number of loaded events. */
export function persistedTerminalSeq(config: unknown, status: unknown): number | undefined {
  if (status !== 'done' || !config || typeof config !== 'object') return undefined;
  const seq = (config as Record<string, unknown>).projectedSeq;
  return typeof seq === 'number' && Number.isSafeInteger(seq) && seq > 0 ? seq : undefined;
}

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
          row_number() OVER (PARTITION BY condition,COALESCE(config->>'wealth_visibility','private'),config->>'mode',COALESCE(config->>'label_mode','true'),COALESCE(config->>'monitoring','standard'),COALESCE(config->>'product_project','off') ORDER BY created_at DESC) AS rn
        FROM runs WHERE status='done'
      ) t WHERE rn <= ${MAX_RUNS_PER_CONDITION} ORDER BY created_at`;
  if (runRows.length === 0) return { runs: [], reviews: new Map(), extras: new Map() };
  const ids = runRows.map((r) => r.id as string);

  const [agentRows, eventRows, reviewRows, metricRows] = await sql.transaction([
    sql`SELECT run_id, agent_id, name, company, provider, model FROM agents WHERE run_id = ANY(${ids}) ORDER BY run_id, agent_id`,
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
    terminalSeq: persistedTerminalSeq(r.config, r.status),
    initial: initialEvidenceForRun(String(r.id), r.config),
    storedMetrics: metricRows.find(m=>m.run_id===r.id)?.metrics as LoadedRun['storedMetrics'],
    agents: agentRows
      .filter((a) => a.run_id === r.id)
      .map((a) => ({ id: a.agent_id as string, name: a.name as string, company: a.company as string,
        provider: typeof a.provider === 'string' ? a.provider : undefined,
        model: typeof a.model === 'string' ? a.model : undefined })),
    events: eventRows.filter((e) => e.run_id === r.id).map(rowToEvent),
    finalScores: asScores(r.final_scores),
    // Kept per run so the report never pools stub with live or public with private wealth.
    mode: runModeOf(r.config),
    wealthVisibility: wealthVisibilityOf(r.config),
    labelMode: labelModeOf(r.config),
    monitoring: monitoringOf(r.config),
    productProject: productProjectOfConfig(r.config),
  }));

  const reviews = new Map<string, Review>();
  const extras = new Map<string, StoredExtras>();
  for (const row of reviewRows) {
    const parsed = ReviewSchema.safeParse(row.content);
    if (parsed.success) {
      reviews.set(row.run_id as string, parsed.data);
      const extra = readExtras(row.content, String(row.run_id));
      if (extra) extras.set(row.run_id as string, extra);
    } else console.error(`[report] review for run ${String(row.run_id)} failed validation; ignoring it`, parsed.error.message);
  }
  return { runs, reviews, extras };
}

/** Parses an optional stored field; a bad value is dropped with a log, never fatal. */
function optional<T>(schema: z.ZodType<T>, value: unknown, what: string, runId: string): T | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  console.error(`[report] ${what} for run ${runId} failed validation; ignoring it`, parsed.error.message);
  return undefined;
}

/** groupMap, crossJudge and ensemble are read from the raw content. */
function readExtras(content: unknown, runId: string): StoredExtras | null {
  if (typeof content !== 'object' || content === null) return null;
  const raw = content as { groupMap?: unknown; crossJudge?: unknown; ensemble?: unknown };
  const groupMap = GroupMapSchema.safeParse(raw.groupMap);
  if (!groupMap.success) return null;
  const crossJudge = optional(CrossJudgeSchema, raw.crossJudge, 'cross judge', runId);
  const ensemble = optional(EnsembleSchema, raw.ensemble, 'judge ensemble', runId);
  return { groupMap: groupMap.data, ...(crossJudge && { crossJudge }), ...(ensemble && { ensemble }) };
}
