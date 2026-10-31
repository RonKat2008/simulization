import type { Event, EventType } from "@simulization/shared";

export interface RunAgent {
  id: string;
  name: string;
  company: string;
}

export const COMPANY_TEXT: Record<string, string> = { A: "text-lab-a", B: "text-lab-b", C: "text-lab-c" };
export const COMPANY_BG: Record<string, string> = { A: "bg-lab-a", B: "bg-lab-b", C: "bg-lab-c" };

/** Agents are not returned by the sim, so live runs derive them from the event log. Name falls back to the id. */
export function deriveAgents(events: Event[]): RunAgent[] {
  const byId = new Map<string, RunAgent>();
  const see = (id: string | undefined, company: string | undefined) => {
    if (!id || id === "world") return;
    const prev = byId.get(id);
    if (!prev || (!prev.company && company)) byId.set(id, { id, name: id, company: company ?? "" });
  };
  for (const e of events) {
    see(e.actorId, e.actorCompany);
    see(e.targetId, e.targetCompany);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export interface FilterGroup {
  key: string;
  label: string;
  types: EventType[];
}

export const FILTER_GROUPS: FilterGroup[] = [
  { key: "talk", label: "Messages", types: ["message"] },
  { key: "trade", label: "Trades", types: ["trade_offer", "trade_accept", "trade_decline"] },
  { key: "pact", label: "Pacts", types: ["pact_propose", "pact_accept", "pact_break"] },
  { key: "coalition", label: "Coalitions", types: ["coalition_create", "coalition_join", "coalition_leave"] },
  { key: "crime", label: "Thefts", types: ["steal", "caught"] },
  { key: "act", label: "Actions", types: ["work", "contribute", "pass"] },
  { key: "system", label: "System", types: ["system"] },
];

export function eventSummary(e: Event, label: (id: string) => string): string {
  const to = e.targetId ? label(e.targetId) : "";
  switch (e.type) {
    case "message":
      return e.text ?? "";
    case "trade_offer":
      return e.claim
        ? `offers ${e.claim.goodId} to ${to}, claims quality ${e.claim.claimedQuality} for ${e.claim.price}c`
        : `offers a good to ${to}`;
    case "trade_accept":
      return `accepts the offer${to ? ` from ${to}` : ""}`;
    case "trade_decline":
      return `declines the offer${to ? ` from ${to}` : ""}`;
    case "pact_propose":
      return `proposes a pact to ${to}`;
    case "pact_accept":
      return `accepts a pact with ${to}`;
    case "pact_break":
      return `breaks the pact with ${to}`;
    case "steal":
      return `steals from ${to}`;
    case "caught":
      return e.text ?? `is caught${to ? ` stealing from ${to}` : ""}`;
    case "coalition_create":
      return `founds ${e.channel ?? "a coalition"}`;
    case "coalition_join":
      return `joins ${e.channel ?? "a coalition"}`;
    case "coalition_leave":
      return `leaves ${e.channel ?? "a coalition"}`;
    case "work":
      return "works for 1 coin";
    case "contribute":
      return "contributes to the lantern fund";
    case "pass":
      return "passes";
    default:
      return e.text ?? "";
  }
}

export const isViolation = (e: Event) => e.flags.includes("rule_break") || e.flags.includes("theft");
