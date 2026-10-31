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

## PR #3 main reconciliation

Merged shared main 637aa0b. Preserved teammate’s plainer header, Run details, seed, label-mode/monitoring badges and searchable full event log. Main’s GameSide/Leaderboard/HappeningFeed entrypoints now delegate to the verified cursor-based sidebar; the second narration-matching playhead is replaced by a compatibility view of the shared cursor. Detailed search remains an explicitly labeled full-run view; returning to replay clears the full-run cursor before paint. Relationship navigation (accepted partners, coalition partners and trade partners) is retained in the selected panel. The full-width inspector remains above the village to honor the explicit user layout requirement; no duplicate drawer is rendered.

featured.json retains the same run id and 596 events from main, including main’s deliberate eval-awareness reclassification from commit 641985b. Verified model/provider roster metadata is restored by matching id/name/company. No actions, money, event IDs, ordering or false-claim flags were changed by this merge. The prior evidence assertion that events matched the old base is superseded by comparison to shared main for this resolution.

Checks: repo-wide typecheck, production build, agent-history (including coalition membership), leaderboard, activity, report UI, swapped-label and monitoring regression scripts. No paid calls. Browser recheck uses existing featured recording only.

## Starting luck leaderboard

The leaderboard now shows Coins, Starting luck (initial goods total true value), and
Violations (count only, as requested). Sort by coins descending, initial value
ascending, or violation count descending. A false offer or theft counts once even
when it also breaks a pact; companion pact-break/caught events are not extra acts.
Counts follow the applied replay cursor; initial values are immutable observer data.
No probability, severity weight, morality score, or division by starting value is implied.

The read-only `/api/runs/:id/starting-values` endpoint validates persisted initialization
using the same helper as reports. It returns only per-agent totals, never final holdings,
private plans, or full inventory. Missing evidence remains unavailable. It never wakes
an actor or invokes a model. Agent observations and game rules are unchanged.

Verification: luck-leaderboard-contract (12 recordings, gaps, duplicates, pact markers,
victim responsibility, cursor, sort and initial-evidence validation); existing leaderboard
and Starting Luck contracts; full workspace typecheck and production build. Real read-only
Neon requests returned 18 verified totals for public run 1e5c714e-e4bc-4d1d-aeb1-ff1eea922f94
and no initial values for featured run 78deca44-65c6-47d7-8992-a959fcfededa. Dia desktop and
390px screenshots inspected: headings/rows fit, keyboard sort works, agent selection opens
the existing inspector, forward/backward replay updates counts and retains initial values.
No paid calls or new simulation runs.
