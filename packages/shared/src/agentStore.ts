import type { AgentState, AgentTurnInput, AgentTurnOutput } from './schemas';

/**
 * All per-agent logic sits behind this interface (CLAUDE.md Part 3, risk 2).
 * Two implementations, selected by the AGENT_STORE env var:
 *   - 'neon' (default): one row per agent in the `agents` table (state jsonb).
 *   - 'do': one AgentActor Durable Object per agent.
 * Callers (WorldActor) never know which one is active.
 */
export interface AgentStore {
  load(runId: string, agentId: string): Promise<AgentState>;
  save(runId: string, agentId: string, state: AgentState): Promise<void>;
  takeTurn(runId: string, agentId: string, input: AgentTurnInput): Promise<AgentTurnOutput>;
}
