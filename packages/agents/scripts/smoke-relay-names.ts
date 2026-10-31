// node:assert has no types in this workspace (no @types/node); tiny local equivalent.
const assert = {
  equal(a: unknown, b: unknown) { if (a !== b) throw new Error(`expected ${String(b)}, got ${String(a)}`); },
  deepEqual(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`deepEqual: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); },
  match(a: string, re: RegExp) { if (!re.test(a)) throw new Error(`${a} !~ ${re}`); },
};
import { agentIdFromRelayName, channelName, parseCursor, relayAgentName, serializeCursor } from "@simulization/agents";

const run = "AB12-xyz_Run";
assert.match(relayAgentName("ab12", "A-04"), /^run-ab12-[a-z0-9]+-a-04$/);
assert.match(channelName("ab12", "public"), /^run-ab12-[a-z0-9]+-public$/);
assert.match(channelName("ab12", "coalition-1"), /-coalition-1$/);
assert.match(relayAgentName(run, "A_04"), /^run-[a-z0-9-]+$/);
// Runs sharing a long prefix must not collide.
assert.equal(channelName("run-2026-10-31-0001", "public") === channelName("run-2026-10-31-0002", "public"), false);
assert.equal(agentIdFromRelayName("ab12", relayAgentName("ab12", "A-04")), "A-04");
assert.equal(agentIdFromRelayName("ab12", relayAgentName("zzzz", "A-04")), null);
assert.equal(agentIdFromRelayName("ab12", "other"), null);

assert.deepEqual(parseCursor(null), { c: {}, recent: [] });
assert.deepEqual(parseCursor("garbage{"), { c: {}, recent: [] });
assert.deepEqual(parseCursor("42"), { c: {}, recent: [] });
const recent = Array.from({ length: 15 }, (_, i) => ({ from: "a", channel: "public", text: String(i), round: 1 }));
const round = parseCursor(serializeCursor({ c: { k: "9" }, recent }));
assert.equal(round.recent.length, 10);
assert.equal(round.recent[9]!.text, "14");
assert.deepEqual(round.c, { k: "9" });
console.log("smoke-relay-names OK");
