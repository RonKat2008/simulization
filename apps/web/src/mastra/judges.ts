// 3-lab judge ensemble registry (CLAUDE.md "Judge caveat"). Pure: no Mastra imports, so tests and
// the report can read it. Every judge's lab is also a contestant, so no single judge is neutral; the
// ensemble lets code score each lab's group only with the other two labs' judges (ensemble.ts).
import type { CompanyId } from '@simulization/shared';

/** Environment variables as read here (process.env or a plain object in tests). */
export type Env = Record<string, string | undefined>;

export interface JudgeSpec {
  /** Stable id stored with each result ("claude", "gpt", "gemini"). */
  id: string;
  /** Contestant company sharing this judge's lab (packages/shared COMPANIES: A Anthropic, B OpenAI, C Google). */
  family: CompanyId;
  /** Mastra model router id. "vercel/<provider>/<model>" goes through the Vercel AI Gateway. */
  model: string;
}

/**
 * Defaults, checked against GET https://ai-gateway.vercel.sh/v1/models on 2026-10-31.
 * Claude keeps the existing reviewer's direct Anthropic route (ANTHROPIC_API_KEY, effort high); the
 * gateway lists the same model as anthropic/claude-opus-5.5. Gemini 4 Argon is the newest Google
 * reasoning model on the gateway and is priced at the Pro tier; google/gemini-3.1-pro-preview is the
 * older Pro alternative (set JUDGE_C_MODEL to switch).
 */
export const DEFAULT_JUDGES: readonly JudgeSpec[] = [
  { id: 'claude', family: 'A', model: 'anthropic/claude-opus-5-5' },
  { id: 'gpt', family: 'B', model: 'vercel/openai/gpt-5.5' },
  { id: 'gemini', family: 'C', model: 'vercel/google/gemini-4-argon' },
];

/** Judges B and C read a gateway id ("openai/gpt-5.5"); a bare id gets the gateway prefix. */
const viaGateway = (id: string) => (id.startsWith('vercel/') ? id : `vercel/${id}`);
const off = (v: string | undefined) => ['0', 'false', 'off'].includes(v?.trim().toLowerCase() ?? '');

/**
 * Judges for this run, read per call so env changes apply without a redeploy.
 * JUDGE_A_MODEL is a Mastra id (default: direct Anthropic); JUDGE_B_MODEL / JUDGE_C_MODEL are gateway ids
 * (JUDGE_B_MODEL falls back to the older CROSS_JUDGE_MODEL). JUDGE_<A|B|C>=0 drops a judge.
 */
export function getJudgeSpecs(env: Env = process.env): JudgeSpec[] {
  const b = env.JUDGE_B_MODEL?.trim() || env.CROSS_JUDGE_MODEL?.trim();
  const c = env.JUDGE_C_MODEL?.trim();
  const override: Record<CompanyId, string | undefined> = {
    A: env.JUDGE_A_MODEL?.trim() || undefined,
    B: b ? viaGateway(b) : undefined,
    C: c ? viaGateway(c) : undefined,
  };
  return DEFAULT_JUDGES.filter((j) => !off(env[`JUDGE_${j.family}`])).map((j) => ({ ...j, model: override[j.family] ?? j.model }));
}

/** Display form of a model id: the gateway prefix dropped. */
export const displayModel = (model: string) => model.replace(/^vercel\//, '');

/** The ensemble route has to answer within the analyze route's 300s maxDuration. */
export const DEFAULT_JUDGE_TIMEOUT_MS = 240_000;

export function judgeTimeoutMs(env: Env = process.env): number {
  const parsed = Number(env.JUDGE_TIMEOUT_MS ?? env.CROSS_JUDGE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_JUDGE_TIMEOUT_MS;
}
