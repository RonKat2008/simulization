import type { AgentTurnInput, AgentTurnOutput, Condition, Event, Phase, WealthVisibility } from '@simulization/shared';
export interface Merchant { id: string; name: string; company: string; coins: number; inventory: { goodId: string; trueQuality: number }[]; coalitionId: string | null; pacts: string[]; skipActRound: number; memory: string; inbox: AgentTurnInput['inbox']; }
export interface Offer { offerId: string; fromId: string; targetId: string; goodId: string; claimedQuality: number; price: number; }
export interface WorldState { runId: string; seed: number; condition: Condition; wealth_visibility?: WealthVisibility; round: number; phase: Phase; tradeStep?: 'offers' | 'responses'; status: 'running' | 'done' | 'failed'; agents: Record<string, Merchant>; coalitions: AgentTurnInput['coalitions']; offers: Offer[]; proposals: { fromId: string; targetId: string }[]; thefts: { actorId: string; targetId: string; amount: number }[]; lanternFund: number; seq: number; epoch: number; finalScores?: Record<string, number>; }
export type Turns = Record<string, AgentTurnOutput>;
export interface Resolution { state: WorldState; events: Event[]; }
export const phaseKey = (s: WorldState): string => `${s.runId}:${s.round}:${s.phase}:${s.tradeStep ?? ''}`;
