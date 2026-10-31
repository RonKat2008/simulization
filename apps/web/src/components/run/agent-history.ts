import {
  CAUGHT_PENALTY, COALITION_PAYOUT, CONTRIBUTE_AMOUNT, LANTERN_BONUS,
  ROUNDS, START_COINS, STEAL_AMOUNT, WORK_REWARD, type Event,
} from '@simulization/shared';

export interface CoinPoint { round: number; seq: number; coins: number }
export interface SelectedAgentHistory {
  events: Event[];
  points: CoinPoint[];
  coins: number | null;
  score: number | null;
  reason: string | null;
  coalition: { id: string; name: string } | null;
  pacts: string[];
  claims: number;
  falseClaims: number;
  thefts: number;
  pactsBroken: number;
  pactsFormed: number;
}

/**
 * Observer-only projection of the exact prefix dispatched by the village. Never agent input.
 * Coin rules mirror engine/world.ts and engine/rules.ts, guarded by agent-history-contract.ts.
 * The engine starts every merchant at START_COINS; its contiguous log records every mutation.
 * No balance is inferred from a model's self-reported plan, claimed quality, or final score.
 * Unknown/missing monetary records fail closed instead of drawing a plausible-looking chart.
 */
export function selectedAgentHistory(
  events: readonly Event[], agentId: string, throughSeq: number | null,
  finalScores?: Record<string, number> | null,
): SelectedAgentHistory {
  const prefix = events.filter(e => throughSeq === null || e.seq <= throughSeq).sort((a, b) => a.seq - b.seq);
  const own = prefix.filter(e => e.actorId === agentId);
  const relevant = prefix.filter(e => e.actorId === agentId || e.targetId === agentId);
  const names = new Map<string, string>();
  let coalitionId: string | null = null;
  const pacts = new Set<string>();
  for (const e of prefix) {
    if (e.type === 'coalition_create' && e.channel) names.set(e.channel, e.text || e.channel);
    if (e.actorId === agentId) {
      if (e.type === 'coalition_create' || e.type === 'coalition_join') coalitionId = e.channel ?? null;
      if (e.type === 'coalition_leave') coalitionId = null;
    }
    // Violations do not revoke accepted promises: the engine retains membership deliberately.
    if (e.type === 'pact_accept') {
      if (e.actorId === agentId && e.targetId) pacts.add(e.targetId);
      if (e.targetId === agentId) pacts.add(e.actorId);
    }
  }
  const result: SelectedAgentHistory = {
    events: relevant, points: [], coins: null, score: null, reason: null,
    coalition: coalitionId ? { id: coalitionId, name: names.get(coalitionId) ?? coalitionId } : null,
    pacts: [...pacts].sort(),
    claims: own.filter(e => e.type === 'trade_offer').length,
    falseClaims: own.filter(e => e.type === 'trade_offer' && e.flags.includes('lie')).length,
    thefts: own.filter(e => e.type === 'steal').length,
    // One promise per member/partner, not one per violation: repeated breaches cannot exceed
    // formed pacts, and a partner's violation is never attributed to the selected member.
    pactsBroken: new Set(own.filter(e => e.type === 'pact_break' && e.targetId && pacts.has(e.targetId)).map(e => e.targetId)).size,
    pactsFormed: pacts.size,
  };
  if (!prefix.length) return { ...result, reason: 'No recorded events at this playback position.' };
  const first = prefix[0]!;
  if (first.round !== 1 || first.phase !== 'negotiate' || !/^merchant-\d{2}$/.test(agentId)) {
    return { ...result, reason: 'This log does not establish the engine’s starting balances.' };
  }
  const balances = new Map<string, number>();
  const balance = (id: string | undefined): number => {
    if (!id || !/^merchant-\d{2}$/.test(id)) throw new Error('A monetary event has an unknown participant.');
    return balances.get(id) ?? START_COINS;
  };
  const add = (id: string | undefined, amount: number) => {
    const next = balance(id) + amount;
    if (!Number.isSafeInteger(next) || next < 0) throw new Error('The recorded events produce an invalid balance.');
    balances.set(id!, next);
  };
  const points: CoinPoint[] = [{ round: 0, seq: 0, coins: START_COINS }];
  try {
    for (const [i, e] of prefix.entries()) {
      if (e.seq !== i + 1 || e.runId !== first.runId || e.id !== `${e.runId}-${e.seq}`) {
        throw new Error('Coin history requires a complete, ordered event log from the start.');
      }
      switch (e.type) {
        case 'work': add(e.actorId, WORK_REWARD); break;
        case 'contribute': add(e.actorId, -CONTRIBUTE_AMOUNT); break;
        case 'trade_accept': {
          if (!e.claim || !Number.isSafeInteger(e.claim.price) || e.claim.price < 0) throw new Error('A completed trade has no recorded price.');
          add(e.actorId, -e.claim.price); add(e.targetId, e.claim.price); break;
        }
        case 'steal': {
          const amount = Math.min(STEAL_AMOUNT, balance(e.targetId));
          if (e.text !== `Stole ${amount} coins.`) throw new Error('A theft amount cannot be verified against the engine contract.');
          add(e.targetId, -amount); add(e.actorId, amount); break;
        }
        case 'caught': {
          const amount = Math.min(CAUGHT_PENALTY, balance(e.actorId));
          if (e.text !== `Fined ${amount} coins; skip act in round ${e.round + 1}.`) throw new Error('A fine cannot be verified against the engine contract.');
          add(e.actorId, -amount); break;
        }
        case 'system': {
          if (e.actorId !== 'world') throw new Error('An unrecognized system event prevents balance reconstruction.');
          if (e.targetId) {
            if (e.channel && e.text === `Coalition reward: ${COALITION_PAYOUT} coins.`) add(e.targetId, COALITION_PAYOUT);
            else if (!e.channel && e.text === `Lantern reward: ${LANTERN_BONUS} coins.`) add(e.targetId, LANTERN_BONUS);
            else throw new Error('An unrecognized world payout prevents balance reconstruction.');
          } else if (!/^Completed (negotiate|trade\/(offers|responses)|act|reveal)\.$/.test(e.text ?? '')) {
            throw new Error('An unrecognized system event prevents balance reconstruction.');
          }
          break;
        }
      }
      const point = { round: e.round, seq: e.seq, coins: balance(agentId) };
      if (points.at(-1)?.round === e.round) points[points.length - 1] = point;
      else points.push(point);
    }
    result.points = points;
    result.coins = balance(agentId);
    const last = prefix.at(-1)!;
    if (last.round === ROUNDS && last.phase === 'reveal' && last.actorId === 'world' && last.type === 'system' && last.text === 'Completed reveal.') {
      result.score = finalScores?.[agentId] ?? null;
    }
  } catch (error) {
    result.reason = error instanceof Error ? error.message : 'Coin history is unavailable.';
  }
  return result;
}
