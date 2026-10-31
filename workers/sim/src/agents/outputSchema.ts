// Owner: Person B. Provider-friendly JSON Schema for AgentTurnOutput.
// Deliberately flat (no oneOf/anyOf): Gemini and OpenAI structured output both reject or
// restrict union keywords. Exact per-type validation happens afterwards with zod (parseTurn).
import { EVENT_TYPES, MAX_ACTIONS, MEMORY_MAX_CHARS, MESSAGE_MAX_CHARS } from "@simulization/shared";

const ACTION_TYPES = EVENT_TYPES.filter(
  (t) => !["pact_break", "caught", "system"].includes(t),
);

export const TURN_OUTPUT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    private_plan: { type: "string" },
    actions: {
      type: "array",
      maxItems: MAX_ACTIONS,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ACTION_TYPES },
          channel: { type: "string", description: "message only: 'public', 'dm', or your coalition id" },
          to: { type: "string", description: "message with channel 'dm': recipient agent id" },
          text: { type: "string", maxLength: MESSAGE_MAX_CHARS },
          name: { type: "string", description: "coalition_create: coalition name" },
          coalitionId: { type: "string" },
          targetId: { type: "string" },
          goodId: { type: "string" },
          claimedQuality: { type: "integer", minimum: 1, maximum: 10 },
          price: { type: "integer", minimum: 0 },
          offerId: { type: "string" },
        },
        required: ["type"],
      },
    },
    memory_update: { type: "string", maxLength: MEMORY_MAX_CHARS },
  },
  required: ["private_plan", "actions", "memory_update"],
};
