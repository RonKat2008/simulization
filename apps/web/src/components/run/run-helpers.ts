import { isLie, type Event, type EventType, type Flag } from "@simulization/shared";

export interface RunAgent {
  id: string;
  name: string;
  company: string;
  /** Recorded run metadata only; never inferred from today's provider configuration. */
  provider?: string;
  model?: string;
}

export const COMPANY_TEXT: Record<string, string> = { A: "text-lab-a", B: "text-lab-b", C: "text-lab-c" };
export const COMPANY_BG: Record<string, string> = { A: "bg-lab-a", B: "bg-lab-b", C: "bg-lab-c" };

/** Fallback for runs whose status response carries no roster: derive agents from the log. Name falls back to the id. */
export function deriveAgents(events: Event[]): RunAgent[] {
  const byId = new Map<string, RunAgent>();
  const see = (id: string | undefined, company: string | undefined) => {
    if (!id || id === "world") return;
    const prev = byId.get(id);
    if (!prev || (!prev.company && company)) byId.set(id, { id, name: prev?.name ?? id, company: company ?? "" });
  };
  for (const e of events) {
    see(e.actorId, e.actorCompany);
    see(e.targetId, e.targetCompany);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Prefer the authoritative roster (real names); fill in agents only seen in events. */
export function mergeAgents(roster: RunAgent[] | null, events: Event[]): RunAgent[] {
  if (!roster || roster.length === 0) return deriveAgents(events);
  const known = new Set(roster.map((a) => a.id));
  const extra = deriveAgents(events).filter((a) => !known.has(a.id));
  return [...roster, ...extra];
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

export const FLAG_LABEL: Record<Flag, string> = {
  lie: "Lie",
  theft: "Theft",
  broken_pact: "Broken pact",
  rule_break: "Rule break",
  eval_aware: "Eval-aware",
};

export const FLAG_FILTERS: Flag[] = ["lie", "theft", "broken_pact", "rule_break", "eval_aware"];

/** Red is reserved for violations; eval-awareness is a different kind of signal. */
export const FLAG_TONE: Record<Flag, string> = {
  lie: "border-violation/70 bg-violation/10 text-violation",
  theft: "border-violation/70 bg-violation/10 text-violation",
  broken_pact: "border-violation/70 bg-violation/10 text-violation",
  rule_break: "border-violation/70 bg-violation/10 text-violation",
  eval_aware: "border-accent/60 text-accent",
};

export const PHASE_SHORT: Record<string, string> = { negotiate: "NEG", trade: "TRD", act: "ACT", reveal: "REV" };

export const isViolation = (e: Event) => e.flags.some((f) => f !== "eval_aware");

export interface ClaimCheck {
  goodId: string;
  claimed: number;
  actual: number | null;
  price: number;
  delta: number | null;
  /** True when the claim differs from the truth by at least the shared LIE_THRESHOLD. */
  misstated: boolean;
}

/** Claimed vs ground-truth quality for any event that carries a claim. */
export function claimCheck(e: Event): ClaimCheck | null {
  if (!e.claim) return null;
  const actual = e.groundTruth?.trueQuality ?? null;
  return {
    goodId: e.claim.goodId,
    claimed: e.claim.claimedQuality,
    actual,
    price: e.claim.price,
    delta: actual === null ? null : e.claim.claimedQuality - actual,
    misstated: actual !== null && isLie(e.claim.claimedQuality, actual),
  };
}

/** Verb phrase after "actor → target". Messages and claims are rendered separately by the feed row. */
export function eventVerb(e: Event): string {
  switch (e.type) {
    case "message":
      return e.channel === "public" ? "says (public)" : e.channel === "dm" ? "says (DM)" : `says (${e.channel ?? "channel"})`;
    case "trade_offer":
      return "offers";
    case "trade_accept":
      return "accepts offer";
    case "trade_decline":
      return "declines offer";
    case "pact_propose":
      return "proposes pact";
    case "pact_accept":
      return "accepts pact";
    case "pact_break":
      return "breaks pact";
    case "steal":
      return "steals from";
    case "caught":
      return "caught stealing from";
    case "coalition_create":
      return `founds ${e.channel ?? "coalition"}`;
    case "coalition_join":
      return `joins ${e.channel ?? "coalition"}`;
    case "coalition_leave":
      return `leaves ${e.channel ?? "coalition"}`;
    case "work":
      return "works (+1 coin)";
    case "contribute":
      return "contributes to lantern fund";
    case "pass":
      return "passes";
    default:
      return "";
  }
}

export interface FeedFilter {
  types: EventType[];
  flags: Flag[];
  round: number | null;
  agent: string | null;
  query: string;
}

export function matchesFilter(e: Event, f: FeedFilter, nameOf: (id: string) => string): boolean {
  if (f.types.length && !f.types.includes(e.type)) return false;
  if (f.flags.length && !e.flags.some((x) => f.flags.includes(x))) return false;
  if (f.round !== null && e.round !== f.round) return false;
  if (f.agent !== null && e.actorId !== f.agent && e.targetId !== f.agent) return false;
  const q = f.query.trim().toLowerCase();
  if (q) {
    const hay = `${e.text ?? ""} ${e.privatePlan ?? ""} ${nameOf(e.actorId)} ${e.targetId ? nameOf(e.targetId) : ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export interface AgentStats {
  messages: number;
  offers: number;
  lies: number;
  liesToSameCompany: number;
  thefts: number;
  caught: number;
  pactsBroken: number;
  evalAware: number;
  pactsAccepted: number;
  /** Times this agent was the target of a stolen coin or a false claim. */
  victimOfTheft: number;
  victimOfLie: number;
}

const EMPTY_STATS: AgentStats = {
  messages: 0, offers: 0, lies: 0, liesToSameCompany: 0, thefts: 0, caught: 0,
  pactsBroken: 0, evalAware: 0, pactsAccepted: 0, victimOfTheft: 0, victimOfLie: 0,
};

export function emptyStats(): AgentStats {
  return { ...EMPTY_STATS };
}

/** One pass over the log. Pure; does not mutate its inputs. */
export function computeAgentStats(events: Event[]): Map<string, AgentStats> {
  const out = new Map<string, AgentStats>();
  const get = (id: string) => {
    let s = out.get(id);
    if (!s) {
      s = emptyStats();
      out.set(id, s);
    }
    return s;
  };
  for (const e of events) {
    if (e.actorId === "world") continue;
    const a = get(e.actorId);
    if (e.type === "message") a.messages += 1;
    if (e.type === "trade_offer") a.offers += 1;
    if (e.type === "pact_accept") a.pactsAccepted += 1;
    if (e.type === "pact_break") a.pactsBroken += 1;
    if (e.type === "steal") {
      a.thefts += 1;
      if (e.targetId) get(e.targetId).victimOfTheft += 1;
    }
    if (e.type === "caught") a.caught += 1;
    if (e.flags.includes("eval_aware")) a.evalAware += 1;
    if (e.flags.includes("lie")) {
      a.lies += 1;
      if (e.actorCompany && e.actorCompany === e.targetCompany) a.liesToSameCompany += 1;
      if (e.targetId) get(e.targetId).victimOfLie += 1;
    }
  }
  return out;
}

export interface RoundStat {
  round: number;
  events: number;
  flagged: number;
  phases: Set<string>;
}

export function computeRoundStats(events: Event[]): Map<number, RoundStat> {
  const out = new Map<number, RoundStat>();
  for (const e of events) {
    let r = out.get(e.round);
    if (!r) {
      r = { round: e.round, events: 0, flagged: 0, phases: new Set() };
      out.set(e.round, r);
    }
    r.events += 1;
    if (isViolation(e)) r.flagged += 1;
    r.phases.add(e.phase);
  }
  return out;
}
