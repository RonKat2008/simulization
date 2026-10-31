# Agents layer (Person B) — integration API for the WorldActor (Person A)

Import everything from `src/agents` (barrel).

## Per run
1. Write the run row + 18 `agents` rows (name, company, provider, model from `COMPANIES`).
2. `const relay = createRunRelay(env)` — `null` if `AGENTRELAY_API_KEY` is unset (runs still work).
3. `const tokens = await relay?.setupRun(runId, agentIds)` — registers agents, creates + joins the public channel.
4. `const store = createAgentStore(env)` (`AGENT_STORE=neon` default, `do` for AgentActor, `terse` for Terse Durable Actors).
   - Neon: `load` builds the initial state from the agents row; then `store.save(runId, id, { ...state, relayToken: tokens[id] })`.
   - DO: call `(store as DoAgentStore).init(runId, id, initialState)` once per agent first.
   - Terse: same as DO. Call `(store as TerseAgentStore).init(runId, id, initialState)` once per agent before any `load`/`takeTurn`. Needs `DURABLE_ACTORS_URL` (default `http://127.0.0.1:7100`), `DURABLE_ACTORS_PROJECT_ID` (default `local`), optional `DURABLE_ACTORS_SECRET`. Actor `MerchantAgent`, id `${runId}.${agentId}` (':' mapped to '.', since actor ids allow only `[A-Za-z0-9._-]{1,128}`). Retries once only on `not_executed`; `failed` / HTTP 502 / network errors throw and are never replayed. Smoke: `pnpm --filter sim smoke:terse`.

## Per phase
```ts
const results = await runAgentTurns(store, runId, agents.map(a => ({ agentId: a.id, provider: a.provider, input: buildInput(a) })));
// results[i].output is always a valid AgentTurnOutput (failures/timeouts → pass). Never throws.
```
- Cap 6 concurrent (3 per provider), 12s timeout, 1 retry, then pass. Action *types* are already filtered to `input.legalActions`; you still validate semantics (owns good, target exists, offer addressed to them).
- Always fill `input.inbox` from the event log (last 10). If the relay works, B replaces it with the AgentRelay inbox; if the relay fails, your inbox is used.

## Messages and coalitions (after you validate + log the event)
- `relay.deliverMessage(runId, senderToken, { channel, to, text }, eventId)` — `eventId` is the idempotency key.
- `relay.createCoalition(runId, coalitionId, token)`, `joinCoalition`, `leaveCoalition`.
- Tokens: keep the `tokens` map in WorldActor storage (also persisted in each AgentState.relayToken).
- Relay calls can fail: wrap them, log, keep the run going — the event log is the source of truth.

## Scripts (`pnpm --filter sim <name>`; keys in repo-root `.env`)
`models` · `spike:gateway` · `spike:relay` · `validity` · `exec tsx scripts/smoke-relay-names.ts`
