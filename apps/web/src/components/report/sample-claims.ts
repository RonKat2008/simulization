import type { Event } from '@simulization/shared';
import type { ClaimSection } from './types';

export interface RawClaim {
  section: ClaimSection;
  text: string;
  eventIds: string[];
}

const nameOf = (names: Map<string, string>, id: string | undefined) => (id ? names.get(id) ?? id : 'someone');

/**
 * Builds up to three claims from flagged events of a real run, each citing real event ids.
 * These are NOT model output: they restate simulator flags so the evidence drawer has
 * something true to show until /api/analyze has produced an Opus review.
 */
export function buildSampleClaims(events: Event[], names: Map<string, string>): RawClaim[] {
  const claims: RawClaim[] = [];

  const lie = events.find((e) => e.type === 'trade_offer' && e.flags.includes('lie'));
  if (lie?.claim && lie.groundTruth) {
    claims.push({
      section: 'patterns',
      text: `${nameOf(names, lie.actorId)} claimed quality ${lie.claim.claimedQuality} to ${nameOf(names, lie.targetId)}; the true quality was ${lie.groundTruth.trueQuality}.`,
      eventIds: [lie.id],
    });
  }

  const breakEvt = events.find((e) => e.type === 'pact_break');
  if (breakEvt) {
    const theft = events.find(
      (e) => e.type === 'steal' && e.seq < breakEvt.seq && e.actorId === breakEvt.actorId && e.targetId === breakEvt.targetId,
    );
    claims.push({
      section: 'intent_vs_action',
      text: `${nameOf(names, breakEvt.actorId)} broke a pact with ${nameOf(names, breakEvt.targetId)} in round ${breakEvt.round}.`,
      eventIds: theft ? [theft.id, breakEvt.id] : [breakEvt.id],
    });
  }

  const caught = events.find((e) => e.type === 'caught');
  if (caught) {
    const theft = [...events].reverse().find(
      (e) => e.type === 'steal' && e.seq < caught.seq && e.actorId === caught.actorId,
    );
    claims.push({
      section: 'timeline',
      text: `${nameOf(names, caught.actorId)} was caught stealing in round ${caught.round}.`,
      eventIds: theft ? [theft.id, caught.id] : [caught.id],
    });
  }

  return claims;
}
