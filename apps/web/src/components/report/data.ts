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
import { relabelForDisplay } from '../../mastra/anonymize';
import { labelModeOf, monitoringOf, runModeOf, wealthVisibilityOf } from '../../mastra/hierarchy';
import { buildJudgeChecks } from './judge-check';
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
  config?: { wealth_visibility?: string; mode?: string; label_mode?: string; monitoring?: string; label_mapping?: Record<string, string> | null };
  status?: string;
  storedMetrics?: RunMetrics & { byCompany?: Record<string, RunMetrics> };
  /** runs.config.mode, e.g. 'live-model-relay' or 'deterministic-stub'; 'unknown' when not recorded. */
  mode?: string;
  /** Normalized visibility; legacy runs use the original private default. */
  wealthVisibility?: string;
  /** 'true' | 'swapped'; legacy runs = 'true'. */
  labelMode?: string;
  /** 'standard' | 'unmonitored'; legacy runs = 'standard'. */
  monitoring?: string;
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
    metrics: r.storedMetrics ?? computeRunMetrics(r.events, r.agents),
    byCompany: r.storedMetrics?.byCompany ?? computeCompanyMetrics(r.events, r.agents),
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

function realReview(runs: LoadedRun[], reviews: NeonReport['reviews'], extras: NonNullable<NeonReport['extras']>): ReportReview {
  // Stored reviews use the anonymized labels the judge saw ("Group 2"); map them back with each run's own groupMap.
  const show = (runId: string, text: string) => {
    const map = extras.get(runId)?.groupMap;
    return map ? relabelForDisplay(text, map) : text;
  };
  const reviewed = runs.filter((r) => reviews.has(r.id));
  const single = reviewed.length === 1 ? { ...reviews.get(reviewed[0]!.id)!, summary: show(reviewed[0]!.id, reviews.get(reviewed[0]!.id)!.summary) } : undefined;
  const summary =
    single?.summary ??
    `Opus reviews for ${reviewed.length} of ${runs.length} runs, shown together. Runs without a stored review contribute no claims.`;
  const limitations = [...new Set(reviewed.flatMap((r) => reviews.get(r.id)!.limitations.map((l) => show(r.id, l))))];
  return {
    isSample: false,
    summary: reviewed.length > 1 ? `${summary}\n\n${reviewed.map((r) => show(r.id, reviews.get(r.id)!.summary)).join('\n\n')}` : summary,
    claims: reviewed.flatMap((r) =>
      reviewClaimsFor(r, reviews.get(r.id)!.claims.map((c) => ({ ...c, text: show(r.id, c.text) }))),
    ),
    limitations,
  };
}

const modeOf = (r: LoadedRun) => r.mode ?? runModeOf(r.config);
const visibilityOf = (r: LoadedRun) => r.wealthVisibility ?? wealthVisibilityOf(r.config);
const labelModeOfRun = (r: LoadedRun) => (r.labelMode === 'swapped' ? 'swapped' : r.labelMode === 'true' ? 'true' : labelModeOf(r.config));
const monitoringOfRun = (r: LoadedRun) => (r.monitoring === 'unmonitored' ? 'unmonitored' : r.monitoring === 'standard' ? 'standard' : monitoringOf(r.config));
/** '' for default settings, so historical group keys (`mode/wealth`) are unchanged. */
const settingsSuffix = (labelMode: string, monitoring: string) =>
  `${labelMode === 'swapped' ? '/swapped' : ''}${monitoring === 'unmonitored' ? '/unmonitored' : ''}`;
const groupKey = (r: LoadedRun) => `${modeOf(r)}/${visibilityOf(r)}${settingsSuffix(labelModeOfRun(r), monitoringOfRun(r))}`;

function groupLabel(mode: string, visibility: string, source: ReportData['source'], labelMode = 'true', monitoring = 'standard'): string {
  const who = source === 'mock' ? 'Mock (scripted stubs)' : isStubMode(mode) ? 'Stub agents' : mode === LIVE_MODE ? 'Live models' : `Mode: ${mode}`;
  const wealth = visibility === 'unrecorded' ? 'wealth visibility unrecorded' : `${visibility} wealth`;
  const extras = `${labelMode === 'swapped' ? ' · swapped labels' : ''}${monitoring === 'unmonitored' ? ' · told unmonitored' : ''}`;
  return `${who} · ${wealth}${extras}`;
}

/** One entry per (mode, wealth visibility) present, live groups first, then by run count. */
function groupsOf(runs: LoadedRun[], source: ReportData['source']): RunGroup[] {
  const byKey = new Map<string, LoadedRun[]>();
  for (const r of runs) byKey.set(groupKey(r), [...(byKey.get(groupKey(r)) ?? []), r]);
  return [...byKey.entries()]
    .map(([key, list]) => {
      const mode = modeOf(list[0]!);
      const wealthVisibility = visibilityOf(list[0]!);
      const labelMode = labelModeOfRun(list[0]!);
      const monitoring = monitoringOfRun(list[0]!);
      return {
        key,
        mode,
        wealthVisibility,
        labelMode,
        monitoring,
        isStub: source === 'mock' || isStubMode(mode),
        labeledRuns: list.filter((r) => r.condition === 'LABELED').length,
        blindRuns: list.filter((r) => r.condition === 'BLIND').length,
        label: groupLabel(mode, wealthVisibility, source, labelMode, monitoring),
      };
    })
    .sort((a, b) => Number(a.isStub) - Number(b.isStub) || b.labeledRuns + b.blindRuns - (a.labeledRuns + a.blindRuns));
}

/**
 * Default group: live models with the most common wealth visibility among live runs (ties: more runs).
 * Without live runs, the group with the most runs.
 */
function defaultGroup(all: RunGroup[]): RunGroup {
  // Default-settings runs come first; swapped-label / unmonitored groups are only shown when selected or alone.
  const standard = all.filter((g) => (g.labelMode ?? 'true') === 'true' && (g.monitoring ?? 'standard') === 'standard');
  const groups = standard.length > 0 ? standard : all;
  const live = groups.filter((g) => !g.isStub);
  if (live.length === 0) return groups[0]!;
  const runsByVisibility = new Map<string, number>();
  for (const g of live) runsByVisibility.set(g.wealthVisibility, (runsByVisibility.get(g.wealthVisibility) ?? 0) + g.labeledRuns + g.blindRuns);
  const [visibility] = [...runsByVisibility.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return live.filter((g) => g.wealthVisibility === visibility).sort((a, b) => Number(b.mode === LIVE_MODE) - Number(a.mode === LIVE_MODE) || b.labeledRuns + b.blindRuns - (a.labeledRuns + a.blindRuns))[0]!;
}

function assemble(source: ReportData['source'], allRuns: LoadedRun[], review: (runs: LoadedRun[]) => ReportReview, requested?: string, judge: (runs: LoadedRun[]) => ReportData['judgeChecks'] = () => []): ReportData {
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
  return { source, group, groups, labelEffect, conditions, review: review(runs), judgeChecks: judge(runs) };
}

function mockReport(): ReportData {
  return assemble('mock', [parseMock(labeledRun), parseMock(blindRun)], sampleReview);
}

export interface ReportOptions { runId?: string; wealthVisibility?: string; mode?: string; mock?: boolean; group?: string; }
const emptyReview: ReportReview = {isSample:false,summary:'No stored review is available.',claims:[],limitations:[]};

/** Explicit group selection never falls back to a different experiment. */
export function selectReportRuns(runs: LoadedRun[], options: ReportOptions): LoadedRun[] {
  if (options.runId) return runs.filter(r => r.id === options.runId);
  if (options.group) return runs.filter(r => groupKey(r) === options.group);
  const groups = groupsOf(runs, 'neon');
  const fallback = groups.length ? defaultGroup(groups) : undefined;
  const wealth = options.wealthVisibility ?? fallback?.wealthVisibility ?? 'private';
  const mode = options.mode ?? fallback?.mode ?? 'unknown';
  const labelMode = fallback?.labelMode ?? 'true';
  const monitoring = fallback?.monitoring ?? 'standard';
  return runs.filter(r => visibilityOf(r) === wealth && modeOf(r) === mode && labelModeOfRun(r) === labelMode && monitoringOfRun(r) === monitoring);
}

function emptyReport(state: ReportData['state'], message: string, options: ReportOptions = {}): ReportData {
  const [groupMode, groupWealth] = options.group?.split('/') ?? [];
  const mode = options.mode ?? groupMode ?? 'unknown';
  const wealthVisibility = options.wealthVisibility ?? groupWealth ?? 'unknown';
  return {
    source: 'neon', state, message,
    selection: {runId: options.runId, wealthVisibility, mode},
    group: {key: `${mode}/${wealthVisibility}`, mode, wealthVisibility, isStub: isStubMode(mode), labeledRuns: 0, blindRuns: 0, label: groupLabel(mode, wealthVisibility, 'neon')},
    groups: [], labelEffect: labelEffectFromValues([], []), conditions: {}, review: emptyReview, judgeChecks: [],
  };
}

export function assembleNeonReport(neon: NeonReport, options: ReportOptions): ReportData {
  const runs = selectReportRuns(neon.runs, options);
  const first = runs[0];
  const groups = groupsOf(neon.runs, 'neon');
  if (!first) return {...emptyReport('empty', options.runId ? 'Run not found in the reporting database yet. Open the live viewer to check initialization.' : 'No completed runs match this report selection.', options), groups};
  const selection = {runId: options.runId, wealthVisibility: visibilityOf(first), mode: modeOf(first)};
  if (first.status !== 'done') return {
    ...emptyReport(first.status === 'failed' ? 'failed' : 'pending', first.status === 'failed' ? 'This run stopped before completion; no completed report is available.' : 'This run is still in progress. Its report will appear after completion.', {...options, ...selection}), groups,
  };
  const extras = neon.extras ?? new Map();
  const reviewed = runs.filter(r => neon.reviews.has(r.id));
  const review = realReview(runs, neon.reviews, extras);
  if (!reviewed.length) review.summary = 'Metrics are available. No persisted model review is available yet; review generation may be pending or failed. Check the run status for delivery details.';
  // The selected set is already one compatible group (or one run). New measures are
  // derived from these same events; the original persisted metrics remain authoritative.
  const data = assemble('neon', runs, () => review, undefined, selected => buildJudgeChecks(selected, extras));
  return {...data, groups, state: 'ready', selection, pendingReview: reviewed.length < runs.length};
}

/** Explicit fixtures only; database errors never masquerade as a mock report. */
export async function loadReportData(options: ReportOptions = {}): Promise<ReportData> {
  if (options.mock) return mockReport();
  try {
    const neon = await loadNeonReport(options.runId);
    if (!neon) return emptyReport('error', 'Reporting database is not configured. Use the explicitly labeled fixture report for an offline preview.', options);
    return assembleNeonReport(neon, options);
  } catch {
    return emptyReport('error', 'The reporting database could not be read. Retry shortly; no fixture data has been substituted.', options);
  }
}
