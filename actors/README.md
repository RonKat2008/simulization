# actors: Terse Durable Actors (Person B)

Two actors in `src/actors.ts`, built on [Durable Actors](https://github.com/TerseAI/durable-actors) 0.14.6 (npm `durable-actors`).

- **MerchantAgent** (actorId `${runId}.${agentId}`, e.g. `run-x.A-01`; `:` is not a legal actor id character). One per agent: it keeps that agent's persistent memory/state and runs its turn (relay inbox, then model call through the gateway, validate, one repair retry, else pass). Turns for one agent are serialized and roll back if they throw (no `@Interleave`). With no `AI_GATEWAY_API_KEY` it returns a pass output so local runs still work.
- **ExperimentRunner** (actorId e.g. `main`). The Terse experiment job, as a durable state machine:
  1. **Batch runner:** start N runs through the sim's batch endpoint (alternating LABELED and BLIND, seeds 1..N), wait for each to finish, and trigger the post-run analysis workflow for each finished run.
  2. **Synthesis job:** once every run has settled, trigger cross-run synthesis.
  Runs that fail or take over 20 minutes are dropped with a recorded reason, never silently. Each alarm tick does bounded work (poll every 5 s). Fallback with identical steps: `pnpm batch` (`scripts/run-batch.ts`).

## Setup

Requires **Bun >= 1.4.2**: `npm i -g bun` (if `bun -v` then says the postinstall did not run: `cd "$(npm root -g)/bun" && node install.js`), or `curl -fsSL https://bun.sh/install | bash`.

```sh
pnpm install                      # repo root
cp actors/.env.example actors/.env
pnpm --filter actors dev          # or: pnpm actors:dev. Wait for "Ready" (control plane http://127.0.0.1:7100, project id "local")
pnpm --filter actors generate     # typed client into actors/generated (git-ignored, regenerated)
pnpm --filter actors inspect      # list actors; `inspect MerchantAgent/run-x.A-01` shows persisted state
pnpm --filter actors observe      # local observability UI
pnpm --filter actors typecheck
```

`@simulization/shared` and `@simulization/agents` are workspace deps, but Durable Actors type-checks actor code with TS NodeNext, which rejects those packages' extensionless relative imports. `scripts/vendor.mjs` (run automatically by dev/generate/typecheck) copies their sources into `actors/vendor/` (git-ignored) with `.js` added, and `tsconfig.json` `paths` points at the copies. Originals are untouched. Restart `dev` after editing those packages.

## How the sim calls it

Run the sim with `AGENT_STORE=terse` plus `DURABLE_ACTORS_URL` (control plane, local `http://127.0.0.1:7100`), `DURABLE_ACTORS_PROJECT_ID` (`local`) and `DURABLE_ACTORS_SECRET` (only if the server has auth on). Its store then calls `init`/`load`/`save`/`takeTurn` on `MerchantAgent`.

## Trigger the batch

```sh
curl -s -X POST http://127.0.0.1:7100/v1/projects/local/actors/ExperimentRunner/main/invoke \
  -H 'content-type: application/json' \
  -d '{"requestId":"r1","method":"startBatch","args":[8]}'
# progress:  same URL, {"requestId":"r2","method":"status","args":[]}
```

Or with the generated client: `actors.ExperimentRunner.get("main").startBatch(8)`. `requestId` identifies an attempt only; it does not deduplicate. `SIM_URL` and `WEB_URL` must be set in the environment of `dev` (a `.env` in `actors/` is loaded).

## Deploying (UNCONFIRMED, not tried)

- Self-host on GKE Sandbox + PostgreSQL + GCS: see `docs/self-hosting.md` in the durable-actors repo (needs a GKE cluster, Helm, an HTTPS host). Set the same `DURABLE_ACTORS_SECRET`/API key on server and backend.
- Terse cloud: the docs reference hosted control planes and a project id, but the deploy command and how env vars like `SIM_URL` reach actors there are UNCONFIRMED.
- For the hackathon, local `dev` plus the `pnpm batch` fallback is the verified path.
