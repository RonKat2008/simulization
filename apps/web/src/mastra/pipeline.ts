// Owner: E. The analysis steps as plain functions, so they run offline with an injected reviewer.
import { z } from 'zod';
import {
  ReviewSchema,
  aggregateMetrics,
  computeCompanyMetrics,
  computeRunMetrics,
  type Condition,
  type Event,
  type Review,
  type RunMetrics,
} from '@simulization/shared';
import { assignGroups, createAnonymizer, relabelGroups, type AnonymizableAgent, type GroupMap } from './anonymize';

export type Reviewer = (prompt: string) => Promise<Review>;

/** RunMetrics for the whole run, plus the same metrics scoped to each company. */
export type StoredMetrics = RunMetrics & { byCompany: Record<string, RunMetrics> };

export const StoredReviewSchema = ReviewSchema.extend({
  droppedClaims: z.number().int(),
  groupMap: z.record(z.string(), z.string()),
});
export type StoredReview = z.infer<typeof StoredReviewSchema>;

export interface SkippedRun {
  runId: string;
  reason: string;
}

export interface StoredSynthesis extends StoredReview {
  label: 'early signal';
  runIds: string[];
  skippedRuns: SkippedRun[];
  aggregated: ReturnType<typeof aggregateMetrics>;
}

export function computeStoredMetrics(events: Event[], agents: AnonymizableAgent[]): StoredMetrics {
  return { ...computeRunMetrics(events, agents), byCompany: computeCompanyMetrics(events, agents) };
}

/** One event per line, renamed so the prompt only ever speaks of groups. */
function toPromptLine(e: Event): string {
  return JSON.stringify({
    id: e.id,
    round: e.round,
    phase: e.phase,
    type: e.type,
    actor: e.actorId,
    actorGroup: e.actorCompany,
    target: e.targetId,
    targetGroup: e.targetCompany,
    channel: e.channel,
    text: e.text,
    privatePlan: e.privatePlan,
    claim: e.claim,
    groundTruth: e.groundTruth,
    flags: e.flags,
  });
}

export function buildReviewPrompt(
  events: Event[],
  metrics: StoredMetrics,
  agents: AnonymizableAgent[],
  random: () => number = Math.random,
): { prompt: string; groupMap: GroupMap } {
  const { groupMap, scrubEvent, scrubDeep } = createAnonymizer(agents, random);
  const log = events.map((e) => toPromptLine(scrubEvent(e))).join('\n');
  const { byCompany, ...overall } = metrics;
  const promptMetrics = scrubDeep({ ...overall, byGroup: byCompany });
  const prompt = `Computed metrics (authoritative):\n${JSON.stringify(promptMetrics)}\n\nEvent log (JSON lines):\n${log}`;
  return { prompt, groupMap };
}

/** A claim survives only if it cites at least one event and every citation exists. */
export function filterClaims(review: Review, validIds: Set<string>): { review: Review; droppedClaims: number } {
  const claims = review.claims.filter(
    (c) => c.eventIds.length > 0 && c.eventIds.every((id) => validIds.has(id)),
  );
  return { review: { ...review, claims }, droppedClaims: review.claims.length - claims.length };
}

export interface SynthesisRunInput {
  id: string;
  condition: Condition;
  status: string;
  metrics: unknown;
  review: unknown;
}

export interface SynthesisDeps {
  loadRuns: () => Promise<SynthesisRunInput[]>;
  loadEventIds: (runIds: string[]) => Promise<string[]>;
  synthesize: Reviewer;
  save: (content: StoredSynthesis) => Promise<void>;
  random?: () => number;
}

export class NoReviewsError extends Error {
  constructor(public skippedRuns: SkippedRun[]) {
    super('No run has a stored review and metrics to synthesize.');
  }
}

/**
 * Each review uses its own random group order, so "Group 1" means different companies in
 * different runs. Reviews are moved onto one shared labeling before the agent reads them.
 */
export function buildSynthesisPrompt(
  runs: { id: string; condition: Condition; review: StoredReview }[],
  aggregated: StoredSynthesis['aggregated'],
  sharedGroups: GroupMap,
): string {
  const sharedGroupOf = new Map(Object.entries(sharedGroups).map(([group, company]) => [company, group]));
  const labelOf = (company: string) => {
    const group = sharedGroupOf.get(company) ?? company;
    return { group, idPrefix: group.replace('Group ', 'G') };
  };
  const reviews = runs.map(({ id, condition, review }) => {
    const relabel = (text: string) => relabelGroups(text, review.groupMap, labelOf);
    return {
      runId: id,
      condition,
      summary: relabel(review.summary),
      claims: review.claims.map((c) => ({ ...c, text: relabel(c.text) })),
      limitations: review.limitations.map(relabel),
    };
  });
  return `Aggregated metrics by condition (authoritative):\n${JSON.stringify(aggregated)}\n\nRun reviews (JSON lines):\n${reviews
    .map((r) => JSON.stringify(r))
    .join('\n')}`;
}

export async function runSynthesis(deps: SynthesisDeps): Promise<StoredSynthesis> {
  const included: { id: string; condition: Condition; review: StoredReview; metrics: StoredMetrics }[] = [];
  const skippedRuns: SkippedRun[] = [];

  for (const run of await deps.loadRuns()) {
    const skip = (reason: string) => skippedRuns.push({ runId: run.id, reason });
    if (run.status !== 'done') skip(`run status is ${run.status}`);
    else if (run.review == null) skip('run has no stored review');
    else if (run.metrics == null) skip('run has no stored metrics');
    else {
      const review = StoredReviewSchema.safeParse(run.review);
      if (!review.success) skip('stored review does not match the expected shape');
      else included.push({ ...run, review: review.data, metrics: run.metrics as StoredMetrics });
    }
  }
  if (included.length === 0) throw new NoReviewsError(skippedRuns);

  const aggregated = aggregateMetrics(included.map((r) => ({ condition: r.condition, metrics: r.metrics })));
  const companies = included.flatMap((r) => Object.values(r.review.groupMap));
  const groupMap = assignGroups(companies, deps.random);
  const runIds = included.map((r) => r.id);

  const raw = await deps.synthesize(buildSynthesisPrompt(included, aggregated, groupMap));
  const { review, droppedClaims } = filterClaims(raw, new Set(await deps.loadEventIds(runIds)));
  console.log(`[synthesis] dropped ${droppedClaims} claim(s) with bad citations; ${skippedRuns.length} run(s) skipped`);

  const content: StoredSynthesis = {
    ...review,
    droppedClaims,
    groupMap,
    label: 'early signal',
    runIds,
    skippedRuns,
    aggregated,
  };
  await deps.save(content);
  return content;
}
