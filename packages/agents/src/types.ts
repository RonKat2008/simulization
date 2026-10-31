// Owner: Person B. Interfaces the agent layer depends on; concrete clients live in model/ and relay/.
import type { AgentTurnOutput } from "@simulization/shared";

export interface ModelRequest {
  provider: string;
  model: string;
  system: string;
  user: string;
  /** JSON Schema for the turn output, used when the provider supports structured output. */
  jsonSchema: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface ModelResponse {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ModelClient {
  complete(req: ModelRequest): Promise<ModelResponse>;
}

/** Per-turn telemetry, logged for token/latency tracking. */
export interface TurnMeta {
  agentId: string;
  provider: string;
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  attempts: number;
  /** Why the turn became a pass, if it did. */
  passReason?: string;
}

export interface TurnResult {
  output: AgentTurnOutput;
  meta: TurnMeta;
}
