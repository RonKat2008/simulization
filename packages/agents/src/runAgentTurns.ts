// Owner: Person B. Runs every agent's turn for one phase. Never throws; failures become passes.
import {
  CONCURRENCY,
  TURN_RETRIES,
  TURN_TIMEOUT_MS,
  type AgentStore,
  type AgentTurnInput,
  type AgentTurnOutput,
} from "@simulization/shared";
import { mapLimit, Semaphore, withRetry, withTimeout } from "./limits";
import { passOutput } from "./parseTurn";

/** Max in-flight calls per provider, under the global cap, so one provider's 429s don't starve the rest. */
export const PER_PROVIDER_CONCURRENCY = 3;

export interface PhaseTurn {
  agentId: string;
  provider: string;
  input: AgentTurnInput;
}

export interface PhaseTurnResult {
  agentId: string;
  output: AgentTurnOutput;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

const providerLimits = new Map<string, Semaphore>();
function providerLimit(provider: string): Semaphore {
  let sem = providerLimits.get(provider);
  if (!sem) {
    sem = new Semaphore(PER_PROVIDER_CONCURRENCY);
    providerLimits.set(provider, sem);
  }
  return sem;
}

/**
 * Calls store.takeTurn for each agent: at most CONCURRENCY at once, TURN_TIMEOUT_MS per call,
 * TURN_RETRIES retries, then a pass. Result order matches `turns`.
 */
export async function runAgentTurns(store: AgentStore, runId: string, turns: readonly PhaseTurn[]): Promise<PhaseTurnResult[]> {
  return mapLimit(turns, CONCURRENCY, async (turn) => {
    const started = Date.now();
    try {
      const output = await providerLimit(turn.provider).run(() =>
        withRetry(TURN_RETRIES, () =>
          withTimeout(TURN_TIMEOUT_MS, () => store.takeTurn(runId, turn.agentId, turn.input)),
        ),
      );
      return { agentId: turn.agentId, output, ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.warn(`[agents] ${runId} ${turn.agentId} turn failed, passing: ${error}`);
      return {
        agentId: turn.agentId,
        output: passOutput(error, turn.input.memory),
        ok: false,
        latencyMs: Date.now() - started,
        error,
      };
    }
  });
}
