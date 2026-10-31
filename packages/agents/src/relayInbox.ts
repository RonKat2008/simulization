// Owner: Person B. Merges the AgentRelay inbox with the referee's own notices when Relay is available.
import { INBOX_SIZE, type AgentState, type AgentTurnInput } from "@simulization/shared";
import type { RunRelay } from "./runRelay";

type InboxMessage = AgentTurnInput["inbox"][number];

/** Channel for notices that come from the world engine, never from another merchant over Relay. */
export const REFEREE_CHANNEL = "referee";
const REFEREE_PREFIX = "[referee notice] ";

/**
 * Provenance only, never message text: the engine marks its pact/theft notices with channel "referee";
 * from "world" covers legacy theft notices. Merchant chat in the world inbox duplicates Relay and is dropped.
 */
const isEngineNotice = (m: InboxMessage) => m.channel === REFEREE_CHANNEL || m.from === "world";

/**
 * Engine notices from the world inbox (theft outcomes, pact proposals) are kept, moved to the "referee"
 * channel and prefixed so agents can tell them from merchant messages.
 * Relay messages keep their own channel (public, dm, coalition id).
 */
export function mergeInboxes(world: readonly InboxMessage[], relay: readonly InboxMessage[]): InboxMessage[] {
  const notices = world
    .filter(isEngineNotice)
    .map((m) => ({ ...m, channel: REFEREE_CHANNEL, text: m.text.startsWith(REFEREE_PREFIX) ? m.text : `${REFEREE_PREFIX}${m.text}` }))
    .slice(-INBOX_SIZE);
  // Keep every trusted notice still present in the bounded engine inbox.
  // A fixed five-notice quota discarded valid notifications even with no Relay traffic.
  const remaining = INBOX_SIZE - notices.length;
  const messages = remaining > 0 ? relay.slice(-remaining) : [];
  return [...messages, ...notices].sort((a, b) => a.round - b.round);
}

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
    return { input: { ...input, inbox: mergeInboxes(input.inbox, inbox) }, state: { ...state, inboxCursor } };
  } catch {
    // Provider errors may contain credentials or response bodies.
    console.warn(`relay inbox pull failed for ${agentId} in ${runId}; using world inbox`);
    return { input, state };
  }
}
