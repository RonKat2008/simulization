import type { Event } from '@simulization/shared';
import type { EvidenceEvent } from './types';

type Who = { id: string; name: string; company: string };
export type AgentLookup = Map<string, Who>;

const WORLD: Who = { id: 'world', name: 'The village', company: '-' };
const who = (agents: AgentLookup, id: string | undefined): Who | undefined =>
  id === undefined ? undefined : id === 'world' ? WORLD : agents.get(id) ?? { id, name: id, company: '?' };

function describe(e: Event, actor: Who, target: Who | undefined): string {
  const t = target ? target.name : 'someone';
  switch (e.type) {
    case 'message':
      return e.channel === 'dm' ? `${actor.name} sent a DM to ${t}` : `${actor.name} spoke on ${e.channel ?? 'public'}`;
    case 'coalition_create':
      return `${actor.name} created ${e.channel ?? 'a coalition'}`;
    case 'coalition_join':
      return `${actor.name} joined ${e.channel ?? 'a coalition'}`;
    case 'coalition_leave':
      return `${actor.name} left their coalition`;
    case 'pact_propose':
      return `${actor.name} proposed a pact to ${t}`;
    case 'pact_accept':
      return `${actor.name} accepted a pact with ${t}`;
    case 'pact_break':
      return `${actor.name} broke the pact with ${t}`;
    case 'trade_offer': {
      const c = e.claim;
      const claimed = c ? `claimed quality ${c.claimedQuality} for ${c.price} coins` : 'made an offer';
      const truth = e.groundTruth ? `, true quality ${e.groundTruth.trueQuality}` : '';
      return `${actor.name} offered ${t} a good (${claimed}${truth})`;
    }
    case 'trade_accept':
      return `${actor.name} accepted an offer from ${t}`;
    case 'trade_decline':
      return `${actor.name} declined an offer from ${t}`;
    case 'work':
      return `${actor.name} worked (+1 coin)`;
    case 'contribute':
      return `${actor.name} gave 1 coin to the lantern fund`;
    case 'steal':
      return `${actor.name} stole from ${t}`;
    case 'caught':
      return `${actor.name} was caught and sent to the stocks`;
    case 'pass':
      return `${actor.name} passed`;
    default:
      return e.text ?? 'System event';
  }
}

export function toEvidence(e: Event, agents: AgentLookup): EvidenceEvent {
  const actor = who(agents, e.actorId) ?? WORLD;
  const target = who(agents, e.targetId);
  return {
    id: e.id,
    seq: e.seq,
    round: e.round,
    phase: e.phase,
    type: e.type,
    actor,
    target,
    summary: describe(e, actor, target),
    text: e.text,
    privatePlan: e.privatePlan,
    flags: e.flags,
  };
}
