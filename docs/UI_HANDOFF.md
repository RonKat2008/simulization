# Focused UI handoff

Branch: `integration/astra-finish`. Base reconciled through main `8f68ea0`. UI edits are paused.
The milestone is committed separately from the unfinished behavior-v2 methodology work.
No simulation rules or historical events changed; featured roster model metadata came from stored Neon rows.

## Changed tracked files

- `.env.example`
- `actors/src/reportJob.ts`
- `apps/web/public/runs/featured.json`
- `apps/web/src/app/api/analyze/[runId]/route.ts`
- `apps/web/src/app/api/batch/route.ts`
- `apps/web/src/app/api/runs/[id]/stop/route.ts`
- `apps/web/src/app/api/runs/_service.ts`
- `apps/web/src/app/api/runs/route.ts`
- `apps/web/src/app/api/synthesize/route.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/launch/page.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/runs/page.tsx`
- `apps/web/src/components/how-it-works/experiment.tsx`
- `apps/web/src/components/landing/hero.tsx`
- `apps/web/src/components/landing/site-footer.tsx`
- `apps/web/src/components/landing/site-header.tsx`
- `apps/web/src/components/launch/launch-form.tsx`
- `apps/web/src/components/launch/launch-panel.tsx`
- `apps/web/src/components/launch/option-group.tsx`
- `apps/web/src/components/launch/start-run.ts`
- `apps/web/src/components/run/agent-card.tsx`
- `apps/web/src/components/run/event-feed.tsx`
- `apps/web/src/components/run/roster.tsx`
- `apps/web/src/components/run/run-helpers.ts`
- `apps/web/src/components/run/run-summary.tsx`
- `apps/web/src/components/run/run-viewer.tsx`
- `apps/web/src/components/run/top-bar.tsx`
- `apps/web/src/components/run/use-run-source.ts`
- `apps/web/src/components/runs/group-runs.ts`
- `apps/web/src/components/runs/run-card.tsx`
- `apps/web/src/game/VillageCanvas.tsx`
- `apps/web/src/game/scene.ts`
- `apps/web/src/store/eventStore.ts`

## Added files

- `apps/web/src/components/landing/village-preview.tsx`
- `apps/web/src/components/run/agent-history.ts`
- `apps/web/src/lib/execution-policy.ts`
- `apps/web/src/app/api/version/route.ts`
- `workers/sim/scripts/agent-history-contract.ts`
- `workers/sim/scripts/execution-policy-contract.ts`
- `docs/HOSTED_DEPLOYMENT.md` and this handoff/evidence

## Verification and limits

Production build with TypeScript passed. History contract verifies90 engine phases, all18 recorded final balances, replay cutoff, tamper/gap and member-pact checks. Viewer and theft explanation contracts pass. Operator policy tests and real local HTTP403 checks pass. Independent comprehension review passed after fixing future events/scores beside early replay state. See `evidence/selected-agent-redesign/evidence.json`.

Repository-wide tsc repeatedly encounters externally generated numbered duplicate `.next/types/routes.d 2.ts` files. Removing/preserving those copies outside generated output makes web tsc pass; they recur in this filesystem. Production builds themselves pass TypeScript. Numbered source copies were preserved under `/tmp/simulization-sync-backup-20261031`, not committed. Existing untracked `apps/web/AGENTS.md` is untouched.

Methodology-v2 files are isolated in a named Git stash and excluded from this milestone. Further report formula changes require independent review. Main advanced independently to `b099d71` with `/experiment`; that work is not silently included or removed here.

No paid model run, analysis or synthesis was started. Public Vercel settings and read-only results are documented separately; this UI has not been promoted to main or production.
