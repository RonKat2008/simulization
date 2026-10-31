// Owner: Person B. Probe for the Gemini dropped-trade_offer bug: runs the trade-offers scenario through the
// production takeTurn path and reports how many turns produced a complete trade_offer.
// `cd workers/sim && npx tsx ../../packages/agents/scripts/probe-gemini-offer.ts [provider] [n]`
import { COMPANIES } from "@simulization/shared";
import { GatewayModelClient, AI_GATEWAY_BASE_URL, takeTurn } from "@simulization/agents";
import { argValue, optionalEnv, requireEnv } from "./env";
import { SCENARIOS, stateFor } from "./fixtures";

const provider = argValue("--provider") ?? "google";
const n = Number(argValue("--turns") ?? 8);
const model = COMPANIES.find((c) => c.provider === provider)!.model;
const client = new GatewayModelClient(requireEnv("AI_GATEWAY_API_KEY"), optionalEnv("AI_GATEWAY_BASE_URL") ?? AI_GATEWAY_BASE_URL);
const sc = SCENARIOS.find((s) => s.name === "trade-offers")!;
let offers = 0;
for (let i = 0; i < n; i++) {
  const out = await takeTurn({ agentId: `probe-${i}`, state: stateFor(provider, model), input: sc.input, model: client });
  const offer = out.output.actions.find((a) => a.type === "trade_offer");
  if (offer) offers++;
  console.log(i, offer ? JSON.stringify(offer) : `no offer (${out.meta.passReason ?? out.output.actions.map((a) => a.type).join(",")})`);
}
console.log(`${provider}: ${offers}/${n} turns made a complete trade_offer`);
