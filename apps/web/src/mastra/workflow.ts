// Owner: E. Post-run workflow: load, metrics, anonymize, review, drop bad citations, save.
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { EventSchema, ReviewSchema, type Event } from '@simulization/shared';
import type { AnonymizableAgent } from './anonymize';
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
  load: (runId: string) => Promise<{ agents: AnonymizableAgent[]; events: Event[] }>;
  review: Reviewer;
  save: (runId: string, metrics: StoredMetrics, review: StoredReview) => Promise<void>;
  random?: () => number;
}

const AgentSchema = z.object({ id: z.string(), company: z.string(), provider: z.string(), model: z.string() });
const LoadedSchema = z.object({
  runId: z.string(),
  agents: z.array(AgentSchema),
  events: z.array(EventSchema),
});
const WithMetricsSchema = LoadedSchema.extend({ metrics: z.custom<StoredMetrics>() });
const WithPromptSchema = WithMetricsSchema.extend({
  prompt: z.string(),
  groupMap: z.record(z.string(), z.string()),
});
const WithReviewSchema = WithPromptSchema.extend({ review: ReviewSchema });
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
  const load = createStep({
    id: 'load-run',
    inputSchema: z.object({ runId: z.string() }),
    outputSchema: LoadedSchema,
    execute: async ({ inputData: { runId } }) => {
      const { agents, events } = await deps.load(runId);
      if (events.length === 0) throw new Error(`Run ${runId} has no events`);
      return { runId, agents, events };
    },
  });

  const metrics = createStep({
    id: 'compute-metrics',
    inputSchema: LoadedSchema,
    outputSchema: WithMetricsSchema,
    execute: async ({ inputData }) => ({
      ...inputData,
      metrics: computeStoredMetrics(inputData.events, inputData.agents),
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
    execute: async ({ inputData }) => ({ ...inputData, review: await deps.review(inputData.prompt) }),
  });

  const dropBadCitations = createStep({
    id: 'drop-bad-citations',
    inputSchema: WithReviewSchema,
    outputSchema: FilteredSchema,
    execute: async ({ inputData: { runId, metrics, events, groupMap, review } }) => {
      const filtered = filterClaims(review, new Set(events.map((e) => e.id)));
      console.log(`[analyze ${runId}] dropped ${filtered.droppedClaims} claim(s) with bad citations`);
      return {
        runId,
        metrics,
        stored: { ...filtered.review, droppedClaims: filtered.droppedClaims, groupMap },
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
