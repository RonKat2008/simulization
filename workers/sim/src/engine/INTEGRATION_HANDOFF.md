# Track A integration handoff — B / C / D / E

Teammate code is synchronized from GitHub main. This document records integration evidence and remaining proposals; it does not claim unconfirmed schema decisions were agreed.

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
