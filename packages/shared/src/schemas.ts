import { z } from 'zod';
import { MAX_ACTIONS, MEMORY_MAX_CHARS, PHASES } from './config';

export const PhaseSchema = z.enum(PHASES);
export type Phase = z.infer<typeof PhaseSchema>;

export const ConditionSchema = z.enum(['LABELED', 'BLIND']);
export type Condition = z.infer<typeof ConditionSchema>;

export const EVENT_TYPES = [
  'message', 'coalition_create', 'coalition_join', 'coalition_leave',
  'pact_propose', 'pact_accept', 'pact_break',
  'trade_offer', 'trade_accept', 'trade_decline',
  'work', 'contribute', 'steal', 'caught', 'pass', 'system',
] as const;
export const EventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventTypeSchema>;

export const FLAGS = ['lie', 'theft', 'broken_pact', 'rule_break', 'eval_aware'] as const;
export const FlagSchema = z.enum(FLAGS);
export type Flag = z.infer<typeof FlagSchema>;

/** 'public' | 'dm' | coalition channel id (e.g. 'coalition-1'). */
export const ChannelSchema = z.string().min(1);
export type Channel = z.infer<typeof ChannelSchema>;

export const ClaimSchema = z.object({
  goodId: z.string(),
  claimedQuality: z.number().int().min(1).max(10),
  price: z.number().int().min(0),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const GroundTruthSchema = z.object({
  trueQuality: z.number().int().min(1).max(10),
});
export type GroundTruth = z.infer<typeof GroundTruthSchema>;

export const EventSchema = z.object({
  id: z.string(), // `${runId}-${seq}`
  runId: z.string(),
  seq: z.number().int().min(1),
  round: z.number().int().min(0),
  phase: PhaseSchema,
  type: EventTypeSchema,
  actorId: z.string(), // agent id or "world"
  actorCompany: z.string().optional(), // company letter; absent for "world"
  targetId: z.string().optional(),
  targetCompany: z.string().optional(),
  channel: ChannelSchema.optional(),
  text: z.string().optional(),
  privatePlan: z.string().optional(),
  claim: ClaimSchema.optional(),
  groundTruth: GroundTruthSchema.optional(),
  flags: z.array(FlagSchema),
  ts: z.number().int(), // epoch ms
});
export type Event = z.infer<typeof EventSchema>;

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), channel: ChannelSchema, to: z.string().optional(), text: z.string() }),
  z.object({ type: z.literal('coalition_create'), name: z.string() }),
  z.object({ type: z.literal('coalition_join'), coalitionId: z.string() }),
  z.object({ type: z.literal('coalition_leave') }),
  z.object({ type: z.literal('pact_propose'), targetId: z.string() }),
  z.object({ type: z.literal('pact_accept'), targetId: z.string() }),
  z.object({
    type: z.literal('trade_offer'),
    targetId: z.string(),
    goodId: z.string(),
    claimedQuality: z.number(),
    price: z.number(),
  }),
  z.object({ type: z.literal('trade_accept'), offerId: z.string() }),
  z.object({ type: z.literal('trade_decline'), offerId: z.string() }),
  z.object({ type: z.literal('work') }),
  z.object({ type: z.literal('contribute') }),
  z.object({ type: z.literal('steal'), targetId: z.string() }),
  z.object({ type: z.literal('pass') }),
]);
export type Action = z.infer<typeof ActionSchema>;
export type ActionType = Action['type'];

const InventoryItemSchema = z.object({ goodId: z.string(), trueQuality: z.number() });
const OfferSchema = z.object({
  offerId: z.string(),
  fromId: z.string(),
  goodId: z.string(),
  claimedQuality: z.number(),
  price: z.number(),
});
const CoalitionInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(z.string()),
});
const InboxMessageSchema = z.object({
  from: z.string(),
  channel: ChannelSchema,
  text: z.string(),
  round: z.number().int(),
});

export const AgentTurnInputSchema = z.object({
  self: z.object({
    id: z.string(),
    name: z.string(),
    company: z.string(),
    coins: z.number(),
    inventory: z.array(InventoryItemSchema),
    coalitionId: z.string().nullable(),
    pacts: z.array(z.string()), // partner agent ids
    inStocks: z.boolean(),
  }),
  round: z.number().int(),
  phase: PhaseSchema,
  tradeStep: z.enum(['offers', 'responses']).optional(),
  rules: z.array(z.string()),
  // BLIND: the `company` key is absent entirely.
  otherAgents: z.array(z.object({ id: z.string(), name: z.string(), company: z.string().optional() })),
  openOffers: z.array(OfferSchema),
  coalitions: z.array(CoalitionInfoSchema),
  lanternFund: z.number(),
  inbox: z.array(InboxMessageSchema), // last 10
  memory: z.string(),
  legalActions: z.array(z.string()),
});
export type AgentTurnInput = z.infer<typeof AgentTurnInputSchema>;

export const AgentTurnOutputSchema = z.object({
  private_plan: z.string(),
  actions: z.array(ActionSchema).max(MAX_ACTIONS),
  memory_update: z.string().max(MEMORY_MAX_CHARS),
});
export type AgentTurnOutput = z.infer<typeof AgentTurnOutputSchema>;

export const AgentStateSchema = z.object({
  name: z.string(),
  company: z.string(),
  provider: z.string(),
  model: z.string(),
  memory: z.string(),
  inboxCursor: z.string().nullable(), // AgentRelay cursor; type unconfirmed, opaque string
});
export type AgentState = z.infer<typeof AgentStateSchema>;
