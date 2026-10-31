// Offline smoke test for the turn pipeline (no keys): repair retry, illegal-action filtering, failure → pass.
import { createRng, stubTurn, type AgentState, type AgentStore, type AgentTurnInput } from "@simulization/shared";
import { runAgentTurns } from "@simulization/agents";
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
console.log("smoke-turns OK");
