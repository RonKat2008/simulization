// Owner: Person B. `pnpm --filter sim models`: lists small/fast gateway models and checks COMPANIES ids exist.
import { COMPANIES } from "@simulization/shared";
import { AI_GATEWAY_BASE_URL } from "../src/agents/gatewayModel";
import { exit, optionalEnv, requireEnv } from "./env";

const PROVIDERS = ["anthropic", "openai", "google"];
const FAST = /(haiku|nano|mini|flash|lite)/i;

async function main(): Promise<void> {
  const key = requireEnv("AI_GATEWAY_API_KEY");
  const base = optionalEnv("AI_GATEWAY_BASE_URL") ?? AI_GATEWAY_BASE_URL;
  const res = await fetch(`${base}/models`, { headers: { authorization: `Bearer ${key}` } });
  if (!res.ok) {
    console.error(`GET ${base}/models failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    exit(1);
  }
  const body = (await res.json()) as { data?: Array<{ id: string }> };
  const ids = (body.data ?? []).map((m) => m.id).sort();
  console.log(`${ids.length} models available.\n`);

  for (const p of PROVIDERS) {
    const fast = ids.filter((id) => id.startsWith(`${p}/`) && FAST.test(id));
    console.log(`${p} (small/fast):\n${fast.map((id) => `  ${id}`).join("\n") || "  (none)"}\n`);
  }

  const set = new Set(ids);
  let missing = 0;
  console.log("Configured COMPANIES models:");
  for (const c of COMPANIES) {
    const ok = set.has(c.model);
    if (!ok) missing++;
    console.log(`  ${ok ? "OK     " : "MISSING"} ${c.id} ${c.model}`);
  }
  if (missing > 0) {
    console.log(`\n${missing} configured model(s) missing: pick replacements from the lists above and edit COMPANIES in packages/shared/src/config.ts.`);
    exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
