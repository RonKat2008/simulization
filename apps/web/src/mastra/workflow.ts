// Owner: E. Post-run workflow: load, metrics, anonymize, review, drop bad citations, save.
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { EventSchema, ReviewSchema, type Event, type Review } from '@simulization/shared';
import type { AnonymizableAgent } from './anonymize';
import { buildCrossJudge, type CrossJudgeRaw } from './crossJudge';
import {
  StoredReviewSchema,
  buildReviewPrompt,
  computeStoredMetrics,
  filterClaims,
  type Reviewer,
  type StoredMetrics,
  type StoredReview,
} from './pipeline';

export interface AnalyzeDeps {
  load: (runId: string) => Promise<{
    agents: AnonymizableAgent[];
    events: Event[];
    finalScores?: Record<string, number> | null;
  }>;
  review: Reviewer;
  /** Name of the primary reviewer's model, used to find its home group in the cross-judge check. */
  reviewModel?: string;
  /** Cross-family second reviewer, resolved per run; null or absent skips the check. */
  crossReview?: () => { model: string; review: Reviewer } | null;
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
const CrossRawSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), model: z.string(), review: ReviewSchema }),
  z.object({ status: z.literal('failed'), model: z.string(), error: z.string() }),
]);
const WithReviewSchema = WithPromptSchema.extend({ review: ReviewSchema, crossRaw: CrossRawSchema.optional() });
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
  async function runCrossReview(runId: string, prompt: string): Promise<CrossJudgeRaw | undefined> {
    let reviewer: ReturnType<NonNullable<AnalyzeDeps['crossReview']>> = null;
    try {
      reviewer = deps.crossReview?.() ?? null;
      if (!reviewer) return undefined;
      return { status: 'ok', model: reviewer.model, review: await reviewer.review(prompt) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[analyze ${runId}] cross judge ${reviewer?.model ?? '(unresolved)'} failed; continuing without it:`, error);
      return { status: 'failed', model: reviewer?.model ?? 'unknown', error: message.slice(0, 500) };
    }
  }

  function buildCrossJudgeSafely(
    runId: string,
    raw: CrossJudgeRaw,
    primary: Review,
    events: Event[],
    groupMap: Record<string, string>,
  ) {
    try {
      const result = buildCrossJudge(raw, primary, deps.reviewModel ?? 'unknown', events, groupMap, filterClaims);
      if (result.status === 'ok') {
        console.log(`[analyze ${runId}] cross judge ${result.model}: dropped ${result.droppedClaims} claim(s); citation jaccard ${result.agreement.citations.jaccard.toFixed(2)}`);
      }
      return result;
    } catch (error) {
      console.error(`[analyze ${runId}] cross-judge agreement failed; continuing without it:`, error);
      return undefined;
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
      // The cross judge reads the identical prompt alongside Opus (not after it) so the route stays
      // within maxDuration. It never throws: a failure is recorded and the main analysis continues.
      const [review, crossRaw] = await Promise.all([
        deps.review(inputData.prompt),
        runCrossReview(inputData.runId, inputData.prompt),
      ]);
      return { ...inputData, review, crossRaw };
    },
  });

  const dropBadCitations = createStep({
    id: 'drop-bad-citations',
    inputSchema: WithReviewSchema,
    outputSchema: FilteredSchema,
    execute: async ({ inputData: { runId, metrics, events, groupMap, review, crossRaw } }) => {
      const filtered = filterClaims(review, new Set(events.map((e) => e.id)));
      console.log(`[analyze ${runId}] dropped ${filtered.droppedClaims} claim(s) with bad citations`);
      const crossJudge = crossRaw && buildCrossJudgeSafely(runId, crossRaw, filtered.review, events, groupMap);
      return {
        runId,
        metrics,
        stored: { ...filtered.review, droppedClaims: filtered.droppedClaims, groupMap, ...(crossJudge && { crossJudge }) },
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
