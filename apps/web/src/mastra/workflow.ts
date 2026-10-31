// Owner: E. Post-run workflow: load, metrics, anonymize, 3-lab judge ensemble, drop bad citations, save.
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { EventSchema, ReviewSchema, type Event, type Review } from '@simulization/shared';
import type { AnonymizableAgent } from './anonymize';
import { buildEnsemble, scoreJudges, type JudgeRaw } from './ensemble';
import type { JudgeSpec } from './judges';
import {
  StoredReviewSchema,
  buildReviewPrompt,
  computeStoredMetrics,
  filterClaims,
  type StoredMetrics,
  type StoredReview,
} from './pipeline';

export interface AnalyzeDeps {
  load: (runId: string) => Promise<{
    agents: AnonymizableAgent[];
    events: Event[];
    finalScores?: Record<string, number> | null;
  }>;
  /** The judge ensemble, resolved per run (judgeAgents.getJudgeRunners). All read the identical prompt. */
  judges: () => { spec: JudgeSpec; review: (prompt: string) => Promise<Review> }[];
  save: (runId: string, metrics: StoredMetrics, review: StoredReview) => Promise<void>;
  random?: () => number;
}

const AgentSchema = z.object({ id: z.string(), company: z.string(), provider: z.string(), model: z.string() });
const LoadedSchema = z.object({
  runId: z.string(),
  agents: z.array(AgentSchema),
  events: z.array(EventSchema),
  finalScores: z.record(z.string(), z.number()).nullish(),
});
const WithMetricsSchema = LoadedSchema.extend({ metrics: z.custom<StoredMetrics>() });
const WithPromptSchema = WithMetricsSchema.extend({
  prompt: z.string(),
  groupMap: z.record(z.string(), z.string()),
});
const SpecSchema = z.object({ id: z.string(), family: z.enum(['A', 'B', 'C']), model: z.string() });
const JudgeRawSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), spec: SpecSchema, review: ReviewSchema }),
  z.object({ status: z.literal('failed'), spec: SpecSchema, error: z.string() }),
]);
const WithReviewSchema = WithPromptSchema.extend({ judgeRaws: z.array(JudgeRawSchema) });
const FilteredSchema = z.object({
  runId: z.string(),
  metrics: z.custom<StoredMetrics>(),
  stored: StoredReviewSchema,
});
const ResultSchema = z.object({
  runId: z.string(),
  summary: z.string(),
  claims: z.number().int(),
  droppedClaims: z.number().int(),
});
export type AnalyzeResult = z.infer<typeof ResultSchema>;

export function createAnalyzeWorkflow(deps: AnalyzeDeps) {
  /** Never throws: a failed or timed-out judge is recorded and the others continue. */
  async function runJudge(runId: string, judge: ReturnType<AnalyzeDeps['judges']>[number], prompt: string): Promise<JudgeRaw> {
    const started = Date.now();
    try {
      const review = await judge.review(prompt);
      console.log(`[analyze ${runId}] judge ${judge.spec.id} (${judge.spec.model}) ok in ${Math.round((Date.now() - started) / 1000)}s`);
      return { status: 'ok', spec: judge.spec, review };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[analyze ${runId}] judge ${judge.spec.id} (${judge.spec.model}) failed; continuing without it:`, message);
      return { status: 'failed', spec: judge.spec, error: message.slice(0, 500) };
    }
  }

  const load = createStep({
    id: 'load-run',
    inputSchema: z.object({ runId: z.string() }),
    outputSchema: LoadedSchema,
    execute: async ({ inputData: { runId } }) => {
      const { agents, events, finalScores } = await deps.load(runId);
      if (events.length === 0) throw new Error(`Run ${runId} has no events`);
      return { runId, agents, events, finalScores };
    },
  });

  const metrics = createStep({
    id: 'compute-metrics',
    inputSchema: LoadedSchema,
    outputSchema: WithMetricsSchema,
    execute: async ({ inputData }) => ({
      ...inputData,
      metrics: computeStoredMetrics(inputData.events, inputData.agents, inputData.finalScores),
    }),
  });

  const anonymize = createStep({
    id: 'anonymize',
    inputSchema: WithMetricsSchema,
    outputSchema: WithPromptSchema,
    execute: async ({ inputData }) => ({
      ...inputData,
      ...buildReviewPrompt(inputData.events, inputData.metrics, inputData.agents, deps.random),
    }),
  });

  const review = createStep({
    id: 'review',
    inputSchema: WithPromptSchema,
    outputSchema: WithReviewSchema,
    execute: async ({ inputData }) => {
      // All judges read the identical prompt in parallel so the route stays within maxDuration.
      const judgeRaws = await Promise.all(deps.judges().map((j) => runJudge(inputData.runId, j, inputData.prompt)));
      if (!judgeRaws.some((r) => r.status === 'ok')) {
        throw new Error(`Every judge failed: ${judgeRaws.map((r) => `${r.spec.id}: ${r.status === 'failed' ? r.error : ''}`).join('; ')}`);
      }
      return { ...inputData, judgeRaws };
    },
  });

  const dropBadCitations = createStep({
    id: 'drop-bad-citations',
    inputSchema: WithReviewSchema,
    outputSchema: FilteredSchema,
    execute: async ({ inputData: { runId, metrics, events, groupMap, judgeRaws } }) => {
      // Every judge's claims go through the same citation filter (scoreJudges -> filterClaims).
      const ensemble = buildEnsemble(scoreJudges(judgeRaws, events, groupMap, filterClaims), groupMap);
      const primary = ensemble.judges.find((j) => j.id === ensemble.primaryJudge);
      if (!primary || primary.status !== 'ok') throw new Error('No successful judge to store as the run review');
      for (const j of ensemble.judges) {
        if (j.status === 'ok') console.log(`[analyze ${runId}] judge ${j.id}: dropped ${j.droppedClaims} claim(s) with bad citations`);
      }
      console.log(`[analyze ${runId}] ensemble: ${ensemble.nJudges}/${ensemble.judges.length} judges; ${ensemble.consensusClaims.length} consensus claim(s)`);
      return {
        runId,
        metrics,
        stored: {
          summary: primary.summary,
          claims: primary.claims,
          limitations: primary.limitations,
          droppedClaims: primary.droppedClaims,
          groupMap,
          ensemble,
        },
      };
    },
  });

  const save = createStep({
    id: 'save',
    inputSchema: FilteredSchema,
    outputSchema: ResultSchema,
    execute: async ({ inputData: { runId, metrics, stored } }) => {
      await deps.save(runId, metrics, stored);
      return {
        runId,
        summary: stored.summary,
        claims: stored.claims.length,
        droppedClaims: stored.droppedClaims,
      };
    },
  });

  return createWorkflow({
    id: 'analyze-run',
    inputSchema: z.object({ runId: z.string() }),
    outputSchema: ResultSchema,
  })
    .then(load)
    .then(metrics)
    .then(anonymize)
    .then(review)
    .then(dropBadCitations)
    .then(save)
    .commit();
}
