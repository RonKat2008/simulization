// Owner: Person B. Turns raw model text into a valid, legal AgentTurnOutput.
import {
  ActionSchema,
  AgentTurnOutputSchema,
  MAX_ACTIONS,
  MEMORY_MAX_CHARS,
  MESSAGE_MAX_CHARS,
  type Action,
  type AgentTurnOutput,
} from "@simulization/shared";

export type ParseResult =
  | {
      ok: true;
      output: AgentTurnOutput;
      dropped: number;
      /** Per-action schema problems (those actions were dropped). Non-empty with nothing kept = worth a repair retry. */
      schemaIssues: string[];
      /** True when the model proposed actions but none survived (output is a fallback pass). */
      allDropped: boolean;
    }
  | { ok: false; error: string };

const TARGET_ID_TYPES = "pact_propose, pact_accept, trade_offer, steal";

/** Names the exact missing/invalid field per action so a repair retry (and logs) can be specific. */
export function describeActionIssue(index: number, action: unknown, issues: readonly { path: PropertyKey[]; message: string }[]): string {
  const type = typeof action === "object" && action !== null ? String((action as Record<string, unknown>).type) : "?";
  const fields = issues.map((i) => String(i.path[0] ?? "(action)")).filter((f, k, a) => a.indexOf(f) === k);
  return `actions.${index} (${type}) needs field ${fields.join(", ")}`;
}

/** Hint text appended to the repair message: which action types require which fields. */
export const ACTION_FIELD_HINT =
  `Required fields per action type: ${TARGET_ID_TYPES} require "targetId" (the other agent's id); ` +
  `trade_offer also needs goodId, claimedQuality (int 1-10), price (int >= 0); ` +
  `trade_accept and trade_decline require "offerId"; coalition_join requires "coalitionId"; coalition_create requires "name"; ` +
  `message requires "channel" and "text" (plus "to" for dm).`;

/** Strips ``` fences and any prose around the outermost JSON object. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

const isIntInRange = (v: unknown, min: number, max: number): boolean =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const isNonEmptyString = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;

/**
 * Semantic range checks on a raw action; false means "drop it" (counted as dropped, not a schema failure).
 * Non-objects and unknown shapes pass through so the schema still reports them.
 */
function isAcceptableAction(a: unknown): boolean {
  if (typeof a !== "object" || a === null) return true;
  const act = a as Record<string, unknown>;
  if (act.type === "trade_offer") {
    return isIntInRange(act.claimedQuality, 1, 10) && isIntInRange(act.price, 0, Infinity);
  }
  if (act.type === "message") {
    return isNonEmptyString(act.text) && (act.channel !== "dm" || isNonEmptyString(act.to));
  }
  return true;
}

/** Action types whose counterpart goes in targetId (a dm message keeps `to`). */
const TARGETED = new Set(["pact_propose", "pact_accept", "trade_offer", "steal"]);

/**
 * Maps common field-name synonyms to the schema's names, the same way for every provider. In JSON mode Gemini
 * writes a trade_offer's counterpart as `recipient`; without this, every such offer was dropped.
 */
function withFieldAliases(act: Record<string, unknown>): Record<string, unknown> {
  if (typeof act.type !== "string" || !TARGETED.has(act.type)) return act;
  const out = { ...act };
  if (out.targetId === undefined) {
    const alias = [out.recipient, out.target, out.to, out.agentId].find((v) => typeof v === "string" && v.length > 0);
    if (alias !== undefined) out.targetId = alias;
  }
  if (act.type === "trade_offer" && out.claimedQuality === undefined && out.quality !== undefined) out.claimedQuality = out.quality;
  return out;
}

/** Light pre-validation cleanup so near-misses (long memory, long text, 3 actions) still count. */
function normalize(raw: unknown): { value: unknown; invalid: number } {
  if (typeof raw !== "object" || raw === null) return { value: raw, invalid: 0 };
  const obj = raw as Record<string, unknown>;
  const all = Array.isArray(obj.actions) ? obj.actions : undefined;
  const aliased = all?.map((a) => (typeof a === "object" && a !== null ? withFieldAliases(a as Record<string, unknown>) : a));
  const acceptable = aliased?.filter(isAcceptableAction);
  const invalid = aliased && acceptable ? aliased.length - acceptable.length : 0;
  const actions = acceptable ? acceptable.slice(0, MAX_ACTIONS) : obj.actions;
  const value = {
    ...obj,
    memory_update: typeof obj.memory_update === "string" ? obj.memory_update.slice(0, MEMORY_MAX_CHARS) : obj.memory_update,
    actions: Array.isArray(actions)
      ? actions.map((a) => {
          if (typeof a !== "object" || a === null) return a;
          const act = a as Record<string, unknown>;
          return typeof act.text === "string" ? { ...act, text: act.text.slice(0, MESSAGE_MAX_CHARS) } : act;
        })
      : actions,
  };
  return { value, invalid };
}

/**
 * Parses and validates model output. Actions whose type is not legal right now, or whose values are out of
 * range (trade_offer quality not int 1..10 / price not int >= 0, dm without `to`, empty text), are dropped;
 * if nothing legal remains the turn is a pass. Semantic legality (owns the good, target exists)
 * is the WorldActor's job.
 */
export function parseTurn(text: string, legalActions: readonly string[]): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJson(text));
  } catch (err) {
    return { ok: false, error: `invalid JSON: ${(err as Error).message}` };
  }
  const { value, invalid } = normalize(raw);
  // Validate each action on its own so one malformed action (e.g. a steal with no targetId) is dropped
  // instead of failing the whole turn.
  const schemaIssues: string[] = [];
  const proposed = Array.isArray((value as { actions?: unknown })?.actions) ? ((value as { actions: unknown[] }).actions) : undefined;
  let candidate = value;
  if (proposed) {
    const good: unknown[] = [];
    proposed.forEach((a, i) => {
      const r = ActionSchema.safeParse(a);
      if (r.success) good.push(a);
      else schemaIssues.push(describeActionIssue(i, a, r.error.issues));
    });
    candidate = { ...(value as Record<string, unknown>), actions: good };
  }
  const parsed = AgentTurnOutputSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, error: `schema: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` };
  }
  const legal = new Set(legalActions);
  const kept: Action[] = parsed.data.actions.filter((a) => legal.has(a.type));
  const dropped = invalid + schemaIssues.length + parsed.data.actions.length - kept.length;
  return {
    ok: true,
    dropped,
    schemaIssues,
    allDropped: kept.length === 0 && dropped > 0,
    output: { ...parsed.data, actions: kept.length > 0 ? kept : [{ type: "pass" }] },
  };
}

export function passOutput(reason: string, memory: string): AgentTurnOutput {
  return { private_plan: `(pass: ${reason})`, actions: [{ type: "pass" }], memory_update: memory };
}
