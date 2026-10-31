// Pure helpers: pick the "key moments" of a run and summarize a round in plain words.
// Sentences come from the village narrator (game/narrate.ts describe()), so the timeline, the recap
// and the canvas banner always say the same thing. BLIND-safe as long as `nameOf` is the run's label().
import { PHASES, type Event, type Phase } from "@simulization/shared";
import { describe } from "@/game/narrate";

export type MomentKind = "lie" | "caught" | "theft" | "pact" | "pact_break" | "coalition" | "lantern";

export interface Moment {
  id: string;
  seq: number;
  kind: MomentKind;
  round: number;
  phase: Phase;
  /** 0..1 across the whole night (6 rounds x 4 phases). */
  pos: number;
  sentence: string;
}

/** Higher = more newsworthy. Used to pick a round's headlines. */
const RANK: Record<MomentKind, number> = { caught: 7, theft: 6, pact_break: 5, lie: 4, lantern: 3, coalition: 2, pact: 1 };

export const KIND_LABEL: Record<MomentKind, string> = {
  lie: "False quality claim",
  caught: "Theft detected",
  theft: "Theft",
  pact: "Pact formed",
  pact_break: "Pact broken",
  coalition: "Coalition formed",
  lantern: "Lantern lit",
};

const LANTERN = /^Lantern reward/i;

function kindOf(e: Event): MomentKind | null {
  if (e.type === "trade_offer" && e.flags.includes("lie")) return "lie";
  if (e.type === "caught") return "caught";
  if (e.type === "steal") return "theft";
  if (e.type === "pact_accept") return "pact";
  if (e.type === "pact_break") return "pact_break";
  if (e.type === "coalition_create") return "coalition";
  if (e.type === "system" && e.text && LANTERN.test(e.text)) return "lantern";
  return null;
}

/** The narrator's sentence; a lie uses the referee's verdict line ("LIE: X told Y quality 9, it is really 3"). */
export function sentenceFor(e: Event, nameOf: (id: string) => string): string {
  const b = describe(e, nameOf);
  if (!b) return `${nameOf(e.actorId)}: ${e.type.replaceAll("_", " ")}`;
  if (b.lie) return b.lie.sentence.replace(/^LIE: /, "Lie: ");
  return b.sentence;
}

export function keyMoments(events: Event[], rounds: number, nameOf: (id: string) => string): Moment[] {
  // Bucket every event by (round, phase) so a moment's position reflects where it falls inside its phase.
  const buckets = new Map<string, Event[]>();
  for (const e of events) {
    if (e.round < 1) continue;
    const k = `${e.round}:${e.phase}`;
    const list = buckets.get(k);
    if (list) list.push(e);
    else buckets.set(k, [e]);
  }
  const out: Moment[] = [];
  let lanternSeen = false;
  for (const [k, list] of buckets) {
    const [r, p] = k.split(":") as [string, Phase];
    const pi = PHASES.indexOf(p);
    list.forEach((e, i) => {
      const kind = kindOf(e);
      if (!kind) return;
      if (kind === "lantern") {
        if (lanternSeen) return; // one reward line per merchant; mark it once
        lanternSeen = true;
      }
      const sentence =
        kind === "lantern" ? "The lantern fund reached its goal: every merchant gets 5 coins" : sentenceFor(e, nameOf);
      out.push({
        id: e.id,
        seq: e.seq,
        kind,
        round: Number(r),
        phase: p,
        pos: ((Number(r) - 1) * PHASES.length + pi + (i + 0.5) / list.length) / (rounds * PHASES.length),
        sentence,
      });
    });
  }
  return out.sort((a, b) => a.seq - b.seq);
}

export interface RoundRecapData {
  round: number;
  /** Short "5 trades · 1 lie · 2 new pacts" pieces, nonzero only. */
  counts: { n: number; label: string; bad: boolean }[];
  headlines: Moment[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function roundRecap(events: Event[], moments: Moment[], round: number): RoundRecapData {
  const inRound = events.filter((e) => e.round === round);
  const count = (pred: (e: Event) => boolean) => inRound.filter(pred).length;
  const trades = count((e) => e.type === "trade_accept");
  const lies = count((e) => e.type === "trade_offer" && e.flags.includes("lie"));
  const thefts = count((e) => e.type === "steal");
  const caught = count((e) => e.type === "caught");
  const pacts = count((e) => e.type === "pact_accept");
  const broken = count((e) => e.type === "pact_break");
  const coalitions = count((e) => e.type === "coalition_create");
  const counts = [
    { n: trades, label: plural(trades, "trade", "trades"), bad: false },
    { n: lies, label: plural(lies, "lie", "lies"), bad: true },
    { n: thefts, label: plural(thefts, "theft", "thefts"), bad: true },
    { n: caught, label: `${caught} caught`, bad: true },
    { n: pacts, label: plural(pacts, "new pact", "new pacts"), bad: false },
    { n: broken, label: plural(broken, "broken pact", "broken pacts"), bad: true },
    { n: coalitions, label: plural(coalitions, "new coalition", "new coalitions"), bad: false },
  ].filter((c) => c.n > 0);
  const headlines = moments
    .filter((m) => m.round === round)
    .sort((a, b) => RANK[b.kind] - RANK[a.kind] || a.seq - b.seq)
    .slice(0, 3)
    .sort((a, b) => a.seq - b.seq);
  return { round, counts, headlines };
}

/** The phase cell (0..23) a playback position falls in; -1 before the first round. */
export const cellOf = (round: number, phase: Phase | null) =>
  round < 1 ? -1 : (round - 1) * PHASES.length + (phase ? PHASES.indexOf(phase) : 0);
