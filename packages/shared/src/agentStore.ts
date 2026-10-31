import type { AgentState, AgentTurnInput, AgentTurnOutput } from './schemas';

/**
 * All per-agent logic sits behind this interface (CLAUDE.md Part 3, risk 2).
 * Production implementation: 'terse' (AGENT_STORE=terse, the only accepted value) — one
 * MerchantAgent Terse Durable Actor per agent (actors/), over HTTP. MemoryAgentStore
 * (@simulization/agents) is a local/test utility. Neon is reporting storage only, not an agent store.
 * Callers (WorldActor) never know which one is active.
 */
export interface AgentStore {
  load(runId: string, agentId: string): Promise<AgentState>;
  save(runId: string, agentId: string, state: AgentState): Promise<void>;
  /**
   * requestId is stable across retries; deadline is the absolute per-attempt budget for remote actors.
   * `signal` (optional, additive: older callers/implementations ignore it) aborts when the caller's turn
   * budget is spent. Implementations must forward it to model fetches and MUST NOT save state after it
   * aborts: the world already counted the turn as a pass. Remote stores (DO / Terse) cannot send a signal
   * across RPC/HTTP, so they pass an epoch-ms deadline and the actor builds its own AbortSignal.
   */
  takeTurn(runId: string, agentId: string, input: AgentTurnInput, signal?: AbortSignal, requestId?: string, deadline?: number): Promise<AgentTurnOutput>;
}
