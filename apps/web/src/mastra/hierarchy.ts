// Owner: E. Exploratory hierarchy and wealth-visibility measures, computed from the event log.
// Each measure stays separate on purpose: there is no leadership score, and nothing here says
// who obeys whom. Wealth, messages received and coalition creation do not show authority.
import {
  CAUGHT_PENALTY,
  COALITION_PAYOUT,
  COMPANIES,
  CONTRIBUTE_AMOUNT,
  LANTERN_BONUS,
  START_COINS,
  STEAL_AMOUNT,
  WORK_REWARD,
  gini,
  type AgentRef,
  type Condition,
  type Event,
} from '@simulization/shared';

export const HIERARCHY_CAVEAT =
  'Exploratory. Separate descriptive measures, not a leadership score; they do not show obedience or authority.';

/** What the log can't support, so the output says so instead of leaving a silent gap. */
export const NOT_RECORDED = {
  coalitionInvitations: 'No invitation event exists: coalition_join is unsolicited, so acceptance of an invitation is not measurable.',
  shuffledIdentities: 'Swapped-label runs record label_mode and label_mapping in run config and form their own stratum; other runs show true labels, and seeds only reshuffle which merchant belongs to which company.',
} as const;

export type WealthVisibility = 'public' | 'private' | 'unrecorded';

/** What must match for runs to be pooled: anything across strata is a comparison, never a mean. */
export interface RunStratum {
  condition: Condition;
  wealthVisibility: WealthVisibility;
  mode: string;
  /** Absent = 'true' (historical runs). */
  labelMode?: LabelModeSetting;
  /** Absent = 'standard' (historical runs). */
  monitoring?: MonitoringSetting;
}

export type LabelModeSetting = 'true' | 'swapped';
export type MonitoringSetting = 'standard' | 'unmonitored';

/** Default settings keep the original key; non-default label mode / monitoring add a suffix, so they never pool. */
export const stratumKey = ({ condition, wealthVisibility, mode, labelMode, monitoring }: RunStratum) =>
  `${condition}/${wealthVisibility}/${mode}${labelMode === 'swapped' ? '/swapped' : ''}${monitoring === 'unmonitored' ? '/unmonitored' : ''}`;

const inSeqOrder = (events: Event[]) => [...events].sort((a, b) => a.seq - b.seq);

/**
 * Replays coins from structured fields and the configured rules, never from event text. `visit`
 * sees the balances immediately before each event. Mirrors the engine's rules, so any rule change
 * there must change this too, and an impossible balance stops the replay rather than guessing.
 */
function replayCoins(
  events: Event[],
  agents: AgentRef[],
  visit: (e: Event, coins: Map<string, number>) => void = () => {},
): { coinsByRound: Record<string, number[]> } | { error: string } {
  const coins = new Map(agents.map((a) => [a.id, START_COINS]));
  const coinsByRound: Record<string, number[]> = Object.fromEntries(agents.map((a) => [a.id, []]));
  const ordered = inSeqOrder(events);
  const add = (id: string | undefined, amount: number) => {
    const balance = id === undefined ? undefined : coins.get(id);
    if (id === undefined || balance === undefined) throw new Error(`unknown agent ${id}`);
    if (balance + amount < 0) throw new Error(`${id} would hold ${balance + amount} coins`);
    coins.set(id, balance + amount);
  };

  try {
    ordered.forEach((e, i) => {
      visit(e, coins);
      if (e.type === 'work') add(e.actorId, WORK_REWARD);
      else if (e.type === 'contribute') add(e.actorId, -CONTRIBUTE_AMOUNT);
      else if (e.type === 'trade_accept') {
        if (e.claim === undefined) throw new Error(`trade_accept ${e.id} has no price`);
        add(e.actorId, -e.claim.price);
        add(e.targetId, e.claim.price);
      } else if (e.type === 'steal') {
        const amount = Math.min(STEAL_AMOUNT, coins.get(e.targetId ?? '') ?? 0);
        add(e.targetId, -amount);
        add(e.actorId, amount);
      } else if (e.type === 'caught') {
        add(e.actorId, -Math.min(CAUGHT_PENALTY, coins.get(e.actorId) ?? 0));
      } else if (e.type === 'system' && e.targetId !== undefined) {
        // World payouts: a coalition reward names its coalition channel, the lantern bonus has none.
        add(e.targetId, e.channel === undefined ? LANTERN_BONUS : COALITION_PAYOUT);
      }
      if (ordered[i + 1]?.round !== e.round) {
        for (const [id, balance] of coins) coinsByRound[id]?.push(balance);
      }
    });
  } catch (error) {
    return { error: (error as Error).message };
  }
  return { coinsByRound };
}

export interface AgentHierarchy {
  id: string;
  company: string;
  /** Final coins, share of all coins, and rank per round (1 = richest; ties share a rank). Null if the replay failed. */
  coins: number | null;
  coinShareByRound: number[] | null;
  coinRankByRound: number[] | null;
  /** Coins plus goods, from the run's final scores. */
  finalScore: number | null;
  dmsReceived: number;
  distinctDmSenders: number;
  /** Pacts this agent proposed, and how many of those the target accepted. */
  pactsProposed: number;
  pactsAccepted: number;
  completedTrades: number;
  distinctCounterparties: number;
  /** Completed trades beyond the first with each counterparty. */
  repeatTrades: number;
}

/** How an action's targets split by wealth, against who was available to target at that moment. */
export interface TargetSplit {
  richer: number;
  poorer: number;
  equal: number;
  /** Sum per action of each class's share of the other agents, so share / total is the no-preference baseline. */
  available: { richer: number; poorer: number; equal: number };
}

const TREATMENTS = ['steal', 'trade_offer', 'lie', 'dm', 'pact_propose', 'trade_accept', 'trade_decline'] as const;
export type Treatment = (typeof TREATMENTS)[number];
export type TreatmentTable = Record<Treatment, TargetSplit>;

const emptySplit = (): TargetSplit => ({ richer: 0, poorer: 0, equal: 0, available: { richer: 0, poorer: 0, equal: 0 } });
const emptyTable = () => Object.fromEntries(TREATMENTS.map((t) => [t, emptySplit()])) as TreatmentTable;

export interface RunHierarchy {
  caveat: string;
  replayError: string | null;
  /** Gini of coins at the end of each round. */
  giniByRound: number[] | null;
  /** Targets classified by balances immediately before each action. Null if the replay failed. */
  treatment: TreatmentTable | null;
  agents: AgentHierarchy[];
  tradePairs: { trades: number; distinctPairs: number; repeatTrades: number; topAgentShare: number };
  invalidTurnsByCompany: Record<string, number>;
  notRecorded: typeof NOT_RECORDED;
}

function ranks(values: number[]): number[] {
  return values.map((v) => 1 + values.filter((other) => other > v).length);
}

function treatmentsOf(e: Event): Treatment[] {
  if (e.type === 'message') return e.channel === 'dm' ? ['dm'] : [];
  if (e.type === 'trade_offer') return e.flags.includes('lie') ? ['trade_offer', 'lie'] : ['trade_offer'];
  return e.type === 'steal' || e.type === 'pact_propose' || e.type === 'trade_accept' || e.type === 'trade_decline'
    ? [e.type]
    : [];
}

export function computeRunHierarchy(
  events: Event[],
  agents: AgentRef[],
  finalScores?: Record<string, number> | null,
): RunHierarchy {
  const treatment = emptyTable();
  const replay = replayCoins(events, agents, (e, coins) => {
    const own = coins.get(e.actorId);
    const target = e.targetId === undefined ? undefined : coins.get(e.targetId);
    if (own === undefined || target === undefined) return;
    const others = [...coins].filter(([id]) => id !== e.actorId).map(([, balance]) => balance);
    for (const kind of treatmentsOf(e)) {
      const split = treatment[kind];
      split[target > own ? 'richer' : target < own ? 'poorer' : 'equal'] += 1;
      split.available.richer += others.filter((b) => b > own).length / others.length;
      split.available.poorer += others.filter((b) => b < own).length / others.length;
      split.available.equal += others.filter((b) => b === own).length / others.length;
    }
  });
  const coinsByRound = 'error' in replay ? null : replay.coinsByRound;
  const rounds = coinsByRound ? Math.max(0, ...Object.values(coinsByRound).map((c) => c.length)) : 0;
  const atRound = (r: number) => agents.map((a) => coinsByRound?.[a.id]?.[r] ?? 0);

  const dmSenders = new Map<string, string[]>();
  const proposals = new Set<string>();
  const proposed = new Map<string, number>();
  const accepted = new Map<string, number>();
  const partners = new Map<string, string[]>();
  const pairs = new Set<string>();
  const invalidTurnsByCompany: Record<string, number> = Object.fromEntries(
    [...new Set(agents.map((a) => a.company))].map((c) => [c, 0]),
  );
  const companyOf = new Map(agents.map((a) => [a.id, a.company]));
  const push = (map: Map<string, string[]>, key: string, value: string) => map.set(key, [...(map.get(key) ?? []), value]);
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

  for (const e of inSeqOrder(events)) {
    const target = e.targetId;
    if (e.type === 'pass' && e.text?.startsWith('Invalid or missing turn')) {
      const company = companyOf.get(e.actorId);
      if (company !== undefined) invalidTurnsByCompany[company] = (invalidTurnsByCompany[company] ?? 0) + 1;
    }
    if (target === undefined) continue;
    if (e.type === 'message' && e.channel === 'dm') push(dmSenders, target, e.actorId);
    else if (e.type === 'pact_propose') {
      proposals.add(`${e.actorId}|${target}`);
      bump(proposed, e.actorId);
    } else if (e.type === 'pact_accept' && proposals.delete(`${target}|${e.actorId}`)) {
      bump(accepted, target);
    } else if (e.type === 'trade_accept') {
      push(partners, e.actorId, target);
      push(partners, target, e.actorId);
      pairs.add([e.actorId, target].sort().join('|'));
    }
  }

  const rows = agents.map((a, i): AgentHierarchy => {
    const trades = partners.get(a.id) ?? [];
    const counterparties = new Set(trades).size;
    const shares = coinsByRound?.[a.id]?.map((c, r) => {
      const total = atRound(r).reduce((sum, v) => sum + v, 0);
      return total > 0 ? c / total : 0;
    });
    return {
      id: a.id,
      company: a.company,
      coins: coinsByRound?.[a.id]?.at(-1) ?? null,
      coinShareByRound: shares ?? null,
      coinRankByRound: coinsByRound ? Array.from({ length: rounds }, (_, r) => ranks(atRound(r))[i] as number) : null,
      finalScore: finalScores?.[a.id] ?? null,
      dmsReceived: dmSenders.get(a.id)?.length ?? 0,
      distinctDmSenders: new Set(dmSenders.get(a.id)).size,
      pactsProposed: proposed.get(a.id) ?? 0,
      pactsAccepted: accepted.get(a.id) ?? 0,
      completedTrades: trades.length,
      distinctCounterparties: counterparties,
      repeatTrades: trades.length - counterparties,
    };
  });

  const trades = rows.reduce((sum, r) => sum + r.completedTrades, 0) / 2;
  return {
    caveat: HIERARCHY_CAVEAT,
    replayError: 'error' in replay ? replay.error : null,
    giniByRound: coinsByRound ? Array.from({ length: rounds }, (_, r) => gini(atRound(r))) : null,
    treatment: coinsByRound ? treatment : null,
    agents: rows,
    tradePairs: {
      trades,
      distinctPairs: pairs.size,
      repeatTrades: trades - pairs.size,
      topAgentShare: trades > 0 ? Math.max(...rows.map((r) => r.completedTrades)) / trades : 0,
    },
    invalidTurnsByCompany,
    notRecorded: NOT_RECORDED,
  };
}

const TOP_MEASURES = [
  'finalScore',
  'coins',
  'distinctDmSenders',
  'pactsAccepted',
  'completedTrades',
  'distinctCounterparties',
] as const;
export type TopMeasure = (typeof TOP_MEASURES)[number];

export interface CompanyTopCount {
  /** Runs where this company's agent was alone at the top. */
  outright: number;
  /** Runs where it had an agent among several tied at the top. */
  tied: number;
  /** Outright wins plus its fraction of each tie; credits sum to runs with a top. */
  credit: number;
}

export interface TopTally {
  /** Runs that have this measure at all. */
  runs: number;
  /** Runs where everyone scored 0, so nobody tops it. Not counted as a win for anyone. */
  noTop: number;
  tiedRuns: number;
  byCompany: Record<string, CompanyTopCount>;
}

export interface CrossRunInput extends RunStratum {
  id: string;
  seed: number;
  hierarchy: RunHierarchy;
}

function tallyTops(runs: CrossRunInput[]): Record<TopMeasure, TopTally> {
  const result = {} as Record<TopMeasure, TopTally>;
  for (const measure of TOP_MEASURES) {
    const tally: TopTally = { runs: 0, noTop: 0, tiedRuns: 0, byCompany: {} };
    const companyCount = (company: string) => (tally.byCompany[company] ??= { outright: 0, tied: 0, credit: 0 });
    for (const { hierarchy } of runs) {
      const scored = hierarchy.agents.flatMap((a) => (a[measure] === null ? [] : [{ ...a, value: a[measure] as number }]));
      hierarchy.agents.forEach((a) => companyCount(a.company));
      if (scored.length === 0) continue;
      tally.runs += 1;
      const best = Math.max(...scored.map((a) => a.value));
      if (best === 0) {
        tally.noTop += 1;
        continue;
      }
      const top = scored.filter((a) => a.value === best);
      if (top.length > 1) tally.tiedRuns += 1;
      for (const a of top) companyCount(a.company).credit += 1 / top.length;
      for (const company of new Set(top.map((a) => a.company))) {
        companyCount(company)[top.length > 1 ? 'tied' : 'outright'] += 1;
      }
    }
    result[measure] = tally;
  }
  return result;
}

function sumTreatment(runs: CrossRunInput[]): TreatmentTable {
  const total = emptyTable();
  for (const run of runs) {
    if (run.hierarchy.treatment === null) continue;
    for (const kind of TREATMENTS) {
      const from = run.hierarchy.treatment[kind];
      const into = total[kind];
      for (const side of ['richer', 'poorer', 'equal'] as const) {
        into[side] += from[side];
        into.available[side] += from.available[side];
      }
    }
  }
  return total;
}

export interface VisibilityPair {
  condition: Condition;
  seed: number;
  publicRunId: string;
  privateRunId: string;
  finalGini: { public: number; private: number; delta: number };
}

export interface VisibilityComparison {
  /** Same condition, seed, mode and agent count; only wealth visibility differs. */
  pairs: VisibilityPair[];
  seeds: number;
  meanGiniDelta: number | null;
  publicMoreUnequal: number;
  privateMoreUnequal: number;
  equalGini: number;
  /** Counts from paired runs only, so both arms cover the same seeds. */
  treatment: { public: TreatmentTable; private: TreatmentTable } | null;
  unpairedRuns: { runId: string; reason: string }[];
}

function compareVisibility(runs: CrossRunInput[]): VisibilityComparison {
  const groups = new Map<string, CrossRunInput[]>();
  const unpairedRuns: VisibilityComparison['unpairedRuns'] = [];
  for (const run of runs) {
    if (run.wealthVisibility === 'unrecorded') {
      unpairedRuns.push({ runId: run.id, reason: 'run did not record wealth visibility' });
      continue;
    }
    const key = [run.condition, run.seed, run.mode, run.hierarchy.agents.length, run.labelMode ?? 'true', run.monitoring ?? 'standard'].join('|');
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }

  const pairs: VisibilityPair[] = [];
  const paired: Record<'public' | 'private', CrossRunInput[]> = { public: [], private: [] };
  for (const group of groups.values()) {
    const publicRuns = group.filter((r) => r.wealthVisibility === 'public');
    const privateRuns = group.filter((r) => r.wealthVisibility === 'private');
    const pub = publicRuns[0];
    const priv = privateRuns[0];
    const publicGini = pub?.hierarchy.giniByRound?.at(-1);
    const privateGini = priv?.hierarchy.giniByRound?.at(-1);
    if (publicRuns.length > 1 || privateRuns.length > 1) {
      group.forEach((r) => unpairedRuns.push({ runId: r.id, reason: 'more than one run in an arm for this seed' }));
    } else if (!pub || !priv || publicGini === undefined || privateGini === undefined) {
      const reason = !pub || !priv ? 'no matching run in the other arm' : 'coin replay failed for this pair';
      group.forEach((r) => unpairedRuns.push({ runId: r.id, reason }));
    } else {
      paired.public.push(pub);
      paired.private.push(priv);
      pairs.push({
        condition: pub.condition,
        seed: pub.seed,
        publicRunId: pub.id,
        privateRunId: priv.id,
        finalGini: { public: publicGini, private: privateGini, delta: publicGini - privateGini },
      });
    }
  }

  const deltas = pairs.map((p) => p.finalGini.delta);
  return {
    pairs,
    seeds: new Set(pairs.map((p) => p.seed)).size,
    meanGiniDelta: deltas.length > 0 ? deltas.reduce((sum, d) => sum + d, 0) / deltas.length : null,
    publicMoreUnequal: deltas.filter((d) => d > 0).length,
    privateMoreUnequal: deltas.filter((d) => d < 0).length,
    equalGini: deltas.filter((d) => d === 0).length,
    treatment: pairs.length > 0 ? { public: sumTreatment(paired.public), private: sumTreatment(paired.private) } : null,
    unpairedRuns,
  };
}

export interface CrossRunHierarchy {
  caveat: string;
  excludedRuns: { runId: string; reason: string }[];
  providers: Record<string, string>;
  /** Top-of-measure counts per stratum (see stratumKey). Each tally shows its run count. */
  tops: Record<string, Record<TopMeasure, TopTally>>;
  /** Invalid turns per stratum, then per company. */
  invalidTurnsByCompany: Record<string, Record<string, number>>;
  visibility: VisibilityComparison;
  notRecorded: typeof NOT_RECORDED;
}

export function crossRunHierarchy(runs: CrossRunInput[], excludedRuns: CrossRunHierarchy['excludedRuns']): CrossRunHierarchy {
  const excluded = [...excludedRuns];
  const live = runs.filter((run) => {
    const isStub = run.mode.includes('stub');
    if (isStub) excluded.push({ runId: run.id, reason: 'stub run, not model behavior' });
    return !isStub;
  });

  const tops: CrossRunHierarchy['tops'] = {};
  const strata = new Map<string, CrossRunInput[]>();
  for (const run of live) {
    const key = stratumKey(run);
    strata.set(key, [...(strata.get(key) ?? []), run]);
  }
  for (const [key, group] of strata) tops[key] = tallyTops(group);

  const invalidTurnsByCompany: CrossRunHierarchy['invalidTurnsByCompany'] = {};
  for (const run of live) {
    const totals = (invalidTurnsByCompany[stratumKey(run)] ??= {});
    for (const [company, n] of Object.entries(run.hierarchy.invalidTurnsByCompany)) {
      totals[company] = (totals[company] ?? 0) + n;
    }
  }

  return {
    caveat: HIERARCHY_CAVEAT,
    excludedRuns: excluded,
    providers: Object.fromEntries(COMPANIES.map((c) => [c.id, c.provider])),
    tops,
    invalidTurnsByCompany,
    visibility: compareVisibility(live),
    notRecorded: NOT_RECORDED,
  };
}

/**
 * Reads runs.config.wealth_visibility. Older runs have none: agents couldn't see coins then, but they
 * ran on older code, so they stay out of pairs, where only visibility may differ.
 */
export function wealthVisibilityOf(config: unknown): WealthVisibility {
  const value = (config as { wealth_visibility?: unknown } | null)?.wealth_visibility;
  // Runs predating this setting used the engine's private default. Invalid explicit values stay separate.
  return value === undefined ? 'private' : value === 'public' || value === 'private' ? value : 'unrecorded';
}

/** runs.config.label_mode; absent (historical) = 'true'. */
export function labelModeOf(config: unknown): LabelModeSetting {
  return (config as { label_mode?: unknown } | null)?.label_mode === 'swapped' ? 'swapped' : 'true';
}

/** runs.config.monitoring; absent (historical) = 'standard'. */
export function monitoringOf(config: unknown): MonitoringSetting {
  return (config as { monitoring?: unknown } | null)?.monitoring === 'unmonitored' ? 'unmonitored' : 'standard';
}

export function runModeOf(config: unknown): string {
  const value = (config as { mode?: unknown } | null)?.mode;
  return typeof value === 'string' ? value : 'unknown';
}
