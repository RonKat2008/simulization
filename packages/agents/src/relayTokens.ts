// Owner: Person B. Persists AgentRelay tokens into each AgentState (CLAUDE.md Part 3) after relay.setupRun.
import type { AgentStore } from "@simulization/shared";
import { mapLimit } from "./limits";
import type { RunRelay } from "./runRelay";

const ATTACH_CONCURRENCY = 6;

/**
 * load -> { ...state, relayToken } -> save for every agent, at most 6 at once. Every agent is attempted;
 * rejects afterwards listing the agents that failed. For the DO / Terse stores call `init` first.
 */
export async function attachRelayTokens(store: AgentStore, runId: string, tokens: Record<string, string>): Promise<void> {
  const failed: string[] = [];
  await mapLimit(Object.entries(tokens), ATTACH_CONCURRENCY, async ([agentId, relayToken]) => {
    try {
      const state = await store.load(runId, agentId);
      await store.save(runId, agentId, { ...state, relayToken });
    } catch (err) {
      console.warn(`[agents] could not persist relay token for ${agentId} in ${runId}`, err);
      failed.push(agentId);
    }
  });
  if (failed.length > 0) throw new Error(`relay token not persisted for: ${failed.join(", ")}`);
}

/**
 * relay.setupRun + attachRelayTokens. Never throws: a relay failure logs and returns {} (run continues on the
 * world inbox); a persist failure logs but still returns the tokens so the caller can keep them.
 */
export async function setupRunRelay(
  relay: RunRelay | null,
  store: AgentStore,
  runId: string,
  agentIds: string[],
): Promise<Record<string, string>> {
  if (!relay) return {};
  let tokens: Record<string, string>;
  try {
    tokens = await relay.setupRun(runId, agentIds);
  } catch (err) {
    console.warn(`[agents] relay setup failed for ${runId}; continuing without relay`, err);
    return {};
  }
  try {
    await attachRelayTokens(store, runId, tokens);
  } catch (err) {
    console.warn(`[agents] relay tokens only partly persisted for ${runId}`, err);
  }
  return tokens;
}
