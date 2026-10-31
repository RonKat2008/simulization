import { z } from 'zod';
import {
  EventSchema,
  aggregateMetrics,
  computeCompanyMetrics,
  computeRunMetrics,
  ethicality,
  inGroupFavoritism,
  labelEffectFromValues,
  powerStructure,
  type EthicalityBucket,
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
import type { ConditionReport, EthicalitySplit, Frac, ReportClaim, ReportData, ReportReview, RunCooperation, RunEthicality, RunGroup } from './types';

/** A finished run as the report needs it. Neon rows map onto this one-to-one. */
export interface LoadedRun {
  id: string;
  condition: Condition;
  agents: { id: string; name: string; company: string }[];
  events: Event[];
  finalScores: Record<string, number>;
  /** runs.config.mode, e.g. 'live-model-relay' or 'deterministic-stub'; 'unknown' when not recorded. */
  mode: string;
  /** runs.config.wealth_visibility; 'unrecorded' for older runs. */
  wealthVisibility: string;
}

/** The mock files are scripted stub runs with no recorded config. */
const MOCK_MODE = 'deterministic-stub';
const LIVE_MODE = 'live-model-relay';
const isStubMode = (mode: string) => mode.includes('stub');

const MockSchema = z.object({
  run: z.object({ id: z.string(), condition: z.enum(['LABELED', 'BLIND']), finalScores: z.record(z.string(), z.number()) }),
  agents: z.array(z.object({ id: z.string(), name: z.string(), company: z.string() })),
  events: z.array(EventSchema),
});

function parseMock(raw: unknown): LoadedRun {
  const m = MockSchema.parse(raw);
  return {
    id: m.run.id,
    condition: m.run.condition,
    agents: m.agents,
    events: m.events,
    finalScores: m.run.finalScores,
    mode: MOCK_MODE,
    wealthVisibility: 'unrecorded',
  };
}

const frac = (good: number, total: number): Frac => ({ good, total, rate: total > 0 ? good / total : null });
const ethFrac = (b: EthicalityBucket): Frac => frac(b.ethical, b.total);

function runCooperation(r: LoadedRun): RunCooperation {
  const f = inGroupFavoritism(r.events, r.agents);
  const { inGroup: i, outGroup: o } = f.cooperation;
  return { runId: r.id, crIn: frac(i.cooperative, i.total), crOut: frac(o.cooperative, o.total), favoritism: f.value };
}

function runEthicality(r: LoadedRun): RunEthicality {
  const e = ethicality(r.events, r.agents);
  return { runId: r.id, overall: ethFrac(e.overall), inGroup: ethFrac(e.inGroup), outGroup: ethFrac(e.outGroup) };
}

function poolEthicality(list: RunEthicality[]): EthicalitySplit {
  const pool = (pick: (x: RunEthicality) => Frac) =>
    frac(list.reduce((s, x) => s + pick(x).good, 0), list.reduce((s, x) => s + pick(x).total, 0));
  return { overall: pool((x) => x.overall), inGroup: pool((x) => x.inGroup), outGroup: pool((x) => x.outGroup) };
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
  const eth = runs.map(runEthicality);
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
    cooperation: runs.map(runCooperation),
    ethicality: { perRun: eth, pooled: poolEthicality(eth) },
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

const groupKey = (r: Pick<LoadedRun, 'mode' | 'wealthVisibility'>) => `${r.mode}/${r.wealthVisibility}`;

function groupLabel(mode: string, visibility: string, source: ReportData['source']): string {
  const who = source === 'mock' ? 'Mock (scripted stubs)' : isStubMode(mode) ? 'Stub agents' : mode === LIVE_MODE ? 'Live models' : `Mode: ${mode}`;
  const wealth = visibility === 'unrecorded' ? 'wealth visibility unrecorded' : `${visibility} wealth`;
  return `${who} · ${wealth}`;
}

/** One entry per (mode, wealth visibility) present, live groups first, then by run count. */
function groupsOf(runs: LoadedRun[], source: ReportData['source']): RunGroup[] {
  const byKey = new Map<string, LoadedRun[]>();
  for (const r of runs) byKey.set(groupKey(r), [...(byKey.get(groupKey(r)) ?? []), r]);
  return [...byKey.entries()]
    .map(([key, list]) => {
      const { mode, wealthVisibility } = list[0]!;
      return {
        key,
        mode,
        wealthVisibility,
        isStub: source === 'mock' || isStubMode(mode),
        labeledRuns: list.filter((r) => r.condition === 'LABELED').length,
        blindRuns: list.filter((r) => r.condition === 'BLIND').length,
        label: groupLabel(mode, wealthVisibility, source),
      };
    })
    .sort((a, b) => Number(a.isStub) - Number(b.isStub) || b.labeledRuns + b.blindRuns - (a.labeledRuns + a.blindRuns));
}

/**
 * Default group: live models with the most common wealth visibility among live runs (ties: more runs).
 * Without live runs, the group with the most runs.
 */
function defaultGroup(groups: RunGroup[]): RunGroup {
  const live = groups.filter((g) => !g.isStub);
  if (live.length === 0) return groups[0]!;
  const runsByVisibility = new Map<string, number>();
  for (const g of live) runsByVisibility.set(g.wealthVisibility, (runsByVisibility.get(g.wealthVisibility) ?? 0) + g.labeledRuns + g.blindRuns);
  const [visibility] = [...runsByVisibility.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return live.filter((g) => g.wealthVisibility === visibility).sort((a, b) => Number(b.mode === LIVE_MODE) - Number(a.mode === LIVE_MODE) || b.labeledRuns + b.blindRuns - (a.labeledRuns + a.blindRuns))[0]!;
}

function assemble(source: ReportData['source'], allRuns: LoadedRun[], review: (runs: LoadedRun[]) => ReportReview, requested?: string): ReportData {
  const groups = groupsOf(allRuns, source);
  const group = groups.find((g) => g.key === requested) ?? defaultGroup(groups);
  const runs = allRuns.filter((r) => groupKey(r) === group.key);
  const conditions: ReportData['conditions'] = {};
  for (const condition of ['LABELED', 'BLIND'] as const) {
    const ofCondition = runs.filter((r) => r.condition === condition);
    if (ofCondition.length > 0) conditions[condition] = conditionReport(condition, ofCondition);
  }
  const values = (c: ConditionReport | undefined) => (c?.cooperation ?? []).map((x) => ({ runId: x.runId, value: x.favoritism }));
  const labelEffect = labelEffectFromValues(values(conditions.LABELED), values(conditions.BLIND));
  return { source, group, groups, labelEffect, conditions, review: review(runs) };
}

function mockReport(): ReportData {
  return assemble('mock', [parseMock(labeledRun), parseMock(blindRun)], sampleReview);
}

/**
 * The single data seam for /report.
 *
 * With DATABASE_URL set: completed runs from Neon (see neon.ts), split into groups by (mode, wealth
 * visibility) and never pooled across groups; one group is shown (`groupKeyParam`, else live models with
 * the most common visibility). Within the group, conditions present are reported (a single completed run
 * is enough; the label effect stays n/a until both conditions exist). Metrics recomputed here with the
 * shared functions, review = latest stored kind 'run' review per run (isSample false). If no run has
 * a stored review yet, claims are the flagged-event placeholders (isSample true) over the real events.
 * Falls back to the schema-validated mock for the whole report when DATABASE_URL is unset, the query
 * throws, or there is no completed run. Never throws.
 */
export async function loadReportData(groupKeyParam?: string): Promise<ReportData> {
  try {
    const neon = await loadNeonReport();
    if (neon && neon.runs.length > 0) {
      const review = (runs: LoadedRun[]) =>
        runs.some((r) => neon.reviews.has(r.id)) ? realReview(runs, neon.reviews) : sampleReview(runs);
      return assemble('neon', neon.runs, review, groupKeyParam);
    }
    if (neon) console.error('[report] Neon has no completed runs. Showing mock data.');
  } catch (err) {
    console.error('[report] Neon read failed; showing mock data', err);
  }
  return mockReport();
}
