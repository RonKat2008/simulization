// Run: pnpm --filter sim exec tsx ../../packages/agents/scripts/smoke-stub.ts   (or `pnpm --filter @simulization/agents smoke:stub`)
import assert from "node:assert/strict";
import { AgentTurnOutputSchema, COMPANIES, LIE_THRESHOLD, NAMES, PHASES, type AgentTurnInput, type Phase } from "@simulization/shared";
import { MemoryAgentStore, runAgentTurns, StubModelClient, type TurnMeta } from "../src/index";

const IDS = NAMES.map((_, i) => `agent-${i + 1}`);
const ROUNDS = 3;
const LEGAL: Record<Phase, string[]> = {
  negotiate: ["message", "coalition_create", "coalition_join", "coalition_leave", "pact_propose", "pact_accept", "pass"],
  trade: ["trade_offer", "trade_accept", "trade_decline", "pass"],
  act: ["work", "contribute", "steal", "pass"],
  reveal: ["pass"],
};

function inputFor(idx: number, round: number, phase: Phase): AgentTurnInput {
  const id = IDS[idx]!;
  return {
    self: {
      id, name: NAMES[idx]!, company: COMPANIES[idx % 3]!.id, coins: 10,
      inventory: [{ goodId: `${id}-g1`, trueQuality: 3 + (idx % 6) }, { goodId: `${id}-g2`, trueQuality: 9 }],
      coalitionId: null, pacts: [], inStocks: false,
    },
    round, phase, rules: [],
    otherAgents: IDS.filter((o) => o !== id).map((o, i) => ({ id: o, name: NAMES[i]!, company: COMPANIES[i % 3]!.id })),
    openOffers: phase === "trade" ? [{ offerId: `offer-${round}`, fromId: IDS[(idx + 1) % 18]!, goodId: "x", claimedQuality: 5, price: 3 }] : [],
    coalitions: [{ id: "coalition-1", name: "Lantern Guild", members: [IDS[0]!] }],
    lanternFund: 0, inbox: [], memory: "", legalActions: LEGAL[phase],
  };
}

async function play(seed: number) {
  const metas: TurnMeta[] = [];
  const store = new MemoryAgentStore({ model: new StubModelClient({ seed, invalidRate: 0.2 }), onTurn: (_r, m) => metas.push(m) });
  for (let i = 0; i < 18; i++) {
    const c = COMPANIES[i % 3]!;
    await store.init("run-1", IDS[i]!, { name: NAMES[i]!, company: c.id, provider: c.provider, model: c.model, memory: "", inboxCursor: null });
  }
  const outputs: unknown[] = [];
  let lies = 0;
  for (let round = 1; round <= ROUNDS; round++) {
    for (const phase of PHASES) {
      const turns = IDS.map((agentId, i) => ({ agentId, provider: COMPANIES[i % 3]!.provider, input: inputFor(i, round, phase) }));
      const results = await runAgentTurns(store, "run-1", turns);
      results.forEach((r, i) => {
        assert.ok(AgentTurnOutputSchema.safeParse(r.output).success, "invalid AgentTurnOutput");
        for (const a of r.output.actions) {
          assert.ok(LEGAL[phase].includes(a.type), `illegal action ${a.type} in ${phase}`);
          if (a.type === "trade_offer") {
            const good = turns[i]!.input.self.inventory.find((g) => g.goodId === a.goodId);
            assert.ok(good, "trade_offer uses a real good");
            if (Math.abs(a.claimedQuality - good.trueQuality) >= LIE_THRESHOLD) lies++;
          }
        }
        outputs.push(r.output);
      });
    }
  }
  return { outputs, metas, lies };
}

const a = await play(42);
const b = await play(42);
const passes = a.metas.filter((m) => m.passReason).length;
const repaired = a.metas.filter((m) => m.attempts > 1 && !m.passReason).length;
assert.equal(JSON.stringify(a.outputs), JSON.stringify(b.outputs), "same seed must give identical outputs");
assert.ok(passes > 0, "expected some passes from invalid output");
assert.ok(repaired > 0, "expected some repaired turns");
assert.ok(a.lies > 0, "expected at least one lie-type trade offer");
console.log(`ok: ${a.outputs.length} turns, ${repaired} repaired, ${passes} passes, ${a.lies} lies, deterministic`);
