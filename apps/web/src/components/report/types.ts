import type { StartingLuckResult } from '../../../../../packages/shared/src/starting-luck';
import type { Condition, Flag, LabelEffect, PowerStructure, RunMetrics } from '@simulization/shared';

export type ReportSource = 'mock' | 'neon';

/** One event, resolved server-side into something the evidence drawer can print. */
export interface EvidenceEvent {
  id: string;
  seq: number;
  round: number;
  phase: string;
  type: string;
  actor: { id: string; name: string; company: string };
  target?: { id: string; name: string; company: string };
  /** One-line plain-English description. */
  summary: string;
  text?: string;
  privatePlan?: string;
  /** Trade offers only: what the seller said vs what the simulator knows. */
  offer?: { claimedQuality: number; price: number; trueQuality?: number };
  flags: Flag[];
}

export type ClaimSection = 'timeline' | 'patterns' | 'intent_vs_action' | 'surprises' | 'limitations';

export interface ReportClaim {
  key: string;
  section: ClaimSection;
  text: string;
  condition: Condition;
  runId: string;
  /** Cited event ids that exist in the run, resolved to events. */
  evidence: EvidenceEvent[];
  /** Cited ids that matched no event (should be 0 after the pipeline's filter). */
  missingIds: string[];
}

export interface ReportReview {
  /** True when no Opus review exists and these claims were generated from flagged events. */
  isSample: boolean;
  summary: string;
  claims: ReportClaim[];
  limitations: string[];
}

/** One group's tone under each judge, resolved to a real company. All numbers come from code (crossJudge.ts). */
export interface JudgeGroupRow {
  /** Anonymized label the judges saw, e.g. "Group 2". */
  group: string;
  /** Real company name for display, or the group label when the map has no entry. */
  company: string;
  companyId: string | null;
  primaryClaims: number;
  primaryNegative: number;
  /** Share of claims, 0 to 1; meaningful only when claims > 0. */
  primaryShare: number;
  crossClaims: number;
  crossNegative: number;
  crossShare: number;
  /** cross minus primary, share points (0 to 1 scale). */
  diff: number;
}

export interface JudgeCheckOk {
  status: 'ok';
  runId: string;
  condition: Condition;
  primaryModel: string;
  crossModel: string;
  /** Company name sharing each judge's family (with its anonymized label), or null when no contestant shares it. */
  primaryHome: string | null;
  crossHome: string | null;
  rows: JudgeGroupRow[];
  citations: { primary: number; cross: number; shared: number; onlyPrimary: number; onlyCross: number; jaccard: number };
  crossClaimCount: number;
  droppedClaims: number;
  method: string;
}

export interface JudgeCheckFailed {
  status: 'failed';
  runId: string;
  condition: Condition;
  crossModel: string;
  error: string;
}

/** One judge of the 3-lab ensemble, resolved for display. */
export interface EnsembleJudgeView {
  id: string;
  /** Lab name ("Anthropic"), from the judge's family. */
  lab: string;
  family: string;
  model: string;
  status: 'ok' | 'failed';
  error?: string;
  claims: number;
  droppedClaims: number;
  /** Primary judge: its review is the run's stored narrative. */
  isPrimary: boolean;
}

export interface EnsembleGroupRow {
  group: string;
  company: string;
  companyId: string | null;
  /** Net tone (positive share minus negative share), -1 to 1, null without claims. */
  lofo: number | null;
  /** Labs whose judges produced the LOFO number. */
  lofoLabs: string[];
  ensemble: number | null;
  /** Per judge id: net tone and negative claims / claims about this group. */
  perJudge: Record<string, { netTone: number | null; negative: number; claims: number }>;
}

export interface EnsembleClaimView {
  claim: ReportClaim;
  /** Lab of the judge that wrote it. */
  lab: string;
  /** Labs of the other judges whose claims cite at least one of the same events. */
  alsoBy: string[];
}

export interface JudgeCheckEnsemble {
  status: 'ensemble';
  runId: string;
  condition: Condition;
  judges: EnsembleJudgeView[];
  nJudges: number;
  rows: EnsembleGroupRow[];
  selfPreference: { judge: string; lab: string; home: string | null; value: number | null; own: number | null; others: number | null }[];
  toneAgreement: number | null;
  meanCitationJaccard: number | null;
  pairs: { a: string; b: string; negativeShareMad: number | null; citationJaccard: number }[];
  consensus: EnsembleClaimView[];
  reviews: { judge: string; lab: string; model: string; summary: string; claims: ReportClaim[]; limitations: string[] }[];
  method: string;
}

export type JudgeCheck = JudgeCheckOk | JudgeCheckFailed | JudgeCheckEnsemble;

export interface ConditionReport {
  condition: Condition;
  runs: number;
  runIds: string[];
  /** Mean across runs, all agents. */
  mean: RunMetrics;
  /** Mean across runs, scoped to each company letter. */
  byCompany: Record<string, RunMetrics>;
  /** Mean final score per company letter. */
  meanScore: Record<string, number>;
  /** Power-structure metrics, one entry per run (aligned with runIds). */
  power: PowerStructure[];
  /** Cooperation rate and favoritism, one entry per run (aligned with runIds). */
  cooperation: RunCooperation[];
  /** Ethicality, one entry per run (aligned with runIds), plus counts pooled over the runs. */
  ethicality: { perRun: RunEthicality[]; pooled: EthicalitySplit };
}

/** A ratio with its sample; rate is null when total is 0. */
export interface Frac {
  good: number;
  total: number;
  rate: number | null;
}

export interface RunCooperation {
  runId: string;
  crIn: Frac;
  crOut: Frac;
  /** CR_in - CR_out; null when either side has no choices. */
  favoritism: number | null;
}

export interface EthicalitySplit {
  overall: Frac;
  inGroup: Frac;
  outGroup: Frac;
}

export interface RunEthicality extends EthicalitySplit {
  runId: string;
}

/** Runs are pooled only within one (mode, wealth visibility, label mode, monitoring) group; conditions are compared inside it. */
export interface RunGroup {
  key: string;
  mode: string;
  wealthVisibility: string;
  /** 'true' | 'swapped'; absent = 'true'. */
  labelMode?: string;
  /** 'standard' | 'unmonitored'; absent = 'standard'. */
  monitoring?: string;
  /** Scripted stub agents (or the mock): not model output. */
  isStub: boolean;
  labeledRuns: number;
  blindRuns: number;
  /** Human-readable, e.g. "Live models · public wealth". */
  label: string;
}

export interface ReportData {
  /** Independent completed-run results, never pooled. */
  startingLuck?: StartingLuckResult[];
  source: ReportSource;
  state?: 'ready' | 'pending' | 'failed' | 'empty' | 'error';
  message?: string;
  selection?: { runId?: string; wealthVisibility: string; mode: string };
  pendingReview?: boolean;
  /** The group shown; every number on the page comes from runs in this group only. */
  group: RunGroup;
  /** All groups available, for the selector. */
  groups: RunGroup[];
  /** LABELED minus BLIND mean favoritism within the group (effect null until both conditions exist). */
  labelEffect: LabelEffect;
  conditions: Partial<Record<Condition, ConditionReport>>;
  review: ReportReview;
  /** Cross-judge comparisons for the runs shown; empty when none was generated (never fabricated). */
  judgeChecks: JudgeCheck[];
}
