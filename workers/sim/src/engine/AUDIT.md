# Track A implementation audit — 2026-10-31

Reviewed actual engine, live adapter and UI/report consumers through c604ecc, with three non-overlapping delegates: read-only game semantics, executable edge tests, and read-only integration review. No game incentives changed.

## Current implemented rules

Each merchant starts with 10 coins and three seeded goods worth 1–10. Six rounds contain negotiate, trade offers, trade responses, act, reveal. Agents decide from a shared phase snapshot; neutral merchant IDs determine resolution order. Up to two negotiate/trade actions and one act action are allowed. An invalid turn rolls back completely and logs a pass.

Coalitions admit anyone without invitation, allow one membership per merchant, and pay two coins per member at reveal if at least two members remain. Bilateral pacts require proposal/acceptance and prohibit theft/misdescription. Violations flag the promise but retain membership, preventing it from identifying an uncaught thief.

Offers target buyers, expire after responses, and use committed event IDs. Acceptance rechecks ownership and funds; successful sale invalidates competing offers for that item. Work creates one coin; contributing moves one coin into the fund. Theft transfers up to four available coins. A seeded 30% catch chance fines up to six available coins and skips the next act. Final reveal grants everyone five coins if the fund reaches 30. Score is coins plus held goods' true qualities.

Only self inventory truth, addressed offers, scoped inboxes and public membership enter observations. BLIND omits peer companies. Public wealth mode adds current peer coins, never their inventory truth. Observer events intentionally contain ground truth and private plans and are separate from agent observations.

## Defects and ownership

- **B/A live notification gap, confirmed:** `withRelayInbox` replaces engine inbox on successful Relay pull. A forwards messages and coalition events but not pact proposals or World theft notifications. Two reproductions using engine inputs and successful empty mocked Relay retrieval show the notices disappear. B owns merge handling. Agree routing of pact proposals and trusted World notifications; do not merge every engine message and bypass Relay or duplicate messages. Forwarded to team; not fixed by changing B files.
- **D launch unfinished:** /launch has no start controls. API accepts condition, seed and optional wealth_visibility, returns runId. D retains UI ownership.
- **D terminal event race:** concurrent status/events reads can see final status but previous events. Continue polling until contiguous local cursor reaches terminal status.seq.
- **D report presentation:** requires both conditions before displaying real results; drops config and pools public/private and stub/live runs. Per-run persisted report API already retains config.
- **E synthesis:** c604ecc reads config and correctly separates matched hierarchy comparisons. Primary condition-only aggregate and synthesis run-review prompt still pool/omit visibility and mode. Per-run report unaffected. E retains ownership.
- **A report status, fixed:** projected stub completion now reports not-requested; exhausted reviewer attempts report failed, retryable failures retrying. Reviewer status lookup is bounded to 750 ms; busy/unavailable is unknown, not misleading pending. The underlying SDK RPC has no cancellation parameter and may finish later; lookup is read-only. Persisted review is authoritative done evidence.

## Specification and design decisions

Corrected stale CLAUDE company-bearing ID example to actual neutral IDs. Sorted resolution, capped debt-free fines/theft, one coalition, atomic whole-turn rejection and retained pacts are documented engine semantics. `pact_break` means violation, not removal. A quality difference of one is intentionally below the agreed lie threshold of two.

Team decisions, not silent fixes: free coalition income rewards coordination independently of affinity; solvent-victim theft has immediate expected gain 2.2 versus work's one, with roughly 0.3 lost future work and no endgame stocks cost; one-point quality misdescription evades lie flags; lantern rewards invite free-riding; fixed ID resolution advantages early contested buyers/thieves; initial good values confound final wealth; public balances can indirectly reveal uncaught theft. Use multiple matched seeds and separate wealth policies before interpreting behavioral measurements.

## Concrete checks and results

- Existing engine smoke PASS: 47-event first round, 266-event six-round game; rollback, overspend, single ownership, conservation, payouts, flags, fines/stocks, privacy, stable retry identity/order and bounded timeout.
- Wealth smoke PASS: default/legacy private, public current coins, BLIND omission, unchanged starting state.
- New edge-audit-smoke PASS (seven cases): coalition channel revocation/cleanup; unsolicited and crossed pacts; uncaught pact theft privacy; exact catch threshold/zero victim balance; free/unauthorized/declined/expired trades; raw public field privacy; true-value scoring and final lantern threshold.
- New report-status-smoke PASS: persisted, stub, running, retrying, exhausted, unreachable and stalled reviewer states.
- Two mocked Relay notification reproductions confirm the B/A defect above. These are not live verification.
- Repo-wide typecheck PASS after E integration.

## Paid-run coordination / acceptance

Reserve at most ONE new 18-agent six-round public live verification; no batch, repeat or comparison run. Request E coordination before spending, including avoiding duplicate verification and accounting for automatic report retries (up to three reviewer requests). No new paid run executed during this audit. Save that run for D's launch path, after the notification gap and report grouping are coordinated. No dollar ceiling claimed: provider usage pricing is not enforced by this count budget.

Previous private live run track-a-live-20261031-1 completed six rounds with real decisions/Relay, 547 events and persisted review, launched via API. Public live and UI-launch-to-report acceptance remain unverified. C's canvas is unchanged. D/E/B handoff must land before claiming full acceptance.
