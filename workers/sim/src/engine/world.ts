import { COMPANIES, NAMES, NUM_AGENTS, ROUNDS, RULES, START_COINS, START_GOODS, createRng, displayedCompany, LabelModeSchema, MonitoringSchema, ProductProjectSchema, WealthVisibilitySchema, type LabelMode, type Monitoring, type ProductProject, type WealthVisibility, type AgentTurnInput, type Condition } from '@simulization/shared';
import { legalActions } from './rules';
import type { WorldState } from './types';
export interface WorldOptions { runId: string; seed: number; condition: Condition; agentCount?: number; epoch?: number; wealth_visibility?: WealthVisibility; label_mode?: LabelMode; monitoring?: Monitoring; product_project?: ProductProject; }
export function createWorld(o: WorldOptions): WorldState {
  const wealth_visibility=WealthVisibilitySchema.parse(o.wealth_visibility??'private');
  const label_mode=LabelModeSchema.parse(o.label_mode??'true');
  const monitoring=MonitoringSchema.parse(o.monitoring??'standard');
  const product_project = ProductProjectSchema.parse(o.product_project ?? 'off');
  const count = o.agentCount ?? NUM_AGENTS;
  if (!Number.isInteger(count) || count < 2 || count > NAMES.length) throw new Error('Invalid agent count');
  const rng = createRng(o.seed);
  const names = rng.shuffle(NAMES);
  const companies = rng.shuffle(Array.from({length: count}, (_, i) => COMPANIES[i % COMPANIES.length]!.id));
  const agents: WorldState['agents'] = {};
  for (let i = 0; i < count; i++) {
    const id = `merchant-${String(i + 1).padStart(2, '0')}`;
    agents[id] = { id, name: names[i]!, company: companies[i]!, coins: START_COINS,
      inventory: Array.from({length: START_GOODS}, (_, j) => ({ goodId: `good-${i + 1}-${j + 1}`, trueQuality: rng.int(1, 10) })),
      coalitionId: null, pacts: [], skipActRound: 0, memory: '', inbox: [] };
  }
  return { ...(product_project === 'four-turn-v1' ? { product_project, productProjects: Object.fromEntries(Object.keys(agents).map(id => [id, { completed: false }])) } : {}), runId: o.runId, seed: o.seed, condition: o.condition, wealth_visibility, ...(label_mode!=='true'?{label_mode}:{}), ...(monitoring!=='standard'?{monitoring}:{}), round: 1, phase: 'negotiate', status: 'running', agents, coalitions: [], offers: [], proposals: [], thefts: [], lanternFund: 0, seq: 0, epoch: o.epoch ?? 0 };
}
export function buildTurnInput(s: WorldState, id: string): AgentTurnInput {
  const a = s.agents[id]; if (!a) throw new Error('Unknown merchant');
  return structuredClone({ self: { id, name: a.name, company: a.company, coins: a.coins, inventory: a.inventory, coalitionId: a.coalitionId, pacts: a.pacts, inStocks: a.skipActRound === s.round, ...(s.product_project === 'four-turn-v1' ? { productProject: { version: 'four-turn-v1' as const, progress: s.productProjects?.[id]?.progress ?? null, completed: s.productProjects?.[id]?.completed ?? false } } : {}) },
    round: s.round, phase: s.phase, ...(s.tradeStep ? {tradeStep: s.tradeStep} : {}), rules: [...RULES],
    otherAgents: Object.values(s.agents).filter(b => b.id !== id).map(b => ({id: b.id, name: b.name, ...(s.condition === 'LABELED' ? {company: displayedCompany(b.company, s.label_mode)} : {}), ...(s.wealth_visibility==='public'?{coins:b.coins}:{})})),
    openOffers: s.offers.filter(o => o.targetId === id).map(({targetId: _, ...o}) => o), coalitions: s.coalitions, lanternFund: s.lanternFund, inbox: a.inbox.slice(-10), memory: a.memory, legalActions: legalActions(s,id) });
}
export function advancePhase(original: WorldState): WorldState {
  const s = structuredClone(original);
  if (s.phase === 'negotiate') { s.phase = 'trade'; s.tradeStep = 'offers'; }
  else if (s.phase === 'trade' && s.tradeStep === 'offers') s.tradeStep = 'responses';
  else if (s.phase === 'trade') { s.phase = 'act'; delete s.tradeStep; s.offers = []; }
  else if (s.phase === 'act') s.phase = 'reveal';
  else if (s.round >= ROUNDS) s.status = 'done';
  else { s.round++; s.phase = 'negotiate'; }
  return s;
}
