# Agents layer (Person B) — integration API for the WorldActor (Person A)

Import everything from `src/agents` (barrel).

## Per run
1. Write the run row + 18 `agents` rows (name, company, provider, model from `COMPANIES`).
2. `const relay = createRunRelay(env)` — `null` if `AGENTRELAY_API_KEY` is unset (runs still work).
3. `const store = createAgentStore(env)` (`AGENT_STORE=neon` default, `do` for AgentActor, `terse` for Terse Durable Actors). For DO / Terse call `store.init(runId, id, initialState)` once per agent FIRST.
4. `const tokens = await setupRunRelay(relay, store, runId, agentIds)` — registers agents, creates + joins the public channel, then persists each token into its AgentState (`attachRelayTokens`: load → `{...state, relayToken}` → save, 6 at a time). Never throws: relay failure logs and returns `{}`. Keep `tokens` in WorldActor storage too.
   - Neon: `load` builds the initial state from the agents row; the token is saved for you.
   - DO: call `(store as DoAgentStore).init(runId, id, initialState)` once per agent first.
   - Terse: same as DO. Call `(store as TerseAgentStore).init(runId, id, initialState)` once per agent before any `load`/`takeTurn`. Needs `DURABLE_ACTORS_URL` (default `http://127.0.0.1:7100`), `DURABLE_ACTORS_PROJECT_ID` (default `local`), optional `DURABLE_ACTORS_SECRET`. Actor `MerchantAgent`, id `${runId}.${agentId}` (':' mapped to '.', since actor ids allow only `[A-Za-z0-9._-]{1,128}`). Retries once only on `not_executed`; `failed` / HTTP 502 / network errors throw and are never replayed. Smoke: `pnpm --filter sim smoke:terse`.

## Per phase
```ts
const results = await runAgentTurns(store, runId, agents.map(a => ({ agentId: a.id, provider: a.provider, input: buildInput(a) })));
// results[i].output is always a valid AgentTurnOutput (failures/timeouts → pass). Never throws.
```
- Cap 6 concurrent (3 per provider; the provider slot is taken before the global one), 12s timeout, 1 retry, then pass. A timed-out turn is aborted (`AbortSignal` to `store.takeTurn`; DO/Terse get an epoch-ms deadline) and its state is NOT saved. Remote actors also guard saves with `lastTurnKey` (round:phase).
- Out-of-range actions (trade_offer claimedQuality not int 1..10 / price not int >= 0, dm without `to`, empty message text) are dropped by `parseTurn`. Action *types* are already filtered to `input.legalActions`; you still validate semantics (owns good, target exists, offer addressed to them).
- Always fill `input.inbox` from the event log (last 10). If the relay works, B replaces it with the AgentRelay inbox; if the relay fails, your inbox is used.

## Messages and coalitions (after you validate + log the event)
- `relay.deliverMessage(runId, senderToken, { channel, to, text }, eventId)` — `eventId` is the idempotency key.
- `relay.createCoalition(runId, coalitionId, token)`, `joinCoalition`, `leaveCoalition`.
- Tokens: keep the `tokens` map in WorldActor storage (also persisted in each AgentState.relayToken by `setupRunRelay`).
- Inbox: relay messages from all sources are merged by message id (time order); `round` is the round the agent first received the message. Relay requests time out at 3s.
- Relay calls can fail: wrap them, log, keep the run going — the event log is the source of truth.

## Scripts (`pnpm --filter sim <name>`; keys in repo-root `.env`)
`models` · `spike:gateway` · `spike:relay` · `validity` · `exec tsx scripts/smoke-relay-names.ts`

## Running without API keys (stub model)
- `createModelClient(env)` returns a `StubModelClient` when `AI_GATEWAY_API_KEY` is unset or `MODEL_MODE=stub` (one-line warning logged). The Neon/DO/Terse stores then run the real pipeline (prompt, parse, repair, pass) against a seeded merchant bot.
- `StubModelClient({ seed, invalidRate, latencyMs })` (from `@simulization/agents`): deterministic per agent/round/phase; `invalidRate` returns garbage that fraction of the time to exercise repair/pass; the bot sometimes lies (claimedQuality off by >= 2), steals, forms coalitions, proposes pacts, using only legal actions and real ids.
- `MemoryAgentStore` (Node, no DB): `await store.init(runId, agentId, state)` per agent, then `runAgentTurns(store, runId, turns)` as usual. Optional `onTurn(runId, meta)` gets attempts/passReason/tokens.
- Smoke: `pnpm --filter @simulization/agents smoke:stub` (needs tsx, which lives in `sim`, hence the `--filter sim exec`).
