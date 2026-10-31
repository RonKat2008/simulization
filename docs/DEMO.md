# Simulization local demo

Use branch `integration/astra-finish`. This is a local Terse runtime plus Next.js and the agreed Neon projection; no Cloudflare or Neon actor fallback. Do not merge this branch without approval.

## Start

1. Install workspace dependencies with `pnpm install --frozen-lockfile`. Put Bun >=1.4.2 on PATH.
2. Populate the gitignored repository-root `.env` privately. Required: `AI_GATEWAY_API_KEY` (Vercel AI Gateway), `AGENTRELAY_API_KEY`, `AGENTRELAY_BASE_URL`, `DATABASE_URL` (Neon), and `ANTHROPIC_API_KEY` (report reviewer). Never paste credentials into a terminal command or commit them.
3. Use `AGENT_STORE=terse`, `DURABLE_ACTORS_URL=http://127.0.0.1:7100`, `DURABLE_ACTORS_PROJECT_ID=local`, `WEB_URL=http://localhost:3000`, `NEXT_PUBLIC_SIM_URL=/api`, `SIM_URL=http://localhost:3000/api`. Leave `MODEL_MODE` unset for live runs. Existing Neon schema must be applied.
4. Terminal one: `pnpm actors:dev`. Terminal two: `pnpm dev`. Both load root `.env`; shell settings win.
5. Open http://localhost:3000/launch. Plain-language controls select company labels and peer coin visibility. Seed and matched-pair controls are under Advanced. **Starting a live run spends provider usage. The one approved verification run has already been launched; replay it instead of launching another.**

## Replay the approved public live run without new model calls

Run ID: `1e5c714e-e4bc-4d1d-aeb1-ff1eea922f94` (LABELED, public wealth, seed 1, 18 merchants).

Verified on 2026-10-31: all six rounds completed, 607 contiguous events reached the village, all 18 initial model decisions succeeded, and actual Relay messages matched committed communication. Neon contains metrics for 432 agent turns and a schema-valid 30-claim review whose citations resolve to this run's events. These are live results; the separate stub checks are not included in these counts.

- Viewer: http://localhost:3000/run/1e5c714e-e4bc-4d1d-aeb1-ff1eea922f94
- Report: http://localhost:3000/report?runId=1e5c714e-e4bc-4d1d-aeb1-ff1eea922f94
- Select a merchant or event. Observer ground truth and generated self-reported plans are distinct from the information permitted to agents.
- Use round controls and replay speeds to inspect events. The live viewer drains through the final sequence before marking completion.
- Reports retain run settings. Comparison groups separate company-label condition, wealth visibility and live/stub mode. Scores measure game outcomes; behavioral measures and hierarchy indicators are descriptive, not a verdict on providers.

The report appears after automatic review. Loading the report only reads status/data; it never starts another review. A failed reviewer is shown explicitly. Scripted examples are `/run/mock`, `/run/mock-blind`, `/report?mock=1`; these are not live results.

## Verification commands

- `pnpm typecheck`
- `pnpm --filter sim exec tsx scripts/live-inbox-contract.ts`
- `pnpm --filter sim exec tsx scripts/viewer-contract.ts`
- `pnpm --filter sim exec tsx scripts/report-ui-contract.ts`
- `pnpm --filter sim exec tsx scripts/synthesis-contract.ts`
- `pnpm --filter sim smoke:adapter` (Bun required; explicit stub model)
- `pnpm --filter sim exec tsx scripts/verify-live-run.ts 1e5c714e-e4bc-4d1d-aeb1-ff1eea922f94 --complete` (read-only, existing live run)

## Limits

Local hosted-deployment/authentication hardening and hard-power-loss recovery are not certified. Terse startup resumes registered unfinished runs; do not point a rehearsal at someone else's runtime directory. Lost Relay registration responses still lack token recovery. Reviewer retries can repeat external work after lost acknowledgement. One run is integration evidence, not a statistically powered experiment. Existing historical runs without an explicit wealth setting use the original private default. No new paid comparison or synthesis was requested for this verification.

The production build passes. Its Mastra in-memory-storage warning refers to workflow bookkeeping: final metrics and reviews are explicitly saved in Neon, and delivery retries are managed by the durable Terse ReportJob. It does not mean the saved report is in memory. Mid-workflow retries can repeat external work.

Browser evidence and scoped accessibility observations are in [evidence/astra-finish/evidence.json](evidence/astra-finish/evidence.json). Layouts were inspected at 375, 430, 768 and 1440 CSS pixels. Keyboard focus, report evidence dialog, invalid launch input, missing report, and the Phaser reduced-motion branch were checked. This is not a full screen-reader, automated WCAG or performance audit.
