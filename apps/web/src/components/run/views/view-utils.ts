import type { Event } from "@simulization/shared";
import type { RunAgent } from "../run-helpers";

export const COMPANY_VAR: Record<string, string> = {
  A: "var(--lab-a)",
  B: "var(--lab-b)",
  C: "var(--lab-c)",
};

export type Relation = "in" | "out" | "none";

export function companyMap(agents: RunAgent[]): Map<string, string> {
  return new Map(agents.filter((a) => a.company).map((a) => [a.id, a.company]));
}

/** True-company relation of actor to target. Analyst-facing: still computed in BLIND. */
export function relationOf(e: Event, companies: Map<string, string>): Relation {
  if (!e.targetId || e.actorId === "world") return "none";
  const a = companies.get(e.actorId) ?? e.actorCompany;
  const b = companies.get(e.targetId) ?? e.targetCompany;
  if (!a || !b) return "none";
  return a === b ? "in" : "out";
}

/** Event types that are an interaction between two agents (have a counterpart). */
export const INTERACTION_TYPES = new Set([
  "message",
  "trade_offer",
  "trade_accept",
  "trade_decline",
  "pact_propose",
  "pact_accept",
  "steal",
]);

export const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

export const PANEL = "rounded-md border bg-surface p-3 sm:p-4";
export const BTN =
  "min-h-8 rounded-sm border bg-surface-raised px-2.5 py-1 text-xs hover:border-primary/60 focus-visible:outline-2 disabled:opacity-40";
