import type { Condition, Flag, PowerStructure, RunMetrics } from '@simulization/shared';

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
}

export interface ReportData {
  source: ReportSource;
  state?: 'ready' | 'pending' | 'failed' | 'empty' | 'error';
  message?: string;
  selection?: { runId?: string; wealthVisibility: string; mode: string };
  pendingReview?: boolean;
  conditions: Partial<Record<Condition, ConditionReport>>;
  review: ReportReview;
}
