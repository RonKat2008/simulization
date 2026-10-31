# Track A integration handoff — B / C / D / E

Teammate code is synchronized from GitHub main. This document records integration evidence and remaining proposals; it does not claim unconfirmed schema decisions were agreed.

## Integration check after B's 669bbbd (2026-10-31)

C's ebbb29a is included. B's 669bbbd removes the obsolete NeonAgentStore and its package dependency; no B-owned code was changed by A during this check. E's defa8a8 fixes trade-step turn counting; the regenerated six-agent/six-round metadata now reports 144 turns instead of 162. Repo-wide typechecking and the engine export pass after both integrations.

The product bootstrap, not just the standalone probe, passes a complete six-agent stub round (47 events) through HTTP and WebSocket. HTTP smoke now checks EventSchema, contiguous sequence numbers and run-scoped IDs, exact cursor catch-up, repeated read stability, rejection of invalid cursors, missing-run 404, and idempotent stop. The actual MerchantAgent adapter with MODEL_MODE=stub passes cancellation, expired deadlines, duplicate turns across restart, and separate trade-step identity. Unattended product restart passes with 73 ordered events and no status request waking the actor. The 266-event six-round export passes D's store ordering/deduplication and E's metrics input check.

`pnpm dev` now explicitly loads root `.env` before starting Next.js. Actor launchers already load that same file, with shell variables taking precedence. There is no populated root/package environment file or shell gateway/Relay/database credential in this checkout at verification time. No model, Relay, or database network success is claimed.

Remaining integration ownership:
- **A:** the working HTTP service is still `pnpm dev:sim` on :8787 (`/runs`, `/runs/:id`, `/runs/:id/events?after=N`, `/runs/:id/ws`, `/runs/:id/stop`, `/batch`). The agreed Next.js `/api/runs*` and `/api/batch` routes and consolidated `actors/World` entrypoint are not implemented. Do not assume adding `/api` to these paths works. HTTP run creation explicitly uses stubs; live setup currently requires a new manually stepped WorldActor and enableLive().
- **D:** `/run/[id]` remains a placeholder on this commit. Mount VillageCanvas and connect its store to the agreed API after coordination with A. D also owns UI launch controls and the report presentation. A will verify the browser after D's commit arrives; loading C's mock harness does not prove live-page integration.
- **A + configuration owner:** Neon projection is not implemented or verified. E's analysis reads runs, agents and events from Neon and requires a completed run row. Passing computeRunMetrics on the stub artifact does not prove the analysis/report pipeline. Supply root `.env` privately for gateway, Relay and Neon verification; never commit it.
- **B:** keep ownership of any further MerchantAgent/gateway/Relay fixes. Send pushed commit hashes; A will integrate and rerun the adapter checks.

These are unfinished integration tasks, not evidence that the completed deterministic engine has failed. In particular, missing Next.js routes are A's work and must not be attributed to D's pending canvas wiring.

## C/D: ordered event consumption

Existing frozen Event schema is unchanged. HTTP GET `/runs/:id/events?after=N` returns increasing seq; WebSocket `/runs/:id/ws` sends Event objects and replays on reconnect. Deduplicate by runId+seq (or id), sort by seq, recover gaps via HTTP. Reset the current event store on run switch: its Map is keyed only by seq. Its `append`/`load` signatures already accept this data.

Phase order: negotiate, trade/offers, trade/responses, act, reveal. Event.phase remains `trade` for both trade steps. Status exposes tradeStep; completion system events distinguish the steps in text. Offer IDs equal trade_offer event IDs. trade_accept/decline text contains that offer ID. Coalition event channel carries coalition ID. Agent IDs are opaque merchant-NN, not company letters. Observer events retain company, private plan, and ground truth; never use them as agent input.

Decision needed: the frozen event contract has no structured initial roster/balance/inventory state or deltas. Do not infer missing true state from prose. Agree a structured snapshot contract with Track A before implementing authoritative balance/inventory replay. Current smoke-tested event stream demonstrates event rendering, not complete state reconstruction.

## E: metrics inputs

Use committed ordered Event[] only, and AgentRef[] from the same run's actual roster. Observer company fields are present in both conditions. Six-agent smoke uses two per company: chance is 1/5, not the existing 18-agent constant 5/17. Compute chance from actual group counts. Seeded runs use 18 agents only when explicitly requested; do not mix sample sizes silently.

Ground-truth flags remain lie/theft/broken_pact/rule_break/eval_aware. Pact violations emit both a flagged action and pact_break; deduplicate at the pact level for pact-keeping metrics. A turn may contain two negotiate/trade actions; eval-awareness denominator must count turns, not events, and trade offers/responses are separate turns. Confirm an unambiguous turn key with A before metrics are implemented: the frozen Event schema lacks tradeStep/requestId fields. Do not use world system events as agent turns.

E’s implemented metrics are exercised by the export check below; Track A has not changed their calculations. Turn-denominator semantics still need cross-track review.

## Database decision

Neon is confirmed as the permanent database/projection role. Terse SQLite is actor checkpoint storage. Track A has not implemented external projection; no Supabase path is introduced.

## Current main synchronized

origin/main 173303c includes C’s village and E’s metrics/Mastra implementation. Earlier TODO observations refer to the stale scaffold. Neon has been confirmed by the owner. Re-evaluate compatibility against these implementations before treating integration as accepted.

## Delivered artifact and checked consumers

`workers/sim/fixtures/track-a-stub.events.json` is a real engine-generated six-round Event[] (seed 42, six agents, 266 events). `track-a-stub.metadata.json` includes explicit stub provenance, actual AgentRef roster, scores and E's computeRunMetrics output. Regenerate with `pnpm --filter sim export:stub`.

The export check feeds reversed events and duplicates through D's actual zustand append implementation and verifies the final stream exactly equals engine order. E's real computeRunMetrics accepts the stream/roster and computes population-based chance. This verifies input compatibility, not metric correctness or visual rendering. Structured authoritative state snapshots and phase/turn denominator semantics still need agreement; no second event schema was added.
