import { CreateRunResponseSchema, readErrorMessage, type CreateRunBody } from "./schemas";

export type StartResult = { ok: true; runId: string } | { ok: false; message: string };

/** POST /api/runs; maps 400/409/503/network/shape failures to readable messages. */
export async function startRun(body: CreateRunBody, requestId: string = crypto.randomUUID()): Promise<StartResult> {
  try {
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": requestId },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await readErrorMessage(res);
      if (res.status === 503) return { ok: false, message: `The run service is unavailable (503). ${detail}` };
      if (res.status === 400) return { ok: false, message: `The server rejected these options (400). ${detail}` };
      if (res.status === 409) return { ok: false, message: `${detail} (409).` };
      return { ok: false, message: detail };
    }
    const parsed = CreateRunResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, message: "The server returned an unexpected response." };
    return { ok: true, runId: parsed.data.runId };
  } catch {
    return { ok: false, message: "Could not reach the server. Check that the app and simulation runtime are running." };
  }
}
