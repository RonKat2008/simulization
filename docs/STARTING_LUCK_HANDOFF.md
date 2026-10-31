# Starting Luck handoff

Owned files only; child branch t3/starting-luck-feature, tool-managed checkout. Existing metrics-v2 and viewer work are untouched. Component is intentionally unmounted.

## Evidence

Inspected repository recordings apps/web/public/runs/rec-blind-s11-public.json (584 events), rec-blind-s7-private.json (617), rec-labeled-s11-public.json (596). Their run records contain final scores and id/name/company rosters, not initial inventories, true values or exact models. Event schema records offer groundTruth.trueQuality but no initialization allocation event. workers/sim/src/engine/world.ts creates inventories at initialization with goodId/trueQuality; that implementation is not persisted historical proof. Current recordings therefore return unavailable, with no plotted points. No network/database access, credentials, new runs or model calls were used.

## Accepted input

startingLuck accepts exactly one completed run with full events and persisted terminalSeq. Sequence coverage, event IDs, run IDs and offer attribution are checked. Supply a separately verified persisted initial snapshot with matching runId, phase initial, source reference, complete per-agent expectedGoods counts and inventories of unique goodId / finite nonnegative trueValue. Counts must come from authoritative initialization evidence, not the length of a truncated export. Never fabricate this adapter from final holdings, model plans, seed regeneration or ID patterns. Initialization-event adapters must first prove complete allocation coverage and normalize to this contract; no such source exists in current checked recordings.

Value sums trueValue only, independently of quality, asking prices and coins. Do not map trueQuality to trueValue unless a historical versioned engine valuation rule explicitly establishes equivalence. False claims count trade_offer events containing engine lie flags once per offer; no new quality/intent judgments. No-offer rates are null. Missing model or metadata remains Unknown, never inferred from company. Metadata and all agent model identities remain in output. Structural evidence failure suppresses all points conservatively. Caller is responsible for provenance authenticity and terminal completeness; a contiguous truncated log is not complete merely because its last seq is supplied.

## Parent integration request

In apps/web/src/app/report/page.tsx, mount `<StartingLuck result={startingLuck(input)} />` immediately after `<ChartsSection data={data} />`, inside the ready report content. Import component from `@/components/report/starting-luck`. Parent should add `export * from './starting-luck';` to packages/shared/src/index.ts to import calculation from @simulization/shared (not done here). Component currently uses a relative type-only import to avoid changing package exports. Feed the selected single completed run, never aggregated condition groups or replay-cursor events. Default to the report's selected completed run; do not silently pool runs. The current LoadedRun contract lacks terminalSeq, exact models and initialization evidence; parent loader must preserve these when present, otherwise pass unavailable input honestly. No backend edits are requested to invent old data.

Native details expansion, existing surface/border/primary tokens, Recharts scatter, fixed 0–100% rate axis, selectable agent details and a visible table follow the existing report design. Identical points may overlap; the agent selector/table exposes every agent. No global styles or dependencies added.

## Verification

`node workers/sim/scripts/starting-luck-contract.ts` passed with Node 24: hand-calculated value 20 (quality 3, asking price 30), one chart point at rate 0.5, duplicate flags counted once, no offers, missing goods, ignored final holdings, unknown metadata/model, incomplete log and all three real recordings returning unavailable.

Bun and installed TypeScript/React dependencies were absent in this checkout; full typecheck and rendered desktop/mobile/interaction verification remain outstanding. Parent-owned localhost:3100 was not accessed or restarted. No push, PR or deployment.
