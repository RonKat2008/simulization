// Owner: Person B. Keyless ModelClient: runs the real pipeline (prompt, parse, repair, pass) against a seeded merchant bot.
import {
  AgentTurnInputSchema,
  createRng,
  LIE_THRESHOLD,
  MEMORY_MAX_CHARS,
  QUALITY_MAX,
  QUALITY_MIN,
  stubTurn,
  type Action,
  type AgentTurnInput,
  type AgentTurnOutput,
  type Rng,
} from "@simulization/shared";
import type { ModelClient, ModelRequest, ModelResponse } from "./types";

export interface StubModelOptions {
  /** Base seed; combined with agent id, round, phase and attempt. Default 1. */
  seed?: number;
  /** 0..1: fraction of replies that are garbage text (exercises repair retry and pass). Default 0. */
  invalidRate?: number;
  /** Simulated latency per call, honoring the abort signal. Default 0. */
  latencyMs?: number;
}

/** FNV-1a string hash to a uint32. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      reject(new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const clampQuality = (q: number): number => Math.max(QUALITY_MIN, Math.min(QUALITY_MAX, q));

/** A quality claim at least LIE_THRESHOLD away from the truth (inflated unless that is impossible). */
function lieQuality(trueQuality: number, rng: Rng): number {
  const delta = rng.int(LIE_THRESHOLD, LIE_THRESHOLD + 2);
  return trueQuality + delta <= QUALITY_MAX ? trueQuality + delta : clampQuality(trueQuality - delta);
}

/** Merchant-flavored candidate actions; only legal types and ids taken from the input. */
function merchantActions(input: AgentTurnInput, rng: Rng): Action[] {
  const legal = new Set(input.legalActions);
  const others = input.otherAgents.map((a) => a.id).filter((id) => id !== input.self.id);
  const out: Action[] = [];
  const target = others.length > 0 ? rng.pick(others) : undefined;

  if (legal.has("trade_offer") && target && input.self.inventory.length > 0 && rng.next() < 0.6) {
    const good = rng.pick(input.self.inventory);
    const lying = rng.next() < 0.45;
    out.push({
      type: "trade_offer",
      targetId: target,
      goodId: good.goodId,
      claimedQuality: lying ? lieQuality(good.trueQuality, rng) : good.trueQuality,
      price: rng.int(1, Math.max(1, Math.min(input.self.coins, 8))),
    });
  }
  const offer = input.openOffers[0];
  if (offer && rng.next() < 0.5) {
    out.push({ type: rng.next() < 0.6 ? "trade_accept" : "trade_decline", offerId: offer.offerId });
  }
  if (legal.has("steal") && target && rng.next() < 0.12) out.push({ type: "steal", targetId: target });
  if (!input.self.coalitionId) {
    if (legal.has("coalition_join") && input.coalitions[0] && rng.next() < 0.5) {
      out.push({ type: "coalition_join", coalitionId: rng.pick(input.coalitions).id });
    } else if (legal.has("coalition_create") && rng.next() < 0.25) {
      out.push({ type: "coalition_create", name: `${input.self.name}'s Lantern Guild` });
    }
  }
  if (legal.has("pact_propose") && target && rng.next() < 0.3) out.push({ type: "pact_propose", targetId: target });
  if (legal.has("pact_accept") && target && input.self.pacts.length === 0 && rng.next() < 0.2) {
    out.push({ type: "pact_accept", targetId: target });
  }
  if (legal.has("work") && rng.next() < 0.3) out.push({ type: "work" });
  if (legal.has("contribute") && rng.next() < 0.3) out.push({ type: "contribute" });
  return out.filter((a) => legal.has(a.type));
}

export function stubTurnForInput(input: AgentTurnInput, rng: Rng): AgentTurnOutput {
  const picked = rng.shuffle(merchantActions(input, rng)).slice(0, 2);
  if (picked.length === 0) return stubTurn(input, rng);
  return {
    private_plan: `Stub merchant plan, round ${input.round} ${input.phase}: ${picked.map((a) => a.type).join(", ")}.`,
    actions: picked,
    memory_update: `${input.memory}\nR${input.round} ${input.phase}: ${picked.map((a) => a.type).join(",")}`.slice(-MEMORY_MAX_CHARS),
  };
}

export class StubModelClient implements ModelClient {
  private readonly seed: number;
  private readonly invalidRate: number;
  private readonly latencyMs: number;

  constructor(opts: StubModelOptions = {}) {
    this.seed = opts.seed ?? 1;
    this.invalidRate = opts.invalidRate ?? 0;
    this.latencyMs = opts.latencyMs ?? 0;
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    if (this.latencyMs > 0) await sleep(this.latencyMs, req.signal);
    const input = this.parseInput(req.user);
    // The repair retry appends text after the JSON line; give it its own seed stream so it can recover.
    const attempt = req.user.includes("Your previous reply was not valid") ? 2 : 1;
    const rng = createRng(hash(`${this.seed}|${input.self.id}|${input.round}|${input.phase}|${attempt}`));

    const text =
      rng.next() < this.invalidRate
        ? rng.pick(["Sorry, I cannot produce JSON right now.", '{"private_plan": "oops", "actions": [', '{"actions": "none"}'])
        : JSON.stringify(stubTurnForInput(input, rng));
    return { text, inputTokens: Math.ceil((req.system.length + req.user.length) / 4), outputTokens: Math.ceil(text.length / 4) };
  }

  /** User message is "Round X, phase Y. Your situation:\n<json>" (+ optional repair text on later lines). */
  private parseInput(user: string): AgentTurnInput {
    const line = user.split("\n")[1];
    if (!line) throw new Error("StubModelClient: user message has no JSON line");
    return AgentTurnInputSchema.parse(JSON.parse(line));
  }
}
