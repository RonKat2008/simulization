// Owner: Person B. `pnpm --filter sim relay:e2e`: live end-to-end check of RunRelay (setup, public/dm/coalition
// delivery, inbox pulls with cursors). Needs AGENTRELAY_API_KEY; uses a unique run id so reruns never collide.
import { RelayClient, RunRelay, AGENTRELAY_DEFAULT_BASE_URL, parseCursor } from "@simulization/agents";
import type { AgentState } from "@simulization/shared";
import { exit, optionalEnv, requireEnv } from "./env";

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
}

const texts = (inbox: { from: string; channel: string; text: string }[]): string[] =>
  inbox.map((m) => `${m.from}/${m.channel}:${m.text}`);

async function main(): Promise<void> {
  const key = requireEnv("AGENTRELAY_API_KEY");
  const base = optionalEnv("AGENTRELAY_BASE_URL") ?? AGENTRELAY_DEFAULT_BASE_URL;
  console.log(`base URL: ${base}`);
  const relay = new RunRelay(new RelayClient(key, base));
  const runId = `e2e-${Date.now()}`;
  const ids = ["A-01", "A-02", "A-03"];

  const tokens = await relay.setupRun(runId, ids);
  check("setupRun registered 3 agents", ids.every((id) => !!tokens[id]), Object.keys(tokens).join(","));

  await relay.createCoalition(runId, "coal-1", tokens["A-01"]!);
  await relay.joinCoalition(runId, "coal-1", tokens["A-02"]!);

  await relay.deliverMessage(runId, tokens["A-01"]!, { channel: "public", text: "hello square" }, `${runId}-1`);
  await relay.deliverMessage(runId, tokens["A-01"]!, { channel: "dm", to: "A-02", text: "psst" }, `${runId}-2`);
  await relay.deliverMessage(runId, tokens["A-01"]!, { channel: "coal-1", text: "coalition plan" }, `${runId}-3`);
  check("delivered public + dm + coalition", true);

  const state = (id: string, cursor: string | null): AgentState => ({
    name: id, company: "x", provider: "p", model: "m", memory: "", inboxCursor: cursor, relayToken: tokens[id],
  });

  const p1 = await relay.pullInbox(runId, "A-02", state("A-02", null), "coal-1", 1);
  const got1 = texts(p1.inbox).sort();
  const want1 = ["A-01/coal-1:coalition plan", "A-01/dm:psst", "A-01/public:hello square"];
  check("first pull has all 3 messages with agent ids", JSON.stringify(got1) === JSON.stringify(want1), got1.join(" | "));

  const p2 = await relay.pullInbox(runId, "A-02", state("A-02", p1.inboxCursor), "coal-1", 2);
  check("second pull adds nothing new (cursors hold)", JSON.stringify(texts(p2.inbox)) === JSON.stringify(texts(p1.inbox)) && p2.inboxCursor === p1.inboxCursor);

  await relay.deliverMessage(runId, tokens["A-01"]!, { channel: "dm", to: "A-02", text: "second dm" }, `${runId}-4`);
  await relay.deliverMessage(runId, tokens["A-03"]!, { channel: "public", text: "A-03 here" }, `${runId}-5`);
  const p3 = await relay.pullInbox(runId, "A-02", state("A-02", p2.inboxCursor), "coal-1", 3);
  const fresh3 = p3.inbox.filter((m) => m.round === 3).map((m) => `${m.from}/${m.channel}:${m.text}`).sort();
  check("third pull returns only the 2 new messages", JSON.stringify(fresh3) === JSON.stringify(["A-01/dm:second dm", "A-03/public:A-03 here"]), fresh3.join(" | "));
  check("cursor tracks 3 sources", Object.keys(parseCursor(p3.inboxCursor).c).length === 3, Object.keys(parseCursor(p3.inboxCursor).c).length + " keys");

  const own = await relay.pullInbox(runId, "A-01", state("A-01", null), "coal-1", 1);
  check("sender does not see own messages", !own.inbox.some((m) => m.from === "A-01"), texts(own.inbox).join(" | "));

  const p4 = await relay.pullInbox(runId, "A-03", state("A-03", null), null, 1);
  check("non-coalition agent A-03 does not see the coalition message or A-02's dm", !p4.inbox.some((m) => m.channel === "coal-1" || m.channel === "dm"), texts(p4.inbox).join(" | "));

  console.log(`\n${failures === 0 ? "RELAY E2E OK" : `${failures} check(s) failed`}`);
  if (failures > 0) exit(1);
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
