# Recorded viewer QA — 2026-10-31

URL: http://localhost:3100/run/featured. Branch ui/agent-inspector, based on teammate 6047791. Existing live-model recording 78deca44-65c6-47d7-8992-a959fcfededa, 596 events. No model/Relay calls or new simulations.

## Contract and direction

A readable experiment viewer centered on the existing pixel village. Preserve teammate palette, proportional interface type, provider colors and navigation. Primary action: watch/seek a recording, then select an agent or inspect evidence. Hierarchy: village → controls → sidebar Leaderboard/Activity; conditional inspector above village; full analysis through report link. User screenshot supplies the qualitative reference, not a pixel-matched baseline.

## Verified

- Production build and web TypeScript PASS.
- agent-history-contract: 90 deterministic engine phases, recorded final balances, missing/gapped/tampered history, final-score cutoff, reconnect deduplication and outcome narration PASS.
- leaderboard-contract: 18 recorded agents, six cursor cutoffs, ties, missing balances, future claim/theft boundaries, score-independent ranking and selection PASS.
- activity-contract: all 597 cursor positions; group boundaries, flags, missing events, capped theft amounts, contribution/payout amounts PASS.
- Rendered 1440×900, 768×1024 and 390×844: no document horizontal overflow. Screenshots desktop.png, tablet.png, mobile.png inspected. Mobile screenshot is selected Ivy at event 302; desktop/tablet are paused before Round 4 at event 288.
- Backward seek R6 → R4 → R1 clears future highlights, feed and balances. At R1 paused, canvas seq 0 and empty activity. At paused R6 start, applied seq 483, strip Round 5 Reveal, ready-to-replay Round 6 text.
- Mobile selection from scrolled leaderboard now positions inspector top 16px, heading 27px; Close/tabs visible. Esc returns focus to merchant-01. Enter opens native activity details; plans/IDs remain expanded evidence.
- Activity tab opens at scroll bottom; latest coalition reward group visible. Adjacent contributions/payouts grouped, individual evidence retained.
- Console: zero error/warning messages in the tested recorded flow.
- Recorded event array byte-equivalent as parsed to base snapshot (596 events); roster model metadata only enriched.

## Independent Claude review and dispositions

Claude Sonnet 5.5 inspected actual running desktop/mobile UI read-only. It confirmed prefix correctness, hidden future final scores and hierarchy; served build changed during its review. Root fixed and rechecked paused phase status, mobile scroll-to-heading and newest activity visibility. Root also clarified wealth (coins), enlarged timeline targets to at least 24px/round controls 32px, grouped other routine events, deduplicated identical displayed plans per actor/round/phase, moved event IDs into details and clarified identity heading. No extra reviewer was spawned for these fixes.

Kept deliberately: unknown balances at seq 0 (no invented record); conventional tied ranks; inspector above village as requested; passes inspectable because forced/voluntary distinctions matter; recorded plan text unchanged even when it contains IDs; bounded inspector scroll preserves village space. Missing actual quality on decline no longer implies its linked offer lacks truth. These are UI decisions, not game-rule or metric-definition changes.

## States and limits

Empty cursor and unavailable balance states exercised. Complete/partial/missing data supported by focused contracts; completed-run navigation and explicit data/research remount were exercised before final copy corrections. Error/live reconnect states are not fully browser-retested in this snapshot. Report link is run-specific, but this isolated UI server has no database credentials: do not claim its report loader passed. Separately, public persisted replay/report were verified by hosting agent.

Reduced motion is implemented through Motion/Phaser preference checks; native OS reduced-motion toggle, full screen-reader pass, axe/contrast audit, large-population performance and Core Web Vitals have NOT been measured. Mobile canvas labels remain small; readable inspector/leaderboard are the alternative. No claim of full accessibility conformance.

Visual regression verdict: INCONCLUSIVE (no pixel-matched committed baseline). Targeted functional/visual review: PASS with stated limits. No production deployment authorized by this evidence.
