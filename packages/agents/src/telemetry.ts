// Owner: Person B. Token + latency logging per turn (shows in `wrangler tail` / dev console).
import type { AgentTurnInput } from "@simulization/shared";
import type { TurnMeta } from "./types";

export function logTurn(runId: string, input: AgentTurnInput, meta: TurnMeta): void {
  console.log(
    JSON.stringify({
      kind: "agent_turn",
      runId,
      round: input.round,
      phase: input.phase,
      ...meta,
    }),
  );
}
