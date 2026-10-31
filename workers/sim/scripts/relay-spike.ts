// Owner: Person B. `pnpm --filter sim spike:relay`: exercises every RelayClient endpoint, reporting each step.
import { RelayClient, AGENTRELAY_DEFAULT_BASE_URL } from "../src/relay/relayClient";
import { exit, optionalEnv, requireEnv } from "./env";

let failures = 0;

async function step<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const out = await fn();
    const shown = out === undefined ? "" : ` -> ${JSON.stringify(out).slice(0, 400)}`;
    console.log(`PASS ${label}${shown}`);
    return out;
  } catch (err) {
    failures++;
    console.log(`FAIL ${label}: ${(err as Error).message}`);
    return undefined;
  }
}

async function main(): Promise<void> {
  const key = requireEnv("AGENTRELAY_API_KEY");
  const base = optionalEnv("AGENTRELAY_BASE_URL") ?? AGENTRELAY_DEFAULT_BASE_URL;
  console.log(`base URL: ${base} (set AGENTRELAY_BASE_URL to try another, e.g. https://api.relaycast.dev/v1)`);
  const relay = new RelayClient(key, base);
  const stamp = Date.now();
  const nameX = `spikex${stamp}`;
  const nameY = `spikey${stamp}`;
  const channel = `spike-${stamp}`;

  let tX: string | undefined;
  let tY: string | undefined;
  await step(`register agent ${nameX}`, async () => {
    tX = await relay.registerAgent(nameX);
    return "token captured";
  });
  await step(`register agent ${nameY}`, async () => {
    tY = await relay.registerAgent(nameY);
    return "token captured";
  });
  if (!tX || !tY) {
    console.log("\nCannot continue without both agent tokens (check register endpoint and token field name).");
    exit(1);
  }
  const x = tX as string;
  const y = tY as string;

  await step(`create channel ${channel}`, () => relay.createChannel(channel, "spike test"));
  await step(`invite ${nameX}`, () => relay.invite(x, channel, nameX));
  await step(`invite ${nameY}`, () => relay.invite(x, channel, nameY));
  await step(`${nameY} join`, () => relay.join(y, channel));
  await step("X posts to channel", () => relay.post(x, channel, "hello channel from X", `post-${stamp}`));
  await step("X DMs Y", () => relay.dm(x, nameY, "hello DM from X", `dm-${stamp}`));
  await step("Y reads channel messages (no cursor)", () => relay.channelMessages(y, channel));
  const convs = await step("Y lists DM conversations", () => relay.dmConversations(y));
  for (const id of convs ?? []) {
    await step(`Y reads DM conversation ${id} (no cursor)`, () => relay.dmMessages(y, id));
  }
  if (convs && convs.length === 0) {
    failures++;
    console.log("FAIL Y has no DM conversations after X's DM (check dm endpoints / response shape)");
  }
  await step("Y leaves channel", () => relay.leave(y, channel));

  console.log(`\n${failures === 0 ? "RELAY SPIKE OK" : `${failures} step(s) failed`}`);
  if (failures > 0) exit(1);
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
