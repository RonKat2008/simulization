// Owner: C (readability pass). Pure event -> words/icons mapping for the village, so scene.ts only animates.
// Everything here is BLIND-safe: it only ever uses display names, never company letters.
import type { Event, Phase } from "@simulization/shared";
import { EMOTE } from "./assets";

/** An icon frame from one of the preloaded sheets (see assets.ts SHEETS). */
export interface Icon {
  sheet: "emotes" | "dungeon";
  frame: number;
}

/** Relationship line between actor and target, colored by ACTION TYPE (never by company). */
export type LinkKind = "talk" | "pact" | "trade" | "deal" | "decline" | "violation";

/** Picked to stay clear of the three company tints (blue / amber / teal) so lines never read as "company". */
export const LINK_COLOR: Record<LinkKind, number> = {
  talk: 0xf3efe2, // cream: conversation
  pact: 0xff7eb6, // pink: promises
  trade: 0xffe14d, // yellow: an offer on the table
  deal: 0xa3e635, // lime: money changed hands
  decline: 0x8a93a8, // grey: turned down
  violation: 0xe5484d, // red is reserved for violations
};

export interface Beat {
  icon: Icon | null;
  /** Bubble text over the actor, at most ~3 words. */
  label: string;
  /** One-line "now happening" sentence (the banner prefixes round + phase). */
  sentence: string;
  link: LinkKind | null;
  /** Red styling (lie, theft, caught, broken pact). */
  violation: boolean;
  /** Set on a lying trade offer: the bubble first shows the claim, then the referee's truth. */
  lie: { claimed: number; truth: number; sentence: string } | null;
  /** How long the player dwells on this event at 1x, in ms. 0 = nothing to show, skip instantly. */
  ms: number;
}

export const PHASE_LABEL: Record<Phase, string> = { negotiate: "Negotiate", trade: "Trade", act: "Act", reveal: "Reveal" };

const DUNGEON_HAMMER = 117; // Tiny Dungeon row 9, col 9

/** First `n` words of free text, quoted, with an ellipsis if cut. */
function gist(text: string | undefined, n = 3, maxChars = 22): string {
  const words = (text ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  let s = words.slice(0, n).join(" ");
  const cut = words.length > n || s.length > maxChars;
  if (s.length > maxChars) s = s.slice(0, maxChars - 1).trimEnd();
  return `“${s}${cut ? "…" : ""}”`;
}

/** Full text for the banner (CSS ellipsizes it to one line). */
const quote = (text: string | undefined) => (text?.trim() ? ` “${text.trim()}”` : "");

const isOfferId = (text: string | undefined) => !!text && /-\d+$/.test(text) && !/\s/.test(text);

/**
 * Describe one event. `nameOf` must return the display name the viewer sees (BLIND-safe labels).
 * Returns null for events with nothing to show (pass, bookkeeping system lines).
 */
export function describe(e: Event, nameOf: (id: string) => string): Beat | null {
  const A = nameOf(e.actorId);
  const T = e.targetId ? nameOf(e.targetId) : "someone";
  const beat = (b: Partial<Beat> & Pick<Beat, "label" | "sentence" | "ms">): Beat => ({
    icon: null, link: null, violation: false, lie: null, ...b,
  });

  switch (e.type) {
    case "message": {
      const icon = { sheet: "emotes", frame: EMOTE.bubbleDots } as const;
      if (e.channel === "dm" && e.targetId)
        return beat({ icon, label: `→ ${T}`, sentence: `${A} whispers to ${T}:${quote(e.text)}`, link: "talk", ms: 1200 });
      if (e.channel && e.channel !== "public")
        return beat({ icon, label: gist(e.text) || "To coalition", sentence: `${A} tells their coalition:${quote(e.text)}`, ms: 1100 });
      return beat({ icon, label: gist(e.text) || "Speaks", sentence: `${A} tells everyone:${quote(e.text)}`, ms: 1200 });
    }
    case "pact_propose":
      return beat({ icon: { sheet: "emotes", frame: EMOTE.heart }, label: `Pact? ${T}`, sentence: `${A} proposes a pact to ${T}${e.text ? ":" + quote(e.text) : ""}`, link: "pact", ms: 1000 });
    case "pact_accept":
      return beat({ icon: { sheet: "emotes", frame: 16 /* hearts */ }, label: `Pact · ${T}`, sentence: `${A} accepts a pact with ${T}`, link: "pact", ms: 1100 });
    case "pact_break":
      return beat({ icon: { sheet: "emotes", frame: EMOTE.heartBroken }, label: "Breaks pact", sentence: `${A} breaks their pact with ${T}`, link: "violation", violation: true, ms: 1300 });
    case "trade_offer": {
      if (!e.claim) return null;
      const q = e.claim.claimedQuality;
      const truth = e.groundTruth?.trueQuality;
      // The banner first states the claim; the scene swaps in `lie.sentence` when the referee's verdict lands.
      const lie = e.flags.includes("lie") && truth !== undefined
        ? { claimed: q, truth, sentence: `False quality claim: ${A} told ${T} quality ${q}; actual quality is ${truth}` }
        : null;
      return beat({
        icon: { sheet: "emotes", frame: EMOTE.bubbleDots },
        label: `Offer Q${q} · ${e.claim.price}c`,
        sentence: `${A} offers ${T} a quality-${q} good for ${e.claim.price}c`,
        link: "trade", lie, violation: !!lie, ms: lie ? 2300 : 1300,
      });
    }
    case "trade_accept": {
      const price = e.claim ? ` for ${e.claim.price} coins` : "";
      return beat({ icon: { sheet: "emotes", frame: 4 /* blue circle = yes */ }, label: e.claim ? `Deal · ${e.claim.price}c` : "Deal", sentence: `${A} buys ${T}'s good${price}`, link: "deal", ms: 1000 });
    }
    case "trade_decline":
      // Note: real runs put the offer id in e.text, so never show it.
      return beat({ icon: { sheet: "emotes", frame: EMOTE.cross }, label: "No deal", sentence: `${A} turns down ${T}'s offer${e.text && !isOfferId(e.text) ? ":" + quote(e.text) : ""}`, link: "decline", ms: 800 });
    case "coalition_create":
      return beat({ icon: { sheet: "emotes", frame: 10 /* star */ }, label: "New coalition", sentence: `${A} founds a coalition${e.text ? ` “${e.text}”` : ""}`, ms: 1100 });
    case "coalition_join":
      return beat({ icon: { sheet: "emotes", frame: 10 }, label: "Joins coalition", sentence: `${A} joins a coalition`, ms: 900 });
    case "coalition_leave":
      return beat({ icon: { sheet: "emotes", frame: EMOTE.cross }, label: "Leaves coalition", sentence: `${A} leaves their coalition`, ms: 900 });
    case "work":
      return beat({ icon: { sheet: "dungeon", frame: DUNGEON_HAMMER }, label: "Work +1c", sentence: `${A} works for 1 coin`, ms: 650 });
    case "contribute":
      return beat({ icon: { sheet: "emotes", frame: EMOTE.idea }, label: "Lantern +1c", sentence: `${A} gives 1 coin to the lantern shrine`, ms: 850 });
    case "steal": {
      const amount = /^Stole (\d+) coins\.$/.exec(e.text ?? "")?.[1];
      return beat({ icon: { sheet: "emotes", frame: EMOTE.exclamations }, label: `Theft · ${T}`, sentence: amount !== undefined ? `${A} steals ${amount} coins from ${T}; detection has not been revealed yet` : `${A} executes a theft from ${T}; amount not recorded`, link: "violation", violation: true, ms: 1500 });
    }
    case "caught":
      return beat({ icon: { sheet: "emotes", frame: EMOTE.exclamation }, label: "Caught!", sentence: `${A} is caught stealing and sent to the stocks`, violation: true, ms: 2000 });
    case "system": {
      // "Completed trade/offers." etc. are bookkeeping; rewards are worth a beat.
      if (!e.text || /^Completed\b|phase begins/i.test(e.text)) return null;
      return beat({ label: "", sentence: e.text.replace(/\.$/, ""), ms: 900 });
    }
    default: // pass
      return null;
  }
}

/** What the banner shows. Emitted by the scene, rendered by VillageCanvas (DOM, so it stays legible on phones). */
export interface Narration {
  round: number;
  phase: Phase | null;
  sentence: string;
  icon: Icon | null;
  violation: boolean;
}
