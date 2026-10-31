# Hosted demo deployment

The UI is intended to be usable at https://simulization.vercel.app without local commands.
Recorded replay, run-specific reports, and public metadata reads do not require an operator key.
Starting runs, stopping runs, analysis, and synthesis are operator actions. No additional paid
experiments were authorized for this milestone.

## Verified Vercel configuration (2026-10-31)

Inspected the authenticated Dia session for team `agents-db31`, project `simulization`
(`prj_pLp6900el8Ex3rHyrDyUj13t7efr`). GitHub is connected to `RonKat2008/simulization`.
Production tracks `main`; Preview tracks all unassigned branches. Root is `apps/web`,
Next.js preset, build/install overrides off, outside-root build files enabled, Node22.x.
The successful production log uses pnpm12.8.1, workspace installation and
`pnpm run build` → `next build`. It contains a Mastra in-memory workflow warning;
finished metrics/reviews are separately persisted by the application to Neon.

Production initially served `8f68ea029804534df8983c3b2b8c33c2f92d2ab5`
(deployment `D261EYjyQyidQsFeVNzsV9uFYaMg`). During inspection another session deployed
`b099d71383300159c769df23de540a2a0eb6e80a` with `/experiment` methodology changes.
Those changes are outside this reviewed UI/deployment milestone. PR1 was merged externally
at `0c5ceb509b99b490c313b02c08e0bf4a98eb9354`; this agent did not merge main.

Production and Preview both list only `DATABASE_URL`, `AI_GATEWAY_API_KEY`, and
`ANTHROPIC_API_KEY`; neither has linked Shared variables. Values were not revealed.
No Relay, Terse URL/project/auth, or operator token is configured in either environment.
Do not assume the local root `.env` is deployed.

Public read-only checks returned200 for completed public live run
`1e5c714e-e4bc-4d1d-aeb1-ff1eea922f94`, all607 contiguous events, and its persisted
report. Village playback and the run-specific report rendered. `/socket` returned503.
Neon reads are working; separately hosted Terse connectivity is **not** working.
No new model, Relay message, paid run, analysis, or synthesis was initiated.

The production homepage/launch first inspected were stale; later production updated
from another session. Our redesigned UI is verified locally, not promoted to production.
`/api/version` in this milestone will expose only `VERCEL_GIT_COMMIT_SHA` for future checks.

## Required deployment configuration

- Deploy the reviewed integration commit with project root `apps/web` and the workspace lockfile.
- `NEXT_PUBLIC_SIM_URL=/api`. No server credential belongs in a `NEXT_PUBLIC_*` variable.
- `DATABASE_URL`: agreed Neon database; read-only replay/report routes use it. Terse remains
  the authoritative actor runtime and checkpoint store; `AGENT_STORE=terse`.
- `DURABLE_ACTORS_URL`: reachable **HTTPS** Terse control plane, not localhost or the demo
  laptop's loopback address. `DURABLE_ACTORS_PROJECT_ID` selects the deployed actor project.
- `DURABLE_ACTORS_SECRET`: private control-plane credential when configured by that service.
- `SIM_OPERATOR_TOKEN`: privately configured on both web and Terse services. The operator
  enters it in the launch form; the browser does not persist it. All mutating API entry points
  require it on Vercel. Missing token disables paid execution; reads/replays continue working.
- `SIM_RUN_MODE=live`; leave `MODEL_MODE` unset. `AI_GATEWAY_API_KEY`, `AGENTRELAY_API_KEY`,
  `AGENTRELAY_BASE_URL`, and `DATABASE_URL` must also be available to the Terse actors.
- Terse `WEB_URL` must reach the Vercel service for report callbacks; set the same private
  `SIM_OPERATOR_TOKEN` there. Review keys remain on the web service. Keep existing reviewer
  budget settings; deploying does not authorize new analysis or synthesis.

The server rejects loopback Terse configuration on Vercel. A configured URL is not a proof of
reachability: the owner must provision the actual Terse service before hosted launch can pass.
Local `PORT=3000 pnpm dev` loads the gitignored repository-root `.env`; Vercel uses its project
environment settings. The local launcher remains the backup, without changing public mode.

## Read-only post-deploy acceptance

1. Check `/api/version` matches the reviewed commit.
2. Open `/`, `/launch`, `/runs`, and `/run/featured` on desktop/tablet/mobile.
3. Confirm recorded/live/stub labels, both visibility controls, and operator-gated start.
4. Select/deselect an agent, pause and scrub replay; inspect model metadata and coins history.
5. Open `/report?runId=1e5c714e-e4bc-4d1d-aeb1-ff1eea922f94`; confirm persisted settings,
   evidence, and versioned behavior metrics. Do not start a new experiment or regenerate a review.

Final public visual verification is pending a deployment of the reviewed milestone. Local
screenshots are recorded separately and are never presented as production evidence.
