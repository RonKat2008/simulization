// Owner: Person B. Picks the AgentStore implementation from env.AGENT_STORE ('neon' default | 'do').
import type { AgentStore } from "@simulization/shared";
import type { AgentActor } from "./AgentActor";
import { DoAgentStore } from "./doStore";
import { GatewayModelClient } from "./gatewayModel";
import { NeonAgentStore } from "./neonStore";
import type { ModelClient } from "./types";
import { RelayClient } from "../relay/relayClient";
import { RunRelay } from "../relay/runRelay";

export function createModelClient(env: Cloudflare.Env): ModelClient {
  return new GatewayModelClient(env.AI_GATEWAY_API_KEY);
}

/** Null when AGENTRELAY_API_KEY is unset: turns then use the world-built inbox (no relay). */
export function createRunRelay(env: Cloudflare.Env): RunRelay | null {
  if (!env.AGENTRELAY_API_KEY) return null;
  return new RunRelay(new RelayClient(env.AGENTRELAY_API_KEY, env.AGENTRELAY_BASE_URL || undefined));
}

export function createAgentStore(env: Cloudflare.Env): AgentStore {
  // env.AGENT_STORE is typed as the literal "neon" by wrangler types; widen to allow 'do'.
  const kind: string = env.AGENT_STORE ?? "neon";
  if (kind === "do") return new DoAgentStore(env.AGENT as unknown as DurableObjectNamespace<AgentActor>);
  if (kind !== "neon") throw new Error(`unknown AGENT_STORE '${kind}' (expected 'neon' or 'do')`);
  return new NeonAgentStore(env.DATABASE_URL, createModelClient(env), createRunRelay(env));
}
