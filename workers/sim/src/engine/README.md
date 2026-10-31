# Track A engine and integration

Pure rules: `rules.ts`; true state/types: `types.ts`; initialization and permitted observations: `world.ts`; bounded turn collection and phase orchestration: `runner.ts`. Product runtime: `../world/WorldActor.ts` on Terse Durable Actors 0.14.6. Entry `../actors.ts`; Bun bootstrap `../../scripts/dev.ts`; HTTP/WebSocket surface `../index.ts`.

## Resolution decisions

- Six stubs by default; six rounds. Each round: negotiate → trade/offers → trade/responses → act → reveal. Reveal never calls an agent.
- Collect from immutable phase snapshots; resolve sorted opaque merchant IDs, then submitted action order. RNG depends on seed/round/step/agent, never run ID, wall clock, completion order, or provider latency.
- Item IDs are stable. Offer IDs are the corresponding committed trade_offer event IDs. Responses are allowed only at the responses step by the addressed buyer. Current ownership and balance are rechecked; selling invalidates all competing offers for the item. Offers expire after responses.
- An invalid turn becomes a pass atomically: no partial action, inventory, inbox, membership, or memory mutation. Event logging still advances. At most one act action.
- One coalition per merchant; join existing coalitions; payout at reveal for >=2 current members. Bilateral pacts require a proposal. Violations flag and emit pact_break but retain the promise, preventing membership changes from identifying an uncaught thief.
- Theft transfers min(4, victim coins); caught fines min(6, thief coins). No negative balances. A caught merchant skips the next act only. Victims receive an anonymous notice unless the thief is caught. Coalition/work/lantern rewards and fines are explicit creation/destruction; contributions move coins into the fund.
- Only own inventory truth/memory, addressed offers, scoped messages, and permitted public identities enter agent inputs. BLIND omits other company keys and uses opaque IDs. Observer events/private plans never become agent inboxes.
- Per-attempt timeout 12 seconds, one retry, then pass. The optional AgentStore execution argument carries a stable requestId and AbortSignal. Input and ID are identical on retry and restart. Late results cannot change committed state. Track B must deduplicate external effects by requestId; ignoring cancellation can leave external requests in flight.
- WorldActor phase-key commits provide action idempotency; events start at 1 with IDs `${runId}-${seq}`. State/events/key and next alarm commit in a Terse SQLite transaction. Broadcast occurs afterward. Poll cursor recovers missing delivery; consumers sort/deduplicate by seq/id.

## Review triage

Confirmed and fixed: run-ID-dependent randomness; unbounded adapter waits; stale table-initialization cache after transaction rollback; stop mutating an uninitialized actor. The persistence adapter deliberately repeats CREATE TABLE IF NOT EXISTS, so retry works even when a previous creation rolled back.

Unfinished integration, not claimed as working: Track B model/Relay implementation, Neon projection, hosted deployment. Runtime shell migration is complete; see `../agents/TRACK_B_HANDOFF.md`. Frozen event schema is unchanged. Structured initial/state snapshots for richer frontend reconstruction still need team agreement.

## Verification evidence (local runtime, deterministic stubs)

Run with Bun >=1.4.2 on PATH. This session used Bun 1.4.4 from `/tmp/simulization-bun/node_modules/.bin`.

| Requested check | Status | Evidence |
| --- | --- | --- |
| Actual product startup through Terse | PASS | `pnpm --filter sim smoke:http`: launches the same `scripts/dev.ts` as `pnpm dev:sim`, actual Terse runtime and Bun HTTP API; create/status/events/stop and schema-valid WebSocket events |
| One complete stub round | PASS | Product WorldActor + HTTP bootstrap: 47 ordered events, all four phases, six merchants |
| Stalled-agent round finishes | PASS | `smoke:world`: merchant-01 never resolves at act; two 12-second attempts; round finished in 24,226 ms, merchant passed |
| Failed transaction/retry | PASS | Product initialize with invalid merchant count rolls back after table creation; same actor retry initializes at seq 0. Additional real-runtime probe reuses the same storage adapter after rollback and verifies checkpoint-commit rollback |
| Restart recovery | PASS | Product process stop/start preserves status/events; six rounds finish with 266 ordered events. Product bootstrap re-arms automatic runs from its registration index; no client request is required |

Additional: concurrent duplicate phase requests apply once; replay cursors; final scores; stop blocks further advancement; same seed independent of run ID; stable timeout retry identity; late result ignored. `pnpm typecheck` passes for all workspaces. `pnpm --filter sim smoke` and `git diff --check` pass. Probe separately ran 18 stubs through six rounds/30 phases/705 events with restart, matching the pure reference; it is supplemental evidence, not product proof.


All output is labeled `deterministic-stub` (or `stalled-stub-test` for the fault-injection run). There has been no live-agent run. No Cloudflare fallback exists.



Recovery scope: the product bootstrap restores automatic runs from its durable registration index, with no status request. `smoke:unattended` verifies this and verifies stopped runs remain stopped. The raw SDK-only probe still reproduces lost alarms. Hosted recovery and hard-kill/power-loss durability are unverified. See `workers/sim/SETUP.md`.
