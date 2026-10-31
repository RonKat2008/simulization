import { z } from 'zod';
import {
  EventSchema,
  aggregateMetrics,
  computeCompanyMetrics,
  computeRunMetrics,
  type Condition,
  type Event,
  type RunMetrics,
} from '@simulization/shared';
import labeledRun from '@simulization/shared/mock/mock-run.labeled.json';
import blindRun from '@simulization/shared/mock/mock-run.blind.json';
import { buildSampleClaims } from './sample-claims';
import { toEvidence, type AgentLookup } from './summarize';
import type { ConditionReport, ReportClaim, ReportData, ReportReview } from './types';

/** A finished run as the report needs it. Neon rows map onto this one-to-one. */
export interface LoadedRun {
  id: string;
  condition: Condition;
  agents: { id: string; name: string; company: string }[];
  events: Event[];
  finalScores: Record<string, number>;
}

const MockSchema = z.object({
  run: z.object({ id: z.string(), condition: z.enum(['LABELED', 'BLIND']), finalScores: z.record(z.string(), z.number()) }),
  agents: z.array(z.object({ id: z.string(), name: z.string(), company: z.string() })),
  events: z.array(EventSchema),
});

function parseMock(raw: unknown): LoadedRun {
  const m = MockSchema.parse(raw);
  return { id: m.run.id, condition: m.run.condition, agents: m.agents, events: m.events, finalScores: m.run.finalScores };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function conditionReport(condition: Condition, runs: LoadedRun[]): ConditionReport {
  const perRun = runs.map((r) => ({
    metrics: computeRunMetrics(r.events, r.agents),
    byCompany: computeCompanyMetrics(r.events, r.agents),
    run: r,
  }));
  const companies = [...new Set(runs.flatMap((r) => r.agents.map((a) => a.company)))].sort();
  const agg = (ms: RunMetrics[]) => aggregateMetrics(ms.map((metrics) => ({ condition, metrics })))[condition]!.mean;

  const byCompany = Object.fromEntries(
    companies.map((c) => [c, agg(perRun.map((p) => p.byCompany[c]).filter((m): m is RunMetrics => m !== undefined))]),
  );
  const meanScore = Object.fromEntries(
    companies.map((c) => [
      c,
      mean(runs.map((r) => mean(r.agents.filter((a) => a.company === c).map((a) => r.finalScores[a.id] ?? 0)))),
    ]),
  );
  return {
    condition,
    runs: runs.length,
    runIds: runs.map((r) => r.id),
    mean: agg(perRun.map((p) => p.metrics)),
    byCompany,
    meanScore,
  };
}

function claimsFor(run: LoadedRun): ReportClaim[] {
  const agents: AgentLookup = new Map(run.agents.map((a) => [a.id, a]));
  const names = new Map(run.agents.map((a) => [a.id, a.name]));
  const byId = new Map(run.events.map((e) => [e.id, e]));
  return buildSampleClaims(run.events, names).map((c, i) => {
    const found = c.eventIds.map((id) => byId.get(id)).filter((e): e is Event => e !== undefined);
    return {
      key: `${run.id}-${i}`,
      section: c.section,
      text: c.text,
      condition: run.condition,
      runId: run.id,
      evidence: found.map((e) => toEvidence(e, agents)),
      missingIds: c.eventIds.filter((id) => !byId.has(id)),
    };
  });
}

function sampleReview(runs: LoadedRun[]): ReportReview {
  return {
    isSample: true,
    summary:
      'No Opus review exists for these runs yet. The claims below are placeholders built from simulator flags on real mock events, so you can see how evidence is cited. Run analysis to generate the real review.',
    claims: runs.flatMap(claimsFor),
    limitations: [
      'One run per condition: nothing here is a statistical result.',
      'Mock runs use scripted stub behavior, not real model agents.',
    ],
  };
}

/**
 * The single data seam for /report.
 *
 * Today: schema-validated mock runs, no DB or env needed (works offline for the demo).
 * Later: replace the body with a Neon read and return the same ReportData. The pieces:
 *   - runs/events/agents: `loadRunData(runId)` + `getRun(runId)` in src/mastra/db.ts, mapped to LoadedRun
 *   - metrics: either recompute here (conditionReport) or read the stored `metrics` table rows
 *   - review: the `reviews` row (kind 'run'), resolve eventIds with the byId lookup in claimsFor
 *     and set isSample: false.
 */
export async function loadReportData(): Promise<ReportData> {
  const runs = [parseMock(labeledRun), parseMock(blindRun)];
  const conditions: ReportData['conditions'] = {};
  for (const condition of ['LABELED', 'BLIND'] as const) {
    const ofCondition = runs.filter((r) => r.condition === condition);
    if (ofCondition.length > 0) conditions[condition] = conditionReport(condition, ofCondition);
  }
  return { source: 'mock', conditions, review: sampleReview(runs) };
}
