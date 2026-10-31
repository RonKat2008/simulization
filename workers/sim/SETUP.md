# Track A product setup

Use one gitignored repository-root `.env`:
`/Users/alexzoghby/Desktop/YC Hackathon/simulization/.env` in this checkout.
Copy `.env.example` privately. Never commit credentials. Shell variables take precedence.
`pnpm dev` explicitly loads the root file and starts Next.js; `pnpm actors:dev` loads the same file and starts the consolidated Terse runtime. Do not duplicate configuration in package-local `.env` files.

## Required live configuration

- `AI_GATEWAY_API_KEY`: Vercel AI Gateway, used by all three merchant providers.
- `AGENTRELAY_API_KEY`, `AGENTRELAY_BASE_URL`: existing Relay workspace and API endpoint (default https://armadillo.agentrelay.com/v1).
- `DATABASE_URL`: the agreed Neon database, with `db/migrations/001_init.sql` applied. Terse SQLite remains authoritative actor storage.
- `ANTHROPIC_API_KEY`: E's direct Opus reviewer, needed to finish a persisted report.
- `AGENT_STORE=terse`. No Neon or Cloudflare actor fallback.
- `DURABLE_ACTORS_URL=http://127.0.0.1:7100`, `DURABLE_ACTORS_PROJECT_ID=local`.
- `WEB_URL=http://localhost:3000`, `SIM_URL=http://localhost:3000/api`, `NEXT_PUBLIC_SIM_URL=/api`.
- Optional `DURABLE_ACTORS_SECRET`: server-only authentication for the local control plane.
- Optional `DURABLE_ACTORS_DATA_DIR`: durable data directory, relative to `actors/`.

Live is the default (`SIM_RUN_MODE=live`). Leave `MODEL_MODE` unset. Missing live credentials reject creation; they do not select stub agents. For a credential-free rehearsal set `SIM_RUN_MODE=stub` in both processes. It uses six deterministic engine agents, explicitly reports `mode=deterministic-stub`, and does not request an Opus report. Live uses 18 agents. If Neon is configured, even stub rehearsal data is projected with its explicit provenance.

## Launch

Install workspace dependencies with pnpm and put Bun >=1.4.2 on PATH. Run `pnpm actors:dev` and `pnpm dev` in separate terminals. `pnpm dev:sim` is an alias for the consolidated actor runtime. Next.js serves the API and page on :3000; there is no second product HTTP server on :8787.

`actors/src/runtime.ts` exports WorldActor, MerchantAgent, ExperimentRunner, RunDirectory and ReportJob. B retains `actors/src/actors.ts`. `prepare-runtime.mjs` vendors the existing rules/world sources into the actor build so every class uses the same Terse SDK instance. Sources remain in `workers/sim/src`; generated `actors/vendor` is ignored. Do not edit the generated copies.

The run APIs are documented in `src/engine/INTEGRATION_HANDOFF.md`. Live event/status reads come from committed Neon projection, so viewer polling cannot block behind model calls. Socket grants connect directly to WorldActor and replay ordered events. Final projection atomically publishes the complete event log and done status. ReportJob calls E's `/api/analyze/:runId` separately; GET `/api/runs/:id/report` exposes the persisted metrics/review and their run provenance.

## Recovery and limits

RunDirectory durably records creation intent before World starts. Bootstrap replays registrations and re-arms run/report work without a viewer request. One bad registration does not stop unrelated runs. World initialization/checkpoint/settings are committed together. Phase keys and agent request IDs make retries idempotent. Projection is replayable and bounded to 10 seconds; failures retain the checkpoint and retry. Stopped runs are projected as failed so E cannot analyze them as completed.

Each acquired Relay token is persisted before the next setup operation and reused on retry. If the service creates a registration but its response/token is lost, its duplicate-name API cannot currently recover that token. World exposes setupError and requires a fresh run or token recovery coordinated with B. It never silently switches to stubs.

ReportJob permits three attempts with a 310-second HTTP deadline, outside World's serialized loop. E upserts the report under a stable run-specific ID. A crash after an external review succeeds but before acknowledgement can repeat the model review; E's workflow has no confirmed end-to-end idempotency guarantee. Hosted Terse deployment and hard-power-loss durability are not verified.

## Checks

- `pnpm typecheck`
- `pnpm --filter sim smoke:next`: actual Next.js + consolidated Terse, six stub rounds, socket, duplicate creation, unattended restart, ordered events and E metrics. No external credentials; test processes are cleaned up.
- `pnpm --filter sim smoke:projection`: mocked Neon transport and E row mapping.
- `pnpm --filter sim smoke:neon`: actual Neon SQL with temporary explicitly stub data; removes only its uniquely named test run afterward.
- Existing `smoke`, `smoke:world`, `smoke:adapter`, `smoke:unattended`, `smoke:http`, `smoke:terse`, `export:stub` cover rules and legacy runtime harnesses. `scripts/dev.ts` is the old isolated HTTP test harness, not the current product launcher.

Live acceptance requires real model/Relay evidence, browser rendering and a persisted report. A stub test or a standalone Terse probe is not that evidence.
