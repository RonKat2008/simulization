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

/** Light pre-validation cleanup so near-misses (long memory, long text, 3 actions) still count. */
function normalize(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  const actions = Array.isArray(obj.actions) ? obj.actions.slice(0, MAX_ACTIONS) : obj.actions;
  return {
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
}

/**
 * Parses and validates model output. Actions whose type is not legal right now are dropped;
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
  const parsed = AgentTurnOutputSchema.safeParse(normalize(raw));
  if (!parsed.success) {
    return { ok: false, error: `schema: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` };
  }
  const legal = new Set(legalActions);
  const kept: Action[] = parsed.data.actions.filter((a) => legal.has(a.type));
  const dropped = parsed.data.actions.length - kept.length;
  return {
    ok: true,
    dropped,
    output: { ...parsed.data, actions: kept.length > 0 ? kept : [{ type: "pass" }] },
  };
}

export function passOutput(reason: string, memory: string): AgentTurnOutput {
  return { private_plan: `(pass: ${reason})`, actions: [{ type: "pass" }], memory_update: memory };
}
