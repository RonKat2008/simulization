# Track A integration handoff — B / C / D / E

Teammate code is synchronized from GitHub main. This document records integration evidence and remaining proposals; it does not claim unconfirmed schema decisions were agreed.

## Integrated product contract (2026-10-31)

Root `pnpm actors:dev` launches the consolidated Terse runtime; `pnpm dev` launches Next.js with the same root `.env`. `NEXT_PUBLIC_SIM_URL=/api` adapts D's existing polling client without changing its files. B's 669bbbd, bfd873e and 9873034; C's ebbb29a; D's f98f39f; and E's defa8a8/189e909 are integrated.

A owns these Next.js routes (D retains page/store/canvas wiring):
- POST `/api/runs` with `{condition,seed,wealth_visibility?}` returns `{runId}`. Optional `Idempotency-Key` is the run ID (at most 110 safe actor-ID characters); identical retries reuse the run, conflicting configuration returns 409. Seeds must fit signed 32-bit Neon integers.
- GET `/api/runs` lists runs with normalized `id,condition,seed,status,round,phase,mode,finalScores`.
- GET `/api/runs/:id` returns the committed status and `agents:[{id,name,company}]`, `mode`, `projection`, `seq`, and `reportStatus`. Live reads use Neon so they cannot queue behind actor model calls. The initializing state may have no agents until its first projection.
- GET `/api/runs/:id/events?after=N` returns frozen Event[] with seq>N in ascending order. Live reads use Neon. Explicit credential-free stub mode may read the actor checkpoint.
- POST `/api/runs/:id/socket` returns `{websocketUrl,connectByMs,homeRegion}` from Terse. Treat the URL as a short-lived connection credential, not a control-plane key. It replays the log; deduplicate by run ID/seq and recover gaps with events.
- POST `/api/runs/:id/stop` stops advancement; stopped runs project as failed.
- POST `/api/batch` with `{n}` starts alternating conditions with seeds 1..n.
- GET `/api/runs/:id/report` returns `{id,condition,status,config,metrics,review}` from E's existing Neon rows. Null metrics/review means analysis is not available yet; do not substitute sample claims as a real review.

The frozen Event schema is unchanged. Mode values distinguish `initializing-live`, `live-model-relay`, and `deterministic-stub`. No silent live-to-stub fallback exists. D still owns the launch control, roster-name usage and persisted report presentation. D's bcdf0da now reads persisted Neon reviews, but /report currently falls back to mock data unless both LABELED and BLIND have completed runs. A single live run can have a real persisted report at its API while /report still shows a labeled mock; D owns relaxing that display requirement if single-run acceptance is desired.

Verified: actual Next.js + consolidated Terse completed a six-round six-agent stub game (266 ordered events), duplicate create, socket grants, unattended runtime restart, and E's 144-turn metrics input. Real Neon SQL passed exact event JSON round-trip through E's reader, duplicate/stale projection retries and final scores; its disposable test row was removed. Each of the three configured model providers passed a real gateway turn. Actual Relay public/DM/coalition and recipient inbox checks passed.

Live run `track-a-live-20261031-1` completed all six rounds with 18 agents, 547 schema-valid ordered events, 59 message events and 432 metric-counted turns. Real model decisions and actual in-run Relay delivery were verified (committed text matched the channel; merchant inbox memory contained received messages). VillageCanvas and the feed rendered the live events in the browser. The same run resumed after a runtime restart while viewers read Neon.

E's workflow persisted metrics and a real Opus review with 30 claims; all cited event IDs exist and zero claims were dropped. GET `/api/runs/track-a-live-20261031-1/report` exposes that result. This was an integration run, including a runtime restart/update, not a controlled LABELED-vs-BLIND experiment.

Remaining acceptance limits are D-owned: the run was launched through the Next API, not a UI control (`/launch` still says “Controls coming soon”). Browser `/report` still shows its explicitly labeled mock because only LABELED has a completed run; its current code requires both conditions. D must add launch controls and allow single-condition/single-run real-report presentation, or the team must deliberately run a BLIND comparison. A has not edited those components.

Recovery: RunDirectory journals creation before initialization. Startup re-arms registered runs without status requests and isolates failures per run. Projection writes a single transaction; done is published with the final event log. ReportJob invokes E separately from World so long reviews do not block viewers. Relay setup reuses tokens saved after each registration. Lost registration responses still need B's token-recovery decision; duplicate-name errors stop setup with an explicit diagnostic. E's stable report ID makes writes idempotent, but response loss may repeat model review work.

## Wealth visibility contract for E/B/D

`wealth_visibility` is `private | public`, defaults to `private`, and is immutable per run. It is accepted by POST /api/runs, stored in the Terse checkpoint/directory and `runs.config.wealth_visibility`, and returned in status/list metadata. Historical missing values mean private. `WealthVisibilitySchema` is exported from shared schemas; `AgentTurnInputSchema.otherAgents[].coins` is optional. Engine input construction emits it only for public mode, using each peer's current coin balance at that phase's observation snapshot. Self balances/inventory remain unchanged.

Other merchants' true inventory quality/value is never added. Observer event/UI visibility remains separate, and EventSchema, starting coins, rewards, penalties, resolution order and scores are unchanged. E should keep wealth visibility as a grouping dimension in future experiment comparisons instead of pooling policies silently. The existing completed live verification run used private visibility. D owns any UI selector; omission already selects private.

## C/D: ordered event consumption

Existing frozen Event schema is unchanged. HTTP GET `/api/runs/:id/events?after=N` returns increasing seq; Terse WebSocket grant from POST `/api/runs/:id/socket` sends Event objects and replays on reconnect. Deduplicate by runId+seq (or id), sort by seq, recover gaps via HTTP. Reset the current event store on run switch: its Map is keyed only by seq. Its `append`/`load` signatures already accept this data.

Phase order: negotiate, trade/offers, trade/responses, act, reveal. Event.phase remains `trade` for both trade steps. Status exposes tradeStep; completion system events distinguish the steps in text. Offer IDs equal trade_offer event IDs. trade_accept/decline text contains that offer ID. Coalition event channel carries coalition ID. Agent IDs are opaque merchant-NN, not company letters. Observer events retain company, private plan, and ground truth; never use them as agent input.

Decision needed: the frozen event contract has no structured initial roster/balance/inventory state or deltas. Do not infer missing true state from prose. Agree a structured snapshot contract with Track A before implementing authoritative balance/inventory replay. Current smoke-tested event stream demonstrates event rendering, not complete state reconstruction.

## E: metrics inputs

Use committed ordered Event[] only, and AgentRef[] from the same run's actual roster. Observer company fields are present in both conditions. Six-agent smoke uses two per company: chance is 1/5, not the existing 18-agent constant 5/17. Compute chance from actual group counts. Seeded runs use 18 agents only when explicitly requested; do not mix sample sizes silently.

Ground-truth flags remain lie/theft/broken_pact/rule_break/eval_aware. Pact violations emit both a flagged action and pact_break; deduplicate at the pact level for pact-keeping metrics. A turn may contain two negotiate/trade actions; eval-awareness denominator must count turns, not events, and trade offers/responses are separate turns. Confirm an unambiguous turn key with A before metrics are implemented: the frozen Event schema lacks tradeStep/requestId fields. Do not use world system events as agent turns.

E’s implemented metrics are exercised by the export check below; Track A has not changed their calculations. Turn-denominator semantics still need cross-track review.

## Database decision

Neon is confirmed as the permanent database/projection role. Terse SQLite is actor checkpoint storage. Track A projects committed runs/agents/events into the existing Neon schema; no Supabase path is introduced.

## Current main synchronized

origin/main 173303c includes C’s village and E’s metrics/Mastra implementation. Earlier TODO observations refer to the stale scaffold. Neon has been confirmed by the owner. Re-evaluate compatibility against these implementations before treating integration as accepted.

## Delivered artifact and checked consumers

`workers/sim/fixtures/track-a-stub.events.json` is a real engine-generated six-round Event[] (seed 42, six agents, 266 events). `track-a-stub.metadata.json` includes explicit stub provenance, actual AgentRef roster, scores and E's computeRunMetrics output. Regenerate with `pnpm --filter sim export:stub`.

The export check feeds reversed events and duplicates through D's actual zustand append implementation and verifies the final stream exactly equals engine order. E's real computeRunMetrics accepts the stream/roster and computes population-based chance. This verifies input compatibility, not metric correctness or visual rendering. Structured authoritative state snapshots and phase/turn denominator semantics still need agreement; no second event schema was added.
