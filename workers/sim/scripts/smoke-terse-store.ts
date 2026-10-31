// Smoke test for TerseAgentStore / DurableActorsClient against a local fake control plane (no network, no keys).
// No @types/node in this workspace: declare the slice of node:http we use and load it dynamically.
interface FakeReq { on(ev: string, cb: (chunk?: unknown) => void): void; method?: string; url?: string; headers: Record<string, string | undefined> }
interface FakeRes { writeHead(code: number, h: Record<string, string>): void; end(body: string): void }
interface FakeServer { listen(port: number, host: string, cb: () => void): void; address(): { port: number }; close(): void }
const httpModule = "node:http";
const { createServer } = (await import(httpModule)) as { createServer(h: (q: FakeReq, r: FakeRes) => void): FakeServer };

const assert = {
  equal(a: unknown, b: unknown, msg = "") { if (a !== b) throw new Error(`${msg} expected ${String(b)}, got ${String(a)}`); },
  match(a: string, re: RegExp) { if (!re.test(a)) throw new Error(`${a} !~ ${re}`); },
};
import type { AgentState, AgentTurnInput } from "@simulization/shared";
import { ActorInvocationError, DurableActorsClient, TerseAgentStore } from "../src/agents/terseStore";

interface Recorded { path: string; auth?: string; body: { requestId: string; method: string; args: unknown[] } }
const seen: Recorded[] = [];
let script: Array<{ status?: number; body: unknown }> = [];

const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => { raw += String(c); });
  req.on("end", () => {
    seen.push({ path: req.url ?? "", auth: req.headers.authorization, body: JSON.parse(raw) });
    const next = script.shift() ?? { body: { target: {}, outcome: { type: "completed", result: null } } };
    res.writeHead(next.status ?? 200, { "content-type": "application/json" });
    res.end(JSON.stringify(next.body));
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const completed = (result: unknown) => ({ body: { target: {}, outcome: { type: "completed", result } } });

try {
  const client = new DurableActorsClient({ baseUrl, projectId: "local", secret: "s3cret" });
  const store = new TerseAgentStore(client);
  const state: AgentState = { name: "A", company: "c", provider: "p", model: "m", memory: "", inboxCursor: null };

  // 1. completed + path + auth + body shape
  script = [completed(state)];
  const loaded = await store.load("run1", "A-04");
  assert.equal(loaded.name, "A");
  assert.equal(seen[0]!.path, "/v1/projects/local/actors/MerchantAgent/run1.A-04/invoke", "path");
  assert.equal(seen[0]!.auth, "Bearer s3cret", "auth");
  assert.equal(seen[0]!.body.method, "load");
  assert.match(seen[0]!.body.requestId, /^[0-9a-f-]{36}$/);

  // 2. no secret => no Authorization header
  seen.length = 0; script = [completed(null)];
  await new TerseAgentStore(new DurableActorsClient({ baseUrl, projectId: "local" })).save("r", "a", state);
  assert.equal(seen[0]!.auth, undefined, "no auth header");
  assert.equal(seen[0]!.body.method, "save");

  // 3. init + takeTurn args
  seen.length = 0; script = [completed(null), completed({ action: "pass" })];
  await store.init("r", "a", state);
  const input = { round: 1 } as unknown as AgentTurnInput;
  await store.takeTurn("r", "a", input);
  assert.equal(seen[0]!.body.method, "init");
  assert.equal(JSON.stringify(seen[0]!.body.args), JSON.stringify([state]));
  assert.equal(JSON.stringify(seen[1]!.body.args), JSON.stringify(["r", "a", input]));

  // 4. not_executed then completed => exactly one retry, same requestId
  seen.length = 0;
  script = [{ body: { target: {}, outcome: { type: "not_executed", reason: "host_unavailable" } } }, completed(7)];
  assert.equal(await client.invoke<number>("MerchantAgent", "x", "m", []), 7);
  assert.equal(seen.length, 2, "retry count");
  assert.equal(seen[0]!.body.requestId, seen[1]!.body.requestId, "same requestId");

  // 5. not_executed twice => error after exactly 2 attempts
  seen.length = 0;
  const ne = { body: { target: {}, outcome: { type: "not_executed", reason: "upstream_not_reached" } } };
  script = [ne, ne, completed(1)];
  await client.invoke("MerchantAgent", "x", "m", []).then(() => { throw new Error("should fail"); }, (e) => assert.equal((e as ActorInvocationError).code, "unavailable"));
  assert.equal(seen.length, 2, "two attempts max");

  // 6. failed => Error with code, never retried
  seen.length = 0;
  script = [{ body: { target: {}, outcome: { type: "failed", code: "actor_error", message: "boom" } } }, completed(1)];
  await client.invoke("MerchantAgent", "x", "m", []).then(() => { throw new Error("should fail"); }, (e) => {
    assert.equal((e as ActorInvocationError).code, "actor_error");
    assert.match((e as Error).message, /boom/);
  });
  assert.equal(seen.length, 1, "failed not replayed");

  // 7. 502 => outcome unknown, never retried
  seen.length = 0;
  script = [{ status: 502, body: { error: { code: "bad_gateway", message: "x" } } }, completed(1)];
  await client.invoke("MerchantAgent", "x", "m", []).then(() => { throw new Error("should fail"); }, (e) => assert.match((e as Error).message, /outcome unknown/));
  assert.equal(seen.length, 1, "502 not replayed");

  // 8. other HTTP error maps Error body code
  script = [{ status: 404, body: { error: { code: "not_found", message: "no actor" } } }];
  await client.invoke("MerchantAgent", "x", "m", []).then(() => { throw new Error("should fail"); }, (e) => assert.equal((e as ActorInvocationError).code, "not_found"));

  // 9. invalid actor id characters rejected client-side (no request sent)
  seen.length = 0;
  await client.invoke("MerchantAgent", "bad/id", "m", []).then(() => { throw new Error("should fail"); }, (e) => assert.match((e as Error).message, /invalid actor id/));
  assert.equal(seen.length, 0, "no request for invalid id");

  console.log("smoke-terse-store OK");
} finally {
  server.close();
}
