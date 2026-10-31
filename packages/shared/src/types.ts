export type {
  Phase, Condition, EventType, Flag, Channel, Claim, GroundTruth, Event,
  Action, ActionType, AgentTurnInput, AgentTurnOutput, AgentState,
} from './schemas';
export type { CompanyId, CompanyColor, CompanyConfig, AgentStoreKind } from './config';

export interface Good {
  id: string;
  trueQuality: number;
}

export interface RunSummary {
  id: string;
  condition: import('./schemas').Condition;
  seed: number;
  status: 'running' | 'done' | 'failed';
  round: number;
  phase: import('./schemas').Phase;
  finalScores?: Record<string, number>;
}
