// Owner: Person B. Vercel AI Gateway, OpenAI-compatible chat completions over plain fetch.
// Docs: https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions (+ /structured-outputs)
import type { ModelClient, ModelRequest, ModelResponse } from "./types";

export const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

type ResponseFormat =
  | { type: "json_schema"; json_schema: { name: string; schema: Record<string, unknown> } }
  | { type: "json_object" };

export class HttpError extends Error {
  constructor(readonly status: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 300)}`);
    this.name = "HttpError";
  }
}

/** Providers whose structured output was rejected; module-level so every client instance shares it for the isolate's life. */
const jsonModeOnly = new Set<string>();

export class GatewayModelClient implements ModelClient {
  constructor(private readonly apiKey: string, private readonly baseUrl = AI_GATEWAY_BASE_URL) {
    if (!apiKey) throw new Error("AI_GATEWAY_API_KEY is not set");
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    if (!jsonModeOnly.has(req.provider)) {
      try {
        return await this.call(req, {
          type: "json_schema",
          json_schema: { name: "agent_turn", schema: req.jsonSchema },
        });
      } catch (err) {
        // 400 = this provider/model rejected the schema; anything else is a real failure.
        if (!(err instanceof HttpError) || err.status !== 400) throw err;
        console.warn(`[gateway] ${req.model} rejected json_schema, falling back to JSON mode: ${err.message}`);
        jsonModeOnly.add(req.provider);
      }
    }
    return this.call(req, { type: "json_object" });
  }

  private async call(req: ModelRequest, responseFormat: ResponseFormat): Promise<ModelResponse> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      signal: req.signal,
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: req.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        response_format: responseFormat,
        max_tokens: 1200,
      }),
    });
    if (!res.ok) throw new HttpError(res.status, await res.text());
    const data = (await res.json()) as ChatCompletion;
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    };
  }
}
