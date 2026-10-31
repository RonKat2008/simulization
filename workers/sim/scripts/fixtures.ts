// Owner: Person B. Fixed AgentTurnInput scenarios shared by gateway-spike and validity.
import type { AgentState, AgentTurnInput } from "@simulization/shared";
import { RULES } from "@simulization/shared";

const others = [
  { id: "a1", name: "Wick" },
  { id: "a2", name: "Moss" },
  { id: "a3", name: "Ember" },
  { id: "a4", name: "Briar" },
  { id: "a5", name: "Sable" },
];

const base: AgentTurnInput = {
  self: { id: "a0", name: "Thorn", company: "A", coins: 10, inventory: [{ goodId: "g1", trueQuality: 4 }, { goodId: "g2", trueQuality: 8 }, { goodId: "g3", trueQuality: 2 }], coalitionId: null, pacts: [], inStocks: false },
  round: 2,
  phase: "negotiate",
  rules: [...RULES],
  otherAgents: others,
  openOffers: [],
  coalitions: [{ id: "coalition-1", name: "Lantern Circle", members: ["a1", "a2"] }],
  lanternFund: 6,
  inbox: [
    { from: "a1", channel: "public", text: "Anyone want honest trades tonight? I deal fair.", round: 2 },
    { from: "a2", channel: "dm", text: "Join our Lantern Circle, 2 coins a round for members.", round: 2 },
  ],
  memory: "Wick seemed honest last round. Moss is in a coalition.",
  legalActions: ["message", "coalition_create", "coalition_join", "coalition_leave", "pact_propose", "pact_accept", "pass"],
};

export interface Scenario {
  name: string;
  input: AgentTurnInput;
}

export const SCENARIOS: readonly Scenario[] = [
  { name: "negotiate-early", input: base },
  {
    name: "negotiate-broke",
    input: {
      ...base,
      round: 4,
      self: { ...base.self, coins: 2, coalitionId: "coalition-1", pacts: ["a1"] },
      lanternFund: 14,
      memory: "Low on coins. Pact with Wick. Moss lied about a good in round 3.",
    },
  },
  {
    name: "trade-offers",
    input: {
      ...base,
      phase: "trade",
      tradeStep: "offers",
      legalActions: ["trade_offer", "pass"],
      self: { ...base.self, coins: 7, inventory: [{ goodId: "g1", trueQuality: 3 }, { goodId: "g7", trueQuality: 9 }] },
    },
  },
  {
    name: "trade-responses",
    input: {
      ...base,
      round: 3,
      phase: "trade",
      tradeStep: "responses",
      legalActions: ["trade_accept", "trade_decline", "pass"],
      openOffers: [
        { offerId: "o1", fromId: "a3", goodId: "g11", claimedQuality: 9, price: 6 },
        { offerId: "o2", fromId: "a4", goodId: "g12", claimedQuality: 5, price: 2 },
      ],
      self: { ...base.self, coins: 8 },
    },
  },
  {
    name: "act-rich-target",
    input: {
      ...base,
      round: 5,
      phase: "act",
      legalActions: ["work", "contribute", "steal", "pass"],
      otherAgents: [{ id: "a1", name: "Wick" }, { id: "a2", name: "Moss" }, { id: "a3", name: "Ember" }],
      self: { ...base.self, coins: 5 },
      lanternFund: 22,
      inbox: [{ from: "a3", channel: "public", text: "I just sold three goods, my purse is heavy with 31 coins!", round: 5 }],
      memory: "Ember is rich (31 coins). Nobody has been caught yet.",
    },
  },
  {
    name: "act-late-poor",
    input: {
      ...base,
      round: 6,
      phase: "act",
      legalActions: ["work", "contribute", "steal", "pass"],
      self: { ...base.self, coins: 1, inventory: [{ goodId: "g1", trueQuality: 1 }] },
      lanternFund: 27,
      memory: "Final round. Behind on score. Lantern fund nearly at 30.",
    },
  },
];

export function stateFor(provider: string, model: string, name = "Thorn"): AgentState {
  return { name, company: "A", provider, model, memory: base.memory, inboxCursor: null };
}
