# Terse experiment job layer

Standalone Terse actor project (NOT part of the pnpm workspace; do not run `pnpm install` at repo root for it).
`ExperimentRunner` in `src/actors.ts` does exactly what `scripts/run-batch.ts` does:
start N runs -> poll each every 5s -> `POST /api/analyze/:runId` once per finished run -> `POST /api/synthesize`.
Failed or timed-out runs land in `dropped` with a reason.

Fallback if any step below stalls: `pnpm batch --n 8` from the repo root (same endpoints, same steps).

## Steps

```bash
cd terse
npm install                     # terse-sdk + terse-cli 0.14.9 (needs bun>=1.4.2 for the CLI)
npx terse auth login            # or: npx terse init (see note below)
npx terse secrets add SIM_URL   # e.g. https://sim.<you>.workers.dev
npx terse secrets add WEB_URL   # e.g. https://<app>.vercel.app
npx terse deploy
```

Or import both: put `SIM_URL=` and `WEB_URL=` in `terse/.env`, then `npx terse secrets import .env`.

`terse.config.json` holds a placeholder `projectId`. If `deploy` complains that the project is not linked or the id
is malformed, run `npx terse init` in a scratch dir (or `terse attach`) to get the real `{projectId, name}`
and paste it in. Entry file is `src/actors.ts`.

## Trigger a batch

Local: `npx terse actor dev` (port 7100, state in `.durable-actors/`; export SIM_URL/WEB_URL in that shell first),
then `npx terse actor generate` in the calling app to create the typed client.

Deployed: set `TERSE_ACTOR_URL` and `TERSE_API_KEY` in the caller, run `terse actor generate`, then:

```ts
import { actors } from "./generated"   // exact export shape: check generated output
const runner = actors.ExperimentRunner.get("main")
await runner.startBatch(8)
console.log(await runner.status())     // phase: starting|polling|synthesizing|done|failed
```

## UNCONFIRMED

- Whether `fetch` and `process.env` work inside the actor runtime (secrets may arrive differently).
- `this.alarm.set(epochMs)` / `onAlarm()` shape (from research notes; durable-actors types were not available locally).
- Generated client call shape (`actors.ExperimentRunner.get(id)`), modeled on the CLI README's Python example.
- terse-sdk 0.14.9 is actors-only: `createJob` is commented out in the SDK even though the init template still imports it.
  The "jobs" are therefore implemented as an actor.

## Plain-language job descriptions

Paste into Terse / the Claude Code plugin if jobs are available on your plan.

**1. Batch runner**
Start N simulation runs through the sim's batch endpoint, alternating the LABELED and BLIND conditions with seeds 1 to N.
Wait for each run to finish. As each run finishes, trigger the Mastra post-run analysis workflow for it, once.
If a run fails or times out, drop it and record the reason; never skip silently.

**2. Synthesis job**
After the batch finishes, trigger cross-run synthesis so the report compares the LABELED and BLIND conditions across all analyzed runs.
