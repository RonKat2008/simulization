import type { AgentEnvironment } from "../environment";
// Owner: Person B. Picks the AgentStore implementation from env.AGENT_STORE (Terse actors only; Neon is reporting storage).
import type { AgentStore } from "@simulization/shared";
import { GatewayModelClient, StubModelClient } from "@simulization/agents";
import type { ModelClient } from "@simulization/agents";
import { RelayClient } from "@simulization/agents";
import { RunRelay } from "@simulization/agents";
import { DurableActorsClient, TerseAgentStore } from "./terseStore";

/** Stub (no network, seeded merchant bot) when AI_GATEWAY_API_KEY is unset or MODEL_MODE="stub". */
export function createModelClient(env: AgentEnvironment): ModelClient {
  const mode = (env as unknown as { MODEL_MODE?: string }).MODEL_MODE;
  if (mode === "stub" || !env.AI_GATEWAY_API_KEY) {
    console.warn("[agents] using StubModelClient (no AI_GATEWAY_API_KEY or MODEL_MODE=stub): no real model calls");
    return new StubModelClient();
  }
  return new GatewayModelClient(env.AI_GATEWAY_API_KEY);
}

/** Null when AGENTRELAY_API_KEY is unset: turns then use the world-built inbox (no relay). */
export function createRunRelay(env: AgentEnvironment): RunRelay | null {
  if (!env.AGENTRELAY_API_KEY) return null;
  return new RunRelay(new RelayClient(env.AGENTRELAY_API_KEY, env.AGENTRELAY_BASE_URL || undefined));
}

export function createAgentStore(env: AgentEnvironment): AgentStore {
  const kind: string = env.AGENT_STORE ?? "terse";
  if (kind !== "terse") throw new Error("AGENT_STORE must be terse. Neon is only the database/projection role; Cloudflare is disabled.");
  if (kind === "terse") {
    return new TerseAgentStore(
      new DurableActorsClient({
        baseUrl: env.DURABLE_ACTORS_URL || "http://127.0.0.1:7100",
        projectId: env.DURABLE_ACTORS_PROJECT_ID || "local",
        secret: env.DURABLE_ACTORS_SECRET || undefined,
      }),
    );
  }
  throw new Error("Unreachable actor store selection");
}
