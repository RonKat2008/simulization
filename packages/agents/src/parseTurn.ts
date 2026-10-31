// Owner: Person B. Turns raw model text into a valid, legal AgentTurnOutput.
import {
  AgentTurnOutputSchema,
  MAX_ACTIONS,
  MEMORY_MAX_CHARS,
  MESSAGE_MAX_CHARS,
  type Action,
  type AgentTurnOutput,
} from "@simulization/shared";

export type ParseResult = { ok: true; output: AgentTurnOutput; dropped: number } | { ok: false; error: string };

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

/** Light pre-validation cleanup so near-misses (long memory, long text, 3 actions) still count. */
function normalize(raw: unknown): { value: unknown; invalid: number } {
  if (typeof raw !== "object" || raw === null) return { value: raw, invalid: 0 };
  const obj = raw as Record<string, unknown>;
  const all = Array.isArray(obj.actions) ? obj.actions : undefined;
  const acceptable = all?.filter(isAcceptableAction);
  const invalid = all && acceptable ? all.length - acceptable.length : 0;
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
  const parsed = AgentTurnOutputSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: `schema: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` };
  }
  const legal = new Set(legalActions);
  const kept: Action[] = parsed.data.actions.filter((a) => legal.has(a.type));
  const dropped = invalid + parsed.data.actions.length - kept.length;
  return {
    ok: true,
    dropped,
    output: { ...parsed.data, actions: kept.length > 0 ? kept : [{ type: "pass" }] },
  };
}

export function passOutput(reason: string, memory: string): AgentTurnOutput {
  return { private_plan: `(pass: ${reason})`, actions: [{ type: "pass" }], memory_update: memory };
}
