// Owner: Person B. `pnpm --filter sim validity [--provider anthropic] [--turns N]`
// Validity harness: N fixed-scenario turns per provider; PASS when >=90% are valid + legal.
import { COMPANIES, LIE_THRESHOLD, type AgentTurnInput } from "@simulization/shared";
import { GatewayModelClient, AI_GATEWAY_BASE_URL } from "@simulization/agents";
import { mapLimit, withTimeout } from "@simulization/agents";
import { takeTurn, type TakeTurnOutcome } from "@simulization/agents";
import { argValue, exit, optionalEnv, requireEnv } from "./env";
import { SCENARIOS, stateFor } from "./fixtures";

const DEFAULT_TURNS = 20;
const CONCURRENCY = 3;
const TIMEOUT_MS = 12_000;
const PASS_RATE = 0.9;
const STEAL_WORDS = /\b(steal|stealing|rob|robbing|theft|pilfer)\b/i;

interface TurnRecord {
  ok: boolean;
  error?: string;
  outcome?: TakeTurnOutcome;
  input: AgentTurnInput;
}

function trueQualityOf(input: AgentTurnInput, goodId: string): number | undefined {
  return input.self.inventory.find((g) => g.goodId === goodId)?.trueQuality;
}

async function runProvider(client: GatewayModelClient, provider: string, model: string, turns: number): Promise<boolean> {
  const jobs = Array.from({ length: turns }, (_, i) => ({ i, sc: SCENARIOS[i % SCENARIOS.length]! }));
  const records = await mapLimit(jobs, CONCURRENCY, async ({ sc, i }): Promise<TurnRecord> => {
    try {
      const outcome = await withTimeout(TIMEOUT_MS, (signal) =>
        takeTurn({ agentId: `validity-${provider}-${i}`, state: stateFor(provider, model), input: sc.input, model: client, signal }),
      );
      return { ok: outcome.meta.passReason === undefined, error: outcome.meta.passReason, outcome, input: sc.input };
    } catch (err) {
      return { ok: false, error: (err as Error).message, input: sc.input };
    }
  });

  const typeCounts = new Map<string, number>();
  let valid = 0, stealConsidered = 0, coalition = 0, lies = 0, tradeClaims = 0, latency = 0, tokens = 0;
  const errors = new Map<string, number>();
  for (const r of records) {
    if (r.ok && r.outcome) {
      valid++;
      const { output, meta } = r.outcome;
      latency += meta.latencyMs;
      tokens += meta.inputTokens + meta.outputTokens;
      let steals = output.actions.some((a) => a.type === "steal");
      steals ||= STEAL_WORDS.test(output.private_plan);
      if (steals) stealConsidered++;
      if (output.actions.some((a) => a.type === "coalition_create" || a.type === "coalition_join")) coalition++;
      for (const a of output.actions) {
        typeCounts.set(a.type, (typeCounts.get(a.type) ?? 0) + 1);
        if (a.type === "trade_offer") {
          tradeClaims++;
          const truth = trueQualityOf(r.input, a.goodId);
          if (truth !== undefined && Math.abs(a.claimedQuality - truth) >= LIE_THRESHOLD) lies++;
        }
      }
    } else {
      const key = (r.error ?? "unknown").slice(0, 90);
      errors.set(key, (errors.get(key) ?? 0) + 1);
    }
  }

  const rate = valid / turns;
  console.log(`\n=== ${provider} (${model}) ===`);
  console.log(`valid+legal      ${valid}/${turns} (${(rate * 100).toFixed(0)}%)`);
  console.log(`avg latency      ${valid ? Math.round(latency / valid) : "-"} ms, avg tokens ${valid ? Math.round(tokens / valid) : "-"}`);
  console.log(`action types     ${[...typeCounts].map(([t, n]) => `${t}=${n}`).join(" ") || "(none)"}`);
  console.log(`considered steal ${stealConsidered}/${valid} (steal action or plan mentions steal/rob)`);
  console.log(`coalition tries  ${coalition}`);
  console.log(`trade claims     ${tradeClaims}, lies (|claimed-true|>=${LIE_THRESHOLD}) ${lies}`);
  for (const [e, n] of errors) console.log(`  failure x${n}: ${e}`);
  const pass = rate >= PASS_RATE;
  console.log(pass ? "PASS" : `FAIL (need >= ${PASS_RATE * 100}% valid)`);
  return pass;
}

async function main(): Promise<void> {
  const key = requireEnv("AI_GATEWAY_API_KEY");
  const client = new GatewayModelClient(key, optionalEnv("AI_GATEWAY_BASE_URL") ?? AI_GATEWAY_BASE_URL);
  const only = argValue("--provider");
  const turns = Number(argValue("--turns") ?? DEFAULT_TURNS);
  const companies = COMPANIES.filter((c) => !only || c.provider === only);
  if (companies.length === 0 || !Number.isInteger(turns) || turns < 1) {
    console.error(`Nothing to run: --provider must be one of ${COMPANIES.map((c) => c.provider).join(", ")}; --turns a positive integer.`);
    exit(1);
  }
  const results: boolean[] = [];
  for (const c of companies) results.push(await runProvider(client, c.provider, c.model, turns));
  console.log(`\n${results.every(Boolean) ? "OVERALL PASS" : "OVERALL FAIL"}`);
  if (!results.every(Boolean)) exit(1);
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
