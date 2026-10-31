// Owner: Person B (@simulization/agents, runtime-neutral: Workers, Durable Actors, Node). One agent turn: prompt → model → validate → 1 repair retry → pass.
import {
  buildSystemPrompt,
  buildUserMessage,
  RULES,
  type AgentState,
  type AgentTurnInput,
} from "@simulization/shared";
import { parseTurn, passOutput } from "./parseTurn";
import { TURN_OUTPUT_JSON_SCHEMA } from "./outputSchema";
import type { ModelClient, TurnResult } from "./types";

export interface TakeTurnArgs {
  agentId: string;
  state: AgentState;
  input: AgentTurnInput;
  model: ModelClient;
  signal?: AbortSignal;
}

export interface TakeTurnOutcome extends TurnResult {
  /** State with the memory update applied; caller persists it. */
  state: AgentState;
}

const repairMessage = (error: string): string =>
  `Your previous reply was not valid (${error}). Reply again with JSON only, exactly the fields private_plan, actions, memory_update, using only your legal action types.`;

/**
 * Never throws for model-output problems (those become a pass). Network/timeout errors from
 * the model client DO throw, so the caller's retry/timeout policy applies (runAgentTurns).
 */
export async function takeTurn({ agentId, state, input, model, signal }: TakeTurnArgs): Promise<TakeTurnOutcome> {
  const started = Date.now();
  const system = buildSystemPrompt(state.name, RULES);
  const user = buildUserMessage({ ...input, memory: state.memory });
  let inputTokens = 0;
  let outputTokens = 0;
  let attempts = 0;
  let lastError = "";

  // Attempt 1 is the normal turn; attempt 2 is the single repair retry.
  while (attempts < 2) {
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
    if (parsed.ok) {
      return {
        output: parsed.output,
        state: { ...state, memory: parsed.output.memory_update },
        meta: { agentId, provider: state.provider, model: state.model, latencyMs: Date.now() - started, inputTokens, outputTokens, attempts },
      };
    }
    lastError = parsed.error;
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
