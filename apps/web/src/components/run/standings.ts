// Plain per-merchant standing replayed from the event log up to a point in playback.
// Coins are an estimate (replayed from trades, work, thefts and reward lines), so the UI says "about".
import { START_COINS, START_GOODS, STEAL_AMOUNT, type Event } from "@simulization/shared";

const CAUGHT_FINE = 6;

export interface Standing {
  id: string;
  coins: number;
  goods: number;
  lies: number;
  thefts: number;
  caught: number;
  brokenPacts: number;
  offers: number;
  sales: number;
  worked: number;
  gave: number;
  messages: number;
}

const blank = (id: string): Standing => ({
  id, coins: START_COINS, goods: START_GOODS, lies: 0, thefts: 0, caught: 0, brokenPacts: 0, offers: 0, sales: 0, worked: 0, gave: 0, messages: 0,
});

/** Standings for `ids` using only events with seq <= upto. */
export function standingsAt(events: readonly Event[], ids: readonly string[], upto: number): Map<string, Standing> {
  const out = new Map<string, Standing>(ids.map((id) => [id, blank(id)]));
  const get = (id: string) => {
    let s = out.get(id);
    if (!s) out.set(id, (s = blank(id)));
    return s;
  };
  for (const e of events) {
    if (e.seq > upto) break;
    if (e.actorId === "world") {
      // Rewards are world lines addressed to the merchant: "Coalition reward: 2 coins."
      const reward = e.type === "system" && e.targetId ? /reward: (\d+) coins?/i.exec(e.text ?? "") : null;
      if (reward && e.targetId) get(e.targetId).coins += Number(reward[1]);
      continue;
    }
    const a = get(e.actorId);
    const t = e.targetId ? get(e.targetId) : null;
    if (e.flags.includes("lie")) a.lies += 1;
    if (e.flags.includes("broken_pact")) a.brokenPacts += 1;
    switch (e.type) {
      case "message": a.messages += 1; break;
      case "trade_offer": a.offers += 1; break;
      case "trade_accept":
        // The accepting buyer pays the seller (target) and gets the good.
        if (e.claim && t) {
          a.coins = Math.max(0, a.coins - e.claim.price);
          t.coins += e.claim.price;
          a.goods += 1;
          t.goods = Math.max(0, t.goods - 1);
          t.sales += 1;
        }
        break;
      case "work": a.coins += 1; a.worked += 1; break;
      case "contribute": a.coins = Math.max(0, a.coins - 1); a.gave += 1; break;
      case "steal":
        a.thefts += 1;
        if (t) {
          a.coins += STEAL_AMOUNT;
          t.coins = Math.max(0, t.coins - STEAL_AMOUNT);
        }
        break;
      case "caught": a.caught += 1; a.coins = Math.max(0, a.coins - CAUGHT_FINE); break;
    }
  }
  return out;
}

/** Accepted pact partners and current coalition, from events up to `upto`. */
export function relationsAt(events: readonly Event[], id: string, upto: number): { pacts: string[]; coalition: string | null; tradedWith: string[] } {
  const pacts = new Set<string>();
  const traded = new Set<string>();
  let coalition: string | null = null;
  for (const e of events) {
    if (e.seq > upto) break;
    const other = e.actorId === id ? e.targetId : e.targetId === id ? e.actorId : undefined;
    if (e.type === "pact_accept" && other) pacts.add(other);
    if (e.type === "trade_accept" && other) traded.add(other);
    if (e.actorId !== id) continue;
    if (e.type === "coalition_create" || e.type === "coalition_join") coalition = e.channel ?? "a coalition";
    if (e.type === "coalition_leave") coalition = null;
  }
  return { pacts: [...pacts], coalition, tradedWith: [...traded] };
}
