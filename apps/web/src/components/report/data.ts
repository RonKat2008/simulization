import { z } from 'zod';
import {
  EventSchema,
  aggregateMetrics,
  computeCompanyMetrics,
  computeRunMetrics,
  powerStructure,
  type Condition,
  type Event,
  type Review,
  type RunMetrics,
} from '@simulization/shared';
import labeledRun from '@simulization/shared/mock/mock-run.labeled.json';
import blindRun from '@simulization/shared/mock/mock-run.blind.json';
import { buildSampleClaims } from './sample-claims';
import { toEvidence, type AgentLookup } from './summarize';
import { loadNeonReport, type NeonReport } from './neon';
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
    power: runs.map((r) => powerStructure(r.events, r.agents, r.finalScores)),
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

function reviewClaimsFor(run: LoadedRun, claims: Review['claims']): ReportClaim[] {
  const agents: AgentLookup = new Map(run.agents.map((a) => [a.id, a]));
  const byId = new Map(run.events.map((e) => [e.id, e]));
  return claims.map((c, i) => {
    const found = c.eventIds.map((id) => byId.get(id)).filter((e): e is Event => e !== undefined);
    return {
      key: `${run.id}-r${i}`,
      section: c.section,
      text: c.text,
      condition: run.condition,
      runId: run.id,
      evidence: found.map((e) => toEvidence(e, agents)),
      missingIds: c.eventIds.filter((id) => !byId.has(id)),
    };
  });
}

function realReview(runs: LoadedRun[], reviews: NeonReport['reviews']): ReportReview {
  const reviewed = runs.filter((r) => reviews.has(r.id));
  const single = reviewed.length === 1 ? reviews.get(reviewed[0]!.id)! : undefined;
  const summary =
    single?.summary ??
    `Opus reviews for ${reviewed.length} of ${runs.length} runs, shown together. Runs without a stored review contribute no claims.`;
  const limitations = [...new Set(reviewed.flatMap((r) => reviews.get(r.id)!.limitations))];
  return {
    isSample: false,
    summary: reviewed.length > 1 ? `${summary}\n\n${reviewed.map((r) => reviews.get(r.id)!.summary).join('\n\n')}` : summary,
    claims: reviewed.flatMap((r) => reviewClaimsFor(r, reviews.get(r.id)!.claims)),
    limitations,
  };
}

function assemble(source: ReportData['source'], runs: LoadedRun[], review: ReportReview): ReportData {
  const conditions: ReportData['conditions'] = {};
  for (const condition of ['LABELED', 'BLIND'] as const) {
    const ofCondition = runs.filter((r) => r.condition === condition);
    if (ofCondition.length > 0) conditions[condition] = conditionReport(condition, ofCondition);
  }
  return { source, conditions, review };
}

function mockReport(): ReportData {
  const runs = [parseMock(labeledRun), parseMock(blindRun)];
  return assemble('mock', runs, sampleReview(runs));
}

/**
 * The single data seam for /report.
 *
 * With DATABASE_URL set: completed runs from Neon (see neon.ts), metrics recomputed here with the
 * shared functions, review = latest stored kind 'run' review per run (isSample false). If no run has
 * a stored review yet, claims are the flagged-event placeholders (isSample true) over the real events.
 * Falls back to the schema-validated mock for the whole report when DATABASE_URL is unset, the query
 * throws, or either condition has no completed run. Never throws.
 */
export async function loadReportData(): Promise<ReportData> {
  try {
    const neon = await loadNeonReport();
    if (neon) {
      const has = (c: Condition) => neon.runs.some((r) => r.condition === c);
      if (has('LABELED') && has('BLIND')) {
        const review = neon.reviews.size > 0 ? realReview(neon.runs, neon.reviews) : sampleReview(neon.runs);
        return assemble('neon', neon.runs, review);
      }
      console.error(
        `[report] Neon has ${neon.runs.filter((r) => r.condition === 'LABELED').length} LABELED and ${neon.runs.filter((r) => r.condition === 'BLIND').length} BLIND completed runs; need both. Showing mock data.`,
      );
    }
  } catch (err) {
    console.error('[report] Neon read failed; showing mock data', err);
  }
  return mockReport();
}
