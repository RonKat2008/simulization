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
  config?: { wealth_visibility?: string; mode?: string };
  status?: string;
  storedMetrics?: RunMetrics & { byCompany?: Record<string, RunMetrics> };
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
    metrics: r.storedMetrics ?? computeRunMetrics(r.events, r.agents),
    byCompany: r.storedMetrics?.byCompany ?? computeCompanyMetrics(r.events, r.agents),
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

export interface ReportOptions { runId?: string; wealthVisibility?: string; mode?: string; mock?: boolean; }
const emptyReview: ReportReview = {isSample:false,summary:'No stored review is available.',claims:[],limitations:[]};
export function selectReportRuns(runs: LoadedRun[], options: ReportOptions): LoadedRun[] {
  if(options.runId) return runs.filter(r=>r.id===options.runId);
  const latest=runs.at(-1);
  const wealth=options.wealthVisibility ?? latest?.config?.wealth_visibility ?? 'private';
  const mode=options.mode ?? latest?.config?.mode ?? 'unknown';
  return runs.filter(r=>(r.config?.wealth_visibility??'private')===wealth&&(r.config?.mode??'unknown')===mode);
}
export function assembleNeonReport(neon: NeonReport, options: ReportOptions): ReportData {
  const runs=selectReportRuns(neon.runs,options);
  const first=runs[0];
  const selection={runId:options.runId,wealthVisibility:first?.config?.wealth_visibility??options.wealthVisibility??(first?'private':'unknown'),mode:first?.config?.mode??options.mode??'unknown'};
  if(!runs.length)return {source:'neon',state:'empty',message:options.runId?'Run not found in the reporting database yet. Open the live viewer to check initialization.':'No completed runs match this report selection.',selection,conditions:{},review:emptyReview};
  if(first?.status!=='done')return {source:'neon',state:first?.status==='failed'?'failed':'pending',message:first?.status==='failed'?'This run stopped before completion; no completed report is available.':'This run is still in progress. Its report will appear after completion.',selection,conditions:{},review:emptyReview};
  const reviewed=runs.filter(r=>neon.reviews.has(r.id));
  const pendingReview=reviewed.length<runs.length;
  const review=realReview(runs,neon.reviews);
  if(!reviewed.length)review.summary='Metrics are available. No persisted model review is available yet; review generation may be pending or failed. Check the run status for delivery details.';
  return {...assemble('neon',runs,review),state:'ready',selection,pendingReview};
}
/** Explicit fixtures only; database errors never masquerade as a mock report. */
export async function loadReportData(options: ReportOptions = {}): Promise<ReportData> {
  if(options.mock)return mockReport();
  try {
    const neon=await loadNeonReport(options.runId);
    if(!neon)return {source:'neon',state:'error',message:'Reporting database is not configured. Use the explicitly labeled fixture report for an offline preview.',conditions:{},review:emptyReview};
    return assembleNeonReport(neon,options);
  }catch{
    return {source:'neon',state:'error',message:'The reporting database could not be read. Retry shortly; no fixture data has been substituted.',conditions:{},review:emptyReview};
  }
}
