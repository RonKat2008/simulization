// Owner: Person B (@simulization/agents, runtime-neutral: Workers, Durable Actors, Node). One agent turn: prompt → model → validate → 1 repair retry → pass.
import {
  buildSystemPrompt,
  buildUserMessage,
  RULES,
  type AgentState,
  type AgentTurnInput,
} from "@simulization/shared";
import { signalDeadline } from "./limits";
import { ACTION_FIELD_HINT, parseTurn, passOutput, type ParseResult } from "./parseTurn";
import { TURN_OUTPUT_JSON_SCHEMA } from "./outputSchema";
import type { ModelClient, TurnResult } from "./types";

export interface TakeTurnArgs {
  agentId: string;
  state: AgentState;
  input: AgentTurnInput;
  model: ModelClient;
  signal?: AbortSignal;
  /** Epoch ms by which the turn must finish. Defaults to the deadline recorded on `signal` (withTimeout). */
  deadline?: number;
}

/** Skip the repair retry when less than this remains of the turn budget (a second model call needs ~4s). */
export const REPAIR_MIN_REMAINING_MS = 4000;

export interface TakeTurnOutcome extends TurnResult {
  /** State with the memory update applied; caller persists it. */
  state: AgentState;
}

const repairMessage = (error: string): string =>
  `Your previous reply was not valid (${error}). ${ACTION_FIELD_HINT} ` +
  `Reply again with JSON only, exactly the fields private_plan, actions, memory_update, using only your legal action types, ` +
  `and include every required field for each action (use "pass" if unsure).`;

/**
 * Never throws for model-output problems (those become a pass). Network/timeout errors from
 * the model client DO throw, so the caller's retry/timeout policy applies (runAgentTurns).
 */
export async function takeTurn({ agentId, state, input, model, signal, deadline }: TakeTurnArgs): Promise<TakeTurnOutcome> {
  const started = Date.now();
  const limit = deadline ?? signalDeadline(signal);
  const system = buildSystemPrompt(state.name, RULES);
  const user = buildUserMessage({ ...input, memory: state.memory });
  let inputTokens = 0;
  let outputTokens = 0;
  let attempts = 0;
  let lastError = "";
  /** Attempt-1 result whose actions were all dropped; used if the repair retry fails too. */
  let fallback: Extract<ParseResult, { ok: true }> | undefined;

  // Attempt 1 is the normal turn; attempt 2 is the single repair retry.
  while (attempts < 2) {
    if (attempts === 1 && limit !== undefined && limit - Date.now() < REPAIR_MIN_REMAINING_MS) {
      lastError = `${lastError} (no time left for repair)`;
      break;
    }
    signal?.throwIfAborted();
    attempts++;
    const req = attempts === 1 ? user : `${user}\n\n${repairMessage(lastError)}`;
    const res = await model.complete({
      provider: state.provider,
      model: state.model,
      system,
      user: req,
      jsonSchema: TURN_OUTPUT_JSON_SCHEMA,
      signal,
    });
    inputTokens += res.inputTokens ?? 0;
    outputTokens += res.outputTokens ?? 0;

    const parsed = parseTurn(res.text, input.legalActions);
    // Every proposed action was malformed: spend the repair retry on it instead of silently passing.
    if (parsed.ok && parsed.allDropped && parsed.schemaIssues.length > 0 && attempts === 1) {
      fallback = parsed;
      lastError = parsed.schemaIssues.join("; ");
      continue;
    }
    if (!parsed.ok) {
      lastError = parsed.error;
      if (!fallback) continue;
    }
    const accepted = parsed.ok ? parsed : fallback;
    if (accepted) {
      return {
        output: accepted.output,
        state: { ...state, memory: accepted.output.memory_update },
        meta: { agentId, provider: state.provider, model: state.model, latencyMs: Date.now() - started, inputTokens, outputTokens, attempts },
      };
    }
  }

  if (fallback) {
    // No time (or no luck) for a repair: a pass from the dropped malformed actions is still a valid turn.
    return {
      output: fallback.output,
      state: { ...state, memory: fallback.output.memory_update },
      meta: { agentId, provider: state.provider, model: state.model, latencyMs: Date.now() - started, inputTokens, outputTokens, attempts },
    };
  }

  return {
    output: passOutput(`invalid output: ${lastError}`, state.memory),
    state,
    meta: {
      agentId, provider: state.provider, model: state.model, latencyMs: Date.now() - started,
      inputTokens, outputTokens, attempts, passReason: `invalid output: ${lastError}`,
    },
  };
}
