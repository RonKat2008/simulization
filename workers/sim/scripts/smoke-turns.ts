// Offline smoke test for the turn pipeline (no keys): repair retry, illegal-action filtering, failure → pass.
import { createRng, stubTurn, type AgentState, type AgentStore, type AgentTurnInput } from "@simulization/shared";
import { MemoryAgentStore, parseTurn, relayAgentName, RunRelay, runAgentTurns, type RelayClient, type RelayMessage } from "@simulization/agents";
import { takeTurn } from "@simulization/agents";
import type { ModelClient } from "@simulization/agents";
import { SCENARIOS } from "./fixtures";

const check = (cond: boolean, msg: string): void => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
};

const state: AgentState = { name: "Wick", company: "A", provider: "anthropic", model: "fake", memory: "", inboxCursor: null };
const input: AgentTurnInput = SCENARIOS[0]!.input;

const scripted = (replies: string[]): ModelClient => {
  let i = 0;
  return { complete: async () => ({ text: replies[Math.min(i++, replies.length - 1)]!, inputTokens: 10, outputTokens: 5 }) };
};

const valid = JSON.stringify(stubTurn(input, createRng(1)));
const r1 = await takeTurn({ agentId: "A-01", state, input, model: scripted(["not json", "```json\n" + valid + "\n```"]) });
check(r1.meta.attempts === 2 && !r1.meta.passReason, "repair retry recovers fenced JSON on attempt 2");

const r2 = await takeTurn({ agentId: "A-01", state, input, model: scripted(["nope", "still nope"]) });
check(r2.output.actions[0]?.type === "pass" && !!r2.meta.passReason, "two invalid replies become a pass");

const illegal = JSON.stringify({ private_plan: "x", actions: [{ type: "steal", targetId: "B-01" }], memory_update: "m" });
const r3 = await takeTurn({ agentId: "A-01", state, input: { ...input, legalActions: ["message", "pass"] }, model: scripted([illegal]) });
check(r3.output.actions.length === 1 && r3.output.actions[0]?.type === "pass", "illegal action types are dropped → pass");
check(r3.state.memory === "m", "memory update is applied to state");

const flaky: AgentStore = {
  load: async () => state,
  save: async () => {},
  takeTurn: async (_run, agentId) => {
    if (agentId === "B-02") throw new Error("provider down");
    return stubTurn(input, createRng(2));
  },
};
const turns = ["A-01", "B-02", "C-03"].map((agentId) => ({ agentId, provider: agentId[0]!, input }));
const results = await runAgentTurns(flaky, "run-smoke", turns);
check(results.length === 3 && results.map((r) => r.agentId).join() === "A-01,B-02,C-03", "results keep input order");
check(!results[1]!.ok && results[1]!.output.actions[0]?.type === "pass", "a failing agent passes without blocking others");
check(results[0]!.ok && results[2]!.ok, "other agents complete");

// --- parseTurn drops out-of-range actions ---
const legalAll = ["message", "trade_offer", "pass"];
const wrap = (actions: unknown[]): string => JSON.stringify({ private_plan: "p", actions, memory_update: "m" });
const offer = (claimedQuality: number, price: number) => ({ type: "trade_offer", targetId: "B-01", goodId: "g", claimedQuality, price });
for (const [label, a] of [
  ["claimedQuality 11", offer(11, 1)],
  ["claimedQuality 7.5", offer(7.5, 1)],
  ["price -1", offer(5, -1)],
  ["dm without to", { type: "message", channel: "dm", text: "hi" }],
  ["empty text", { type: "message", channel: "public", text: "  " }],
] as const) {
  const p = parseTurn(wrap([a]), legalAll);
  check(p.ok && p.dropped === 1 && p.output.actions[0]?.type === "pass", `parseTurn drops ${label}`);
}
const mixed = parseTurn(wrap([offer(11, 1), offer(5, 2)]), legalAll);
check(mixed.ok && mixed.dropped === 1 && mixed.output.actions.length === 1 && mixed.output.actions[0]?.type === "trade_offer", "valid action survives an invalid sibling");

// --- a turn that resolves after its timeout must not save ---
const slowModel: ModelClient = {
  complete: async () => {
    await new Promise((r) => setTimeout(r, 150));
    return { text: valid };
  },
};
const mem = new MemoryAgentStore({ model: slowModel });
await mem.init("run-t", "A-01", state);
const ctl = new AbortController();
setTimeout(() => ctl.abort(), 30);
await mem.takeTurn("run-t", "A-01", input, ctl.signal);
check((await mem.load("run-t", "A-01")).memory === "", "late takeTurn after abort does not save");
await mem.takeTurn("run-t", "A-01", input);
check((await mem.load("run-t", "A-01")).memory !== "", "in-budget takeTurn still saves");

// --- provider-first semaphore: slow provider does not starve a fast one ---
const finishedAt = new Map<string, number>();
const delayStore: AgentStore = {
  load: async () => state,
  save: async () => {},
  takeTurn: async (_run, agentId) => {
    await new Promise((r) => setTimeout(r, agentId.startsWith("S") ? 200 : 10));
    finishedAt.set(agentId, Date.now());
    return stubTurn(input, createRng(3));
  },
};
const mixTurns = [
  ...["S1", "S2", "S3", "S4", "S5", "S6"].map((agentId) => ({ agentId, provider: "anthropic-sem", input })),
  ...["F1", "F2", "F3"].map((agentId) => ({ agentId, provider: "openai-sem", input })),
];
await runAgentTurns(delayStore, "run-sem", mixTurns);
const lastFast = Math.max(...["F1", "F2", "F3"].map((id) => finishedAt.get(id)!));
const firstSlow = Math.min(...["S1", "S2", "S3"].map((id) => finishedAt.get(id)!));
check(lastFast <= firstSlow, "fast provider finishes before the slow provider's first batch (no starvation)");

// --- inbox merges sources by message id ---
const RUN = "run-inbox";
const peer = (n: string): string => relayAgentName(RUN, n);
const msg = (id: string, from: string, text: string): RelayMessage => ({ id, from: peer(from), text });
const fakeClient = {
  channelMessages: async () => [msg("100", "B-01", "pub-1"), msg("300", "B-01", "pub-3")],
  dmConversations: async () => ["c1", "c2"],
  dmMessages: async (_t: string, conv: string) => (conv === "c1" ? [msg("200", "C-01", "dm-2")] : [msg("400", "D-01", "dm-4")]),
} as unknown as RelayClient;
const pulled = await new RunRelay(fakeClient).pullInbox(RUN, "A-01", { ...state, relayToken: "tok" }, null, 5);
check(pulled.inbox.map((m) => m.text).join() === "pub-1,dm-2,pub-3,dm-4", "inbox sorted across public + DM sources by id");
check(pulled.inbox.every((m) => m.round === 5), "inbox round stamps the round first received");
console.log("smoke-turns OK");
