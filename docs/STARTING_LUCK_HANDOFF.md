# Starting Luck integration handoff

Feature commit `28ad7d7be57a6a5fa5b002ff6fb5a048cbd08600` alone was cherry-picked as `dcb2047aee3b9e216ab8b7a27c53879892f0cb58` onto latest main. The metric-v2 parent was not picked. Corrections from stash commit `770405fd44a3fe59788afe13d0d4ac411c78fb3c` were inspected and applied only to owned files; stash and shared index were untouched. The corrected type import uses the actual relative module path until root adds the shared export.

## Delivered behavior

The ready report mounts a compact, native expandable Starting Luck and Behavior section immediately after Charts. A completed-run selector is shown for grouped reports; only one run is displayed at a time. Each calculation receives one full run, never pooled conditions or replay-cursor events. Existing group selection isolates live/stub mode and wealth visibility (and label/monitoring settings). Each result retains condition, run ID, wealth visibility, mode and the recorded exact model/provider roster. Unknown identities are explicitly unknown, never inferred from company.

The scatter uses total initial goods true value and engine-flagged false claims / recorded offers. It has a fixed 0–100% rate axis, agent selection and a visible table exposing all agents, including overlapping points and unavailable/no-offer rows. Copy describes an observed association, not causality or an ethical composite. Existing report styling is preserved; no other UI files or global styles were changed.

## Evidence and fail-closed contract

`startingLuck` accepts a completed run, full events and an independently persisted `terminalSeq`. It validates event schema, contiguous sequences from 1 through the checkpoint, canonical event IDs, run identity and offer attribution. A missing or mismatched checkpoint, gapped/malformed stream or invalid roster suppresses behavior counts/rates and all points. Counts are null when unavailable, rather than reporting partial counts as valid. Flagged offers count once even with duplicate flags. No offers yields zero counts and a null rate, displayed as “No offers.”

Starting value is independently available only from a verified persisted pre-action snapshot: matching run ID, phase `initial`, source reference, per-agent authoritative expected goods counts and complete inventories of unique goods with finite nonnegative true values. Malformed/missing inventory suppresses starting value and points but preserves valid behavior counts. Never normalize final holdings, regenerate a seed, use asking prices, or treat model text as historical initialization evidence. True quality may only be mapped to value if a historical engine valuation contract establishes equivalence. Snapshot provenance and checkpoint authenticity remain the adapter's responsibility.

All seven `apps/web/public/runs/rec-*.json` recordings were checked. They have valid complete event logs against `run.seq` and valid behavior counts, but no persisted initial inventory evidence; initial values and scatter points are unavailable. Existing recordings' rosters lack exact models. The legacy shared mock fixtures also lack a terminal checkpoint, so the offline mock section honestly reports incomplete event evidence rather than deriving a checkpoint from array length. No historical evidence was invented.

## Root integration requirements

1. Optional package export: `export * from './starting-luck';` in `packages/shared/src/index.ts`. Current relative typed imports work and pass build; root can switch them after exporting.
2. The owned report `LoadedRun` type now accepts `terminalSeq?: number`, `initial?: StartingLuckInput['initial']`, and agent `provider?` / `model?`. Root's `apps/web/src/components/report/neon.ts` loader must preserve these. Its current SELECT drops provider/model, and its run mapping supplies neither terminal checkpoint nor initial evidence. Until corrected, real Neon reports explicitly mark these fields unavailable. Never set terminalSeq from `events.length` or last loaded sequence. Preserve raw full log validation; no dropped malformed rows.
3. Root independently owns engine initialization evidence, Neon projection and shared schemas. Only populate `initial` after authenticating persisted pre-action provenance and complete allocation coverage. Existing recordings need no backfill from inference. The adapter is ready to accept verified evidence when available.
4. Root owns rendered desktop/mobile and keyboard verification on its port 3100 server. No server was started or accessed here.

## Verification

- `pnpm --filter sim exec tsx scripts/starting-luck-contract.ts` passed: hand-calculated value 20 (distinct from quality 3 / price 30), 1/2 false claims, duplicate flags, no offers, missing inventory, ignored final holdings, unknown metadata, gaps and missing/mismatched checkpoints, shuffled log, duplicate/negative goods, wrong run, incomplete status, malformed flags/events/inventories, and all seven recordings.
- The same contract script exercises `assembleNeonReport` with offline fixtures: separate results per run, selected single-run filtering, exact provider/model retention, conditions, live/stub isolation and pending status. No database loader is invoked.
- `pnpm --filter @simulization/shared typecheck` passed.
- `pnpm --filter web typecheck` passed.
- `pnpm --filter web build` passed, including Next TypeScript and static generation. Existing Mastra in-memory-storage warning remains.
- `git diff --check` passed.

Dependencies were installed from the existing lockfile with scripts disabled. No credentials, model/Relay calls, simulation runs, external database mutation, production changes, push or PR. Browser screenshots and interactive verification remain unperformed.
