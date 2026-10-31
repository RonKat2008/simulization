// Owner: Person B. AgentRelay (Relaycast) REST client over plain fetch, so it runs in workerd
// without the SDK's WebSocket/realtime code. Endpoints from agentrelay.com/docs/markdown/relaycast-api.md.
// Responses are `{ ok, data }` / `{ ok: false, error: { code, message } }`.
//
// UNCONFIRMED until we test with a real key: the base URL (docs say armadillo, SDK defaults to cast;
// set AGENTRELAY_BASE_URL to switch), the register response token field, and message ordering.

export const AGENTRELAY_DEFAULT_BASE_URL = "https://armadillo.agentrelay.com/v1";

export interface RelayMessage {
  id: string;
  /** Sender agent name. */
  from: string;
  text: string;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export class RelayError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(`AgentRelay ${status} ${code}: ${message}`);
    this.name = "RelayError";
  }
}

/** Normalizes the message shapes we may get back into RelayMessage. */
function toMessage(raw: Record<string, unknown>): RelayMessage {
  const from =
    (raw.agent_name as string | undefined) ??
    (raw.from as string | undefined) ??
    ((raw.agent as Record<string, unknown> | undefined)?.name as string | undefined) ??
    "unknown";
  return { id: String(raw.id), from, text: String(raw.text ?? "") };
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const obj = data as Record<string, unknown> | undefined;
  for (const key of ["messages", "conversations", "items"]) {
    if (Array.isArray(obj?.[key])) return obj[key] as Record<string, unknown>[];
  }
  return [];
}

export class RelayClient {
  constructor(
    /** Workspace key (ar_ws_* / rk_live_*). Used for registering agents and creating channels. */
    private readonly workspaceKey: string,
    private readonly baseUrl = AGENTRELAY_DEFAULT_BASE_URL,
  ) {
    if (!workspaceKey) throw new Error("AGENTRELAY_API_KEY is not set");
  }

  private async call<T>(token: string, method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const headers: Record<string, string> = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const env = (await res.json().catch(() => ({ ok: false, error: { code: "bad_json", message: res.statusText } }))) as Envelope<T>;
    if (!res.ok || !env.ok) {
      throw new RelayError(res.status, env.error?.code ?? "unknown", env.error?.message ?? res.statusText);
    }
    return env.data as T;
  }

  /** Registers an agent identity and returns its agent token. Names must be unique per workspace. */
  async registerAgent(name: string, metadata?: Record<string, unknown>): Promise<string> {
    const data = await this.call<Record<string, unknown>>(this.workspaceKey, "POST", "/agents", { name, type: "agent", metadata });
    const token = (data.token ?? data.agent_token ?? data.api_key) as string | undefined;
    if (!token) throw new Error(`AgentRelay register for ${name} returned no token: ${JSON.stringify(data).slice(0, 200)}`);
    return token;
  }

  async createChannel(name: string, topic?: string): Promise<void> {
    try {
      await this.call(this.workspaceKey, "POST", "/channels", { name, topic });
    } catch (err) {
      // Channel already exists (e.g. resumed run) is fine.
      if (!(err instanceof RelayError) || err.status !== 409) throw err;
    }
  }

  async invite(agentToken: string, channel: string, agentName: string): Promise<void> {
    await this.call(agentToken, "POST", `/channels/${encodeURIComponent(channel)}/invite`, { agent_name: agentName });
  }

  async join(agentToken: string, channel: string): Promise<void> {
    await this.call(agentToken, "POST", `/channels/${encodeURIComponent(channel)}/join`);
  }

  async leave(agentToken: string, channel: string): Promise<void> {
    await this.call(agentToken, "POST", `/channels/${encodeURIComponent(channel)}/leave`);
  }

  async post(agentToken: string, channel: string, text: string, idempotencyKey?: string): Promise<void> {
    await this.call(agentToken, "POST", `/channels/${encodeURIComponent(channel)}/messages`, { text }, idempotencyKey);
  }

  async dm(agentToken: string, to: string, text: string, idempotencyKey?: string): Promise<void> {
    await this.call(agentToken, "POST", "/dm", { to, text }, idempotencyKey);
  }

  async channelMessages(agentToken: string, channel: string, after?: string): Promise<RelayMessage[]> {
    const qs = new URLSearchParams({ limit: "50" });
    if (after) qs.set("after", after);
    const data = await this.call<unknown>(agentToken, "GET", `/channels/${encodeURIComponent(channel)}/messages?${qs}`);
    return asList(data).map(toMessage);
  }

  async dmConversations(agentToken: string): Promise<string[]> {
    const data = await this.call<unknown>(agentToken, "GET", "/dm/conversations?limit=100");
    return asList(data).map((c) => String(c.id));
  }

  async dmMessages(agentToken: string, conversationId: string, after?: string): Promise<RelayMessage[]> {
    const qs = new URLSearchParams({ limit: "50" });
    if (after) qs.set("after", after);
    const data = await this.call<unknown>(agentToken, "GET", `/dm/${encodeURIComponent(conversationId)}/messages?${qs}`);
    return asList(data).map(toMessage);
  }
}
