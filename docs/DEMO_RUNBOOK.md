# Demo: hosted recordings, local live simulations

Vercel is recorded playback only. Production and Preview (`VERCEL=1`) hide the
launch form and reject both `POST /api/runs` and `POST /api/batch` before actor
access. The page says “Live runs are available in the local demo” and links to
`/run/featured`. Existing replay/status/events/report reads remain available.
These changes require a Vercel deployment; a local commit does not change the site.
No Terse Cloud provisioning or Vercel reauthentication is needed for this demo plan.

## Local prerequisites

- Node 24 and pnpm 12.8.1; Bun >=1.4.2 on PATH. Verified here: Node 24.21.0,
  pnpm 12.8.1, Bun 1.4.4. This machine's existing Bun is at
  `/tmp/simulization-bun/node_modules/.bin/bun`; add that directory to PATH if needed.
- Existing dependencies: `pnpm install --frozen-lockfile` if not already installed.
- Gitignored root environment file:
  `/Users/alexzoghby/Desktop/YC Hackathon/simulization/.env`.
  Nonempty `DATABASE_URL`, `AI_GATEWAY_API_KEY`, `AGENTRELAY_API_KEY` are required.
  `AGENTRELAY_BASE_URL` is optional; the default is the existing Armadillo Relay API.
  Never put credentials in `NEXT_PUBLIC_*` variables.
- Keep the existing `.durable-actors` data. For a fresh demo session, use a NEW
  subdirectory as below: reusing a directory resumes registered unfinished runs.

## Start locally (does not itself create a new run)

Terminal 1:

```sh
cd '/Users/alexzoghby/Desktop/YC Hackathon/simulization'
export PATH="/tmp/simulization-bun/node_modules/.bin:$PATH"
mkdir -p actors/.durable-actors
export DURABLE_ACTORS_DATA_DIR="$(mktemp -d "$PWD/actors/.durable-actors/demo.XXXXXX")"
export DURABLE_ACTORS_URL=http://127.0.0.1:7100
export DURABLE_ACTORS_PROJECT_ID=local
export WEB_URL=http://localhost:3000
export SIM_RUN_MODE=live MODEL_MODE= VERCEL=0
pnpm actors:dev
```

Wait for `Consolidated Terse ready`. Keep the terminal running. Save the chosen
data-directory path privately if this session must be resumed later.

Terminal 2:

```sh
cd '/Users/alexzoghby/Desktop/YC Hackathon/simulization'
export DURABLE_ACTORS_URL=http://127.0.0.1:7100
export DURABLE_ACTORS_PROJECT_ID=local
export WEB_URL=http://localhost:3000
export SIM_RUN_MODE=live MODEL_MODE= VERCEL=0
pnpm dev
```

Open `http://localhost:3000/launch`. Both commands load root `.env` and preserve
explicit shell overrides. `pnpm dev` alone starts only Next, not Terse.
Do not click Start during readiness checks: starting a live run invokes models,
Relay, and subsequent paid report analysis. No new paid run was used to verify
these instructions. Existing preview on port 3100 can remain running.

## No-spend verification

```sh
PATH=/tmp/simulization-bun/node_modules/.bin:$PATH pnpm --filter sim smoke:next
pnpm --filter sim exec tsx scripts/hosted-launch-contract.ts
```

The first test explicitly blanks external credentials, uses new temporary actor
storage and dynamic ports, and cleans up its own processes. It verifies actual
Next/Terse startup, six stub rounds, ordering, duplicate submission, socket delivery,
and unattended restart recovery. This is a stub infrastructure test, not live-model
verification. The second checks that hosted starts are rejected before reading the
request body or accessing actors, while local request validation remains enabled.

Verified on 2026-10-31: the exact `pnpm actors:dev` command reached readiness in
live mode using fresh empty storage on test port 7125, then shut down cleanly.
No run was submitted. Root environment checks found all three required variables
and the optional Relay base URL present and nonempty; values were not printed.
The production build passed. Hosted-mode UI was inspected at 1440px and 375px;
the notice and recorded-playback button appeared, no launch form was rendered,
and both creation routes returned `503 LOCAL_DEMO_ONLY`. Local UI retained its
enabled Start button and rejected an invalid request with 400 before actor access.
