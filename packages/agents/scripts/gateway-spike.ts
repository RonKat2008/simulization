// Owner: Person B. `pnpm --filter sim spike:gateway`: one takeTurn per company through the gateway.
import { COMPANIES } from "@simulization/shared";
import { GatewayModelClient, AI_GATEWAY_BASE_URL } from "@simulization/agents";
import { takeTurn } from "@simulization/agents";
import { withTimeout } from "@simulization/agents";
import { exit, optionalEnv, requireEnv } from "./env";
import { SCENARIOS, stateFor } from "./fixtures";

async function main(): Promise<void> {
  const key = requireEnv("AI_GATEWAY_API_KEY");
  const client = new GatewayModelClient(key, optionalEnv("AI_GATEWAY_BASE_URL") ?? AI_GATEWAY_BASE_URL);
  const scenario = SCENARIOS[0]!;
  let failed = 0;

  for (const c of COMPANIES) {
    console.log(`\n=== ${c.name} (${c.model}) scenario=${scenario.name} ===`);
    try {
      const r = await withTimeout(30_000, (signal) =>
        takeTurn({ agentId: `spike-${c.id}`, state: stateFor(c.provider, c.model), input: scenario.input, model: client, signal }),
      );
      const m = r.meta;
      console.log(`latency=${m.latencyMs}ms tokens in/out=${m.inputTokens}/${m.outputTokens} attempts=${m.attempts}`);
      console.log(`passReason=${m.passReason ?? "(none)"}`);
      console.log(`actions=${JSON.stringify(r.output.actions)}`);
      console.log(`private_plan=${r.output.private_plan.slice(0, 200)}`);
      if (m.passReason) failed++;
    } catch (err) {
      failed++;
      console.error(`FAILED: ${(err as Error).message}`);
    }
  }
  console.log(`\n${failed === 0 ? "ALL PROVIDERS OK" : `${failed} provider(s) failed`}`);
  if (failed > 0) exit(1);
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
