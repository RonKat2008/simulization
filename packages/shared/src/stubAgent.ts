import type { Action, AgentTurnInput, AgentTurnOutput } from './schemas';
import type { Rng } from './rng';

/** Random legal-action agent for local sims and tests. Uses only input fields. */
export function stubTurn(input: AgentTurnInput, rng: Rng): AgentTurnOutput {
  const legal = new Set(input.legalActions);
  const others = input.otherAgents.map((a) => a.id);
  const actions: Action[] = [];
  const candidates = rng.shuffle(input.legalActions);

  for (const type of candidates) {
    if (actions.length >= 2) break;
    const a = build(type, input, others, rng);
    if (a && legal.has(a.type)) actions.push(a);
  }
  if (actions.length === 0) actions.push({ type: 'pass' });

  return {
    private_plan: `Stub plan for round ${input.round} ${input.phase}.`,
    actions,
    memory_update: input.memory.slice(0, 600),
  };
}

function build(type: string, input: AgentTurnInput, others: string[], rng: Rng): Action | null {
  const target = others.length > 0 ? rng.pick(others) : undefined;
  switch (type) {
    case 'message': {
      const publicMsg = rng.next() < 0.5 || target === undefined;
      return publicMsg
        ? { type, channel: 'public', text: 'Fair prices at my stall tonight.' }
        : { type, channel: 'dm', to: target, text: 'Care to trade?' };
    }
    case 'coalition_create':
      return { type, name: `Circle of ${input.self.name}` };
    case 'coalition_join': {
      const c = input.coalitions[0];
      return c ? { type, coalitionId: c.id } : null;
    }
    case 'coalition_leave':
      return input.self.coalitionId ? { type } : null;
    case 'pact_propose':
      return target ? { type, targetId: target } : null;
    case 'pact_accept':
      return target ? { type, targetId: target } : null;
    case 'trade_offer': {
      const good = input.self.inventory.length > 0 ? rng.pick(input.self.inventory) : undefined;
      if (!good || !target) return null;
      return {
        type,
        targetId: target,
        goodId: good.goodId,
        claimedQuality: rng.int(1, 10),
        price: rng.int(1, Math.max(1, Math.min(input.self.coins, 8))),
      };
    }
    case 'trade_accept':
    case 'trade_decline': {
      const o = input.openOffers[0];
      return o ? { type, offerId: o.offerId } : null;
    }
    case 'work':
    case 'contribute':
    case 'pass':
      return { type };
    case 'steal':
      return target ? { type, targetId: target } : null;
    default:
      return null;
  }
}
