// Owner: Person B. Replaces the world-built inbox with the AgentRelay inbox when available.
import type { AgentState, AgentTurnInput } from "@simulization/shared";
import type { RunRelay } from "../relay/runRelay";

/** Never blocks a turn: on any relay problem the input/state are returned unchanged. */
export async function withRelayInbox(
  relay: RunRelay | null,
  runId: string,
  agentId: string,
  state: AgentState,
  input: AgentTurnInput,
): Promise<{ input: AgentTurnInput; state: AgentState }> {
  if (!relay || !state.relayToken) return { input, state };
  try {
    const { inbox, inboxCursor } = await relay.pullInbox(runId, agentId, state, input.self.coalitionId, input.round);
    return { input: { ...input, inbox }, state: { ...state, inboxCursor } };
  } catch (err) {
    console.warn(`relay inbox pull failed for ${agentId} in ${runId}; using world inbox`, err);
    return { input, state };
  }
}
