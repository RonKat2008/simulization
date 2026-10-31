# Parallel UI handoff

Branch: `ui/agent-inspector`, based on teammate main `6047791` (including `c5ebd29` design, lantern fund counter, tint correction and updated round recaps).
The previous full redesign is preserved at `ba61f1c12da4b5069534337cc85cc93d9c6738b8` on `integration/astra-finish`; PR #2 is closed. This branch does not replace the teammate homepage, fonts, global CSS, navigation, launch or report design. Metrics v2 remains separate on `integration/metric-v2`.

## File scope and functional corrections

- `components/run/agent-card.tsx`, new `agent-history.ts`: one full-width selected-agent panel above village, recorded provider/model, accepted pacts vs coalition, chronological actions and observer-only self-reported plans, verified coin history, separate score and behavior counts.
- `store/eventStore.ts`, `game/scene.ts`, `game/VillageCanvas.tsx`: share the actual applied event sequence, reset on seek/new run, pause/resume, responsive canvas. Correct visual balances for capped theft/fines and explicit world payouts.
- `components/run/run-viewer.tsx`, `event-feed.tsx`, `feed-filters.tsx`, `roster.tsx`, `round-timeline.tsx`, `top-bar.tsx`, `story/use-playback.ts`, `story/story-timeline.tsx`: current phase, activity, filters, counts, timeline markers and selected details use the same prefix. Never expose final scores/results before replay completes. Explicit Data/Research views inspect the full loaded log; returning to Game starts a new playback prefix. Remove timer-inferred completion; use applied events. Previously selected timeline details must disappear when seeking before that event.
- `run-helpers.ts`, `use-run-source.ts`: retain actual recorded provider/model metadata, never infer from current defaults. The optional server roster-column addition is preserved separately for backend integration; older API responses truthfully show model metadata unavailable.
- `public/runs/featured.json`: enrich roster metadata from the preserved verified snapshot; event array remains identical.
- `workers/sim/scripts/agent-history-contract.ts`: verify balances against authoritative engine states and historical final inventory, prefix cutoff, missing/tampered events, final scores, and member-level pact responsibility. No engine or metric-contract changes.

## Coordination decisions

Teammate owns homepage, navigation, global typography/color tokens, launch/report layouts. This panel uses their existing tokens and components. Story timeline/round recap are preserved. Hiding future highlights until playback reaches them is an intentional correctness change; any spoiler-enabled overview should be an explicit separately labeled mode, not leak into the current replay.

Exact historical model names can be unavailable in older exported recordings; show “Not recorded in this run.” Coin history fails closed when the event prefix is incomplete/unrecognized. Reports remain a separate full-run destination.

## Wording suggestions for teammate-owned surfaces

- Homepage: “Watch AI agents trade, form alliances, and compete.” / “Inspect what they say, what they do, and how the outcomes change.” Keep real recording clearly labeled.
- Shared event-row plans: replace “Show self-reported plan” with “Show agent’s stated plan”; expanded heading “Agent’s stated plan · observer only.” This is model-generated text, not internal thoughts.
- Reports: “What happened in this run,” “Recorded actions,” and “What these results can tell us.” Prefer counts and sample sizes to character judgments.
- Keep metric v2 wording/data migration separate. Do not silently swap versioned definitions into current reports.

## Motion contract

Installed libraries: Motion 14.9.0, Anime.js 4.5.0, Phaser 3.90.x. Use existing Motion for inspector entrance/selection and exact-value wealth/chart emphasis; Phaser already owns village interaction cues. No new dependency. No interpolated balances, stale outgoing inspector content, or speculative trade-success effects. Reduced motion skips inspector transforms/emphasis and the village keeps its static labels. Repeated stream ingestion cannot advance the playback cursor or duplicate events.

## Parallel implementation ownership (final integration)

Root: inspector/history, shared applied-cursor contract, village/controls, layout, guide and final verification.
OpenAI leaderboard finisher: `roster.tsx`, `leaderboard-contract.ts` (completed).
OpenAI activity finisher: `event-feed.tsx`, `compact-activity.ts`, `activity-contract.ts` (completed).
Claude Sonnet 5.5: independent read-only rendered review; no file ownership.
OpenAI hosting investigator: read-only local 503 and hosted readiness; no UI changes.

Shared contract: `events` is the ordered deduplicated log; `playbackSeq` is the last applied event, `0` means none, `null` means an explicitly labeled full loaded overview. Filter before grouping, counting, ranking or reconstructing balances. No inferred future score or history.

## Final playback hierarchy

Village first; compact phase/playback controls immediately below. Right sidebar has Leaderboard and Activity tabs; narrower layouts stack the sidebar. A selected agent opens the single inspector above the village. Default playback has only factual prefix counts and a run-specific full-report link. Full Data/Research views remain explicit alternate URLs, not default results panels. Existing story highlights follow the prefix, with recaps collapsed and instructions behind Replay help.

## Separate launch-owner handoff

The reported 503 occurred on a teammate’s localhost, not the public deployment. `pnpm dev` starts Next only; `pnpm actors:dev` separately starts consolidated Terse. Both load the root `.env`; direct `pnpm --filter web dev` bypasses explicit root loading. Do not automatically restart actors to diagnose: bootstrap resumes registered runs. Without that machine’s logs/checkpoints, creation after a failed acknowledgement cannot be excluded.

Before enabling Start, expose a non-mutating readiness result and disable live launch when configuration or actor connectivity is unavailable. Show “Live simulations are unavailable” and a link to the verified recorded replay. Keep the attempted idempotency key for reconciliation; do not automatically create a new paid attempt after a 503. This change belongs to the launch/API owners and is not included in the viewer patch.

Verification and review dispositions: [QA evidence](evidence/agent-inspector/QA.md). Final source includes the independent review fixes; reviewer did not edit implementation files.
