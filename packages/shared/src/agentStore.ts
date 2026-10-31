import type { AgentState, AgentTurnInput, AgentTurnOutput } from './schemas';

/**
 * All per-agent logic sits behind this interface (CLAUDE.md Part 3, risk 2).
 * Two implementations, selected by the AGENT_STORE env var:
 *   - 'neon' (default): one row per agent in the `agents` table (state jsonb).
 *   - 'do': one AgentActor Durable Object per agent (Cloudflare).
 *   - 'terse': one MerchantAgent Terse Durable Actor per agent (actors/), over HTTP.
 * Callers (WorldActor) never know which one is active.
 */
export interface AgentStore {
  load(runId: string, agentId: string): Promise<AgentState>;
  save(runId: string, agentId: string, state: AgentState): Promise<void>;
  /**
   * `signal` (optional, additive: older callers/implementations ignore it) aborts when the caller's turn
   * budget is spent. Implementations must forward it to model fetches and MUST NOT save state after it
   * aborts: the world already counted the turn as a pass. Remote stores (DO / Terse) cannot send a signal
   * across RPC/HTTP, so they pass an epoch-ms deadline and the actor builds its own AbortSignal.
   */
  takeTurn(runId: string, agentId: string, input: AgentTurnInput, signal?: AbortSignal): Promise<AgentTurnOutput>;
}
