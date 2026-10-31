// AGENT_STORE=terse: each agent is a Terse Durable Actor (`MerchantAgent`) reached over the control-plane HTTP API.
// Fetch-only so it runs in Workers. Spec: POST /v1/projects/{project}/actors/{name}/{id}/invoke.
import { signalDeadline } from "@simulization/agents";
import type { AgentState, AgentStore, AgentTurnInput, AgentTurnOutput } from "@simulization/shared";

export const MERCHANT_ACTOR = "MerchantAgent";
const COMPONENT = /^[A-Za-z0-9._-]+$/;
const MAX_ACTOR_ID = 128;

export class ActorInvocationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId: string,
  ) {
    super(`durable actor ${code}: ${message} (request ${requestId})`);
    this.name = "ActorInvocationError";
  }
}

export interface DurableActorsOptions {
  baseUrl: string;
  projectId: string;
  secret?: string;
  fetch?: typeof fetch;
}

type Outcome =
  | { type: "completed"; result: unknown }
  | { type: "failed"; code: string; message: string }
  | { type: "not_executed"; reason: string }
  | { type: "unauthenticated" };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function component(label: string, value: string): string {
  if (!COMPONENT.test(value) || value === "." || value === "..") {
    throw new Error(`invalid ${label} '${value}': only A-Z a-z 0-9 . _ - allowed`);
  }
  return encodeURIComponent(value);
}

function parseOutcome(document: unknown, requestId: string): Outcome {
  const outcome = isRecord(document) ? document.outcome : undefined;
  if (isRecord(outcome)) {
    if (outcome.type === "completed" && "result" in outcome) return { type: "completed", result: outcome.result };
    if (outcome.type === "failed" && typeof outcome.code === "string" && typeof outcome.message === "string") {
      return { type: "failed", code: outcome.code, message: outcome.message };
    }
    if (outcome.type === "not_executed") return { type: "not_executed", reason: String(outcome.reason) };
    if (outcome.type === "unauthenticated") return { type: "unauthenticated" };
  }
  throw new ActorInvocationError("protocol_error", "control plane reply had no valid outcome", requestId);
}

export class DurableActorsClient {
  private readonly baseUrl: string;
  private readonly doFetch: typeof fetch;

  constructor(private readonly options: DurableActorsOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  /** Invokes one method. Retries once, with the same requestId, only on an explicit not_executed outcome. */
  async invoke<T>(
    actorName: string,
    actorId: string,
    method: string,
    args: readonly unknown[] = [],
    signal?: AbortSignal,
  ): Promise<T> {
    const requestId = crypto.randomUUID();
    const path = `/v1/projects/${component("project id", this.options.projectId)}/actors/${component("actor name", actorName)}/${component("actor id", actorId)}/invoke`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const outcome = await this.attempt(`${this.baseUrl}${path}`, requestId, method, args, signal);
      if (outcome.type === "completed") return outcome.result as T;
      if (outcome.type === "failed") throw new ActorInvocationError(outcome.code, outcome.message, requestId);
      if (outcome.type === "unauthenticated") {
        throw new ActorInvocationError("unauthenticated", "host rejected ticket before execution", requestId);
      }
      if (attempt === 1) {
        throw new ActorInvocationError("unavailable", `not executed after retry (${outcome.reason})`, requestId);
      }
    }
    throw new ActorInvocationError("unavailable", "unreachable", requestId);
  }

  private async attempt(url: string, requestId: string, method: string, args: readonly unknown[], signal?: AbortSignal): Promise<Outcome> {
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
      "x-request-id": requestId,
    };
    if (this.options.secret) headers.authorization = `Bearer ${this.options.secret}`;
    let response: Response;
    try {
      response = await this.doFetch(url, { method: "POST", headers, body: JSON.stringify({ requestId, method, args }), signal });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ActorInvocationError("outcome_unknown", `outcome unknown, request failed: ${message}`, requestId);
    }
    if (response.status === 502) throw new ActorInvocationError("outcome_unknown", "outcome unknown (HTTP 502), not replayed", requestId);
    let document: unknown;
    try {
      document = await response.json();
    } catch {
      throw new ActorInvocationError("protocol_error", `HTTP ${response.status} body was not JSON`, requestId);
    }
    if (!response.ok) {
      const err = isRecord(document) && isRecord(document.error) ? document.error : {};
      const code = typeof err.code === "string" ? err.code : `http_${response.status}`;
      const message = typeof err.message === "string" ? err.message : `HTTP ${response.status}`;
      throw new ActorInvocationError(code, message, requestId);
    }
    return parseOutcome(document, requestId);
  }
}

/** Actor ids only allow [A-Za-z0-9._-]{1,128}; ':' is mapped to '.' so `${runId}:${agentId}` stays readable. */
export function terseActorId(runId: string, agentId: string): string {
  const id = `${runId}:${agentId}`.replace(/:/g, ".");
  if (id.length > MAX_ACTOR_ID) throw new Error(`actor id too long (${id.length} > ${MAX_ACTOR_ID})`);
  return id;
}

export class TerseAgentStore implements AgentStore {
  constructor(private readonly client: DurableActorsClient) {}

  /** Call once per agent before load/takeTurn (like DoAgentStore.init). */
  async init(runId: string, agentId: string, state: AgentState): Promise<void> {
    await this.client.invoke<unknown>(MERCHANT_ACTOR, terseActorId(runId, agentId), "init", [state]);
  }

  load(runId: string, agentId: string): Promise<AgentState> {
    return this.client.invoke<AgentState>(MERCHANT_ACTOR, terseActorId(runId, agentId), "load", []);
  }

  async save(runId: string, agentId: string, state: AgentState): Promise<void> {
    await this.client.invoke<unknown>(MERCHANT_ACTOR, terseActorId(runId, agentId), "save", [state]);
  }

  /** The signal aborts our HTTP wait; the actor can't receive it, so it gets the deadline and builds its own. */
  takeTurn(runId: string, agentId: string, input: AgentTurnInput, signal?: AbortSignal): Promise<AgentTurnOutput> {
    const args: unknown[] = [runId, agentId, input];
    const deadline = signalDeadline(signal);
    if (deadline !== undefined) args.push(deadline);
    return this.client.invoke<AgentTurnOutput>(MERCHANT_ACTOR, terseActorId(runId, agentId), "takeTurn", args, signal);
  }
}
