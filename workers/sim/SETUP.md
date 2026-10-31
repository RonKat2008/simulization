# Local Track A/B setup

Requires pnpm dependencies and Bun >=1.4.2 on PATH. Use one repository-root `.env` (copy `.env.example` and populate privately). Both `pnpm dev:sim` and `pnpm actors:dev` explicitly load it. Existing process/shell values win; do not duplicate keys in package-local env files. Bun can preload local env files if present; remove those duplicates to keep one source. `.env.example` and `.dev.vars.example` are templates, never credentials.

- `AI_GATEWAY_API_KEY`: Vercel AI Gateway (gatewayModel.ts), not a direct provider key.
- `AGENTRELAY_API_KEY`: existing AgentRelay integration.
- `DATABASE_URL`: agreed Neon database/projection only; actor checkpoints are Terse SQLite.
- `AGENT_STORE=terse`: mandatory for actors. `neon` and `do` are rejected by the factory.
- `MERCHANT_ACTORS_URL`: Track B control-plane URL (`DURABLE_ACTORS_URL` is also accepted) printed by `pnpm actors:dev` (normally http://127.0.0.1:7100).
- `MERCHANT_PROJECT_ID`: defaults to local.
- `MODEL_MODE=stub`: explicit credential-free MerchantAgent test mode; unset for live testing.

`pnpm dev:sim` launches WorldActor runtime + HTTP on :8787. `pnpm actors:dev` launches B's MerchantAgent runtime separately. HTTP-created games are currently deterministic stubs. Live integration uses a new manually stepped WorldActor, enableLive(), and advance(nextKey); it is not yet live-verified or exposed as a UI mode.

Recovery: the local service persists registration metadata in its data directory's runs.json before initializing a run. Bootstrap replays idempotent initialization to re-arm automatic running actors. Stopped and completed actors remain stopped/completed. True state/events are only in Terse SQLite. No browser/status request is needed. The raw SDK runtime alone still loses alarms on restart; hosted startup needs an equivalent recovery mechanism and is not verified. Mid-write power failure and hard-kill durability are not claimed.

Checks (no credentials): `pnpm --filter sim smoke`, `smoke:world`, `smoke:adapter`, `smoke:unattended`, `smoke:http`, `smoke:terse`, `export:stub`; plus `pnpm typecheck`. Bun commands need Bun on PATH. Unattended test waits 16s with no client traffic after restarting the product bootstrap. World test includes the real 24s timeout/retry budget. `scripts/unattended-runtime-probe.ts` documents the raw-runtime failure and intentionally exits nonzero.

Credential-blocked: real provider decisions; actual Relay send/recipient-inbox receipt; Neon projection validation. Hosted deployment also needs deployment configuration. Stub success proves none of those.
