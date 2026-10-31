# Simulization — The Midnight Market

Multi-agent eval: AI agents from different companies trade, lie and ally in a pixel-art village; we measure in-group bias and out-group dishonesty (LABELED vs BLIND).

```
bun --version     # requires Bun >=1.4.2 on PATH
pnpm install
cp .env.example .env
pnpm dev          # web (Next.js)
pnpm dev:sim      # Terse actors + Bun HTTP API on :8787
pnpm mock         # regenerate mock runs
pnpm sim:local    # full game in Node, stub agents
pnpm typecheck
```

Read CLAUDE.md first. It is the shared spec.

Track A currently runs deterministic **stub agents**, not live models. `pnpm dev:sim` starts the actual Terse runtime and API together; actor state persists in `workers/sim/.durable-actors/`. No Cloudflare fallback exists.

Verification: `pnpm --filter sim smoke`, `pnpm --filter sim smoke:world` (product actors, restart, failed init/retry, 24-second stalled-agent test, alarms), and `pnpm --filter sim smoke:http` (actual dev bootstrap and HTTP/WebSocket round), and `pnpm --filter sim smoke:terse` (lower-level runtime probe). All require installed dependencies; actor checks require Bun on PATH. `pnpm typecheck` checks all workspaces.

The HTTP surface remains POST `/runs`, GET `/runs/:id`, GET `/runs/:id/events?after=N`, WebSocket `/runs/:id/ws`, POST `/runs/:id/stop`, POST `/batch`. Events retain the shared Event schema. RPC JSON strings are decoded at the HTTP boundary. WebSocket delivery can be retried; consumers deduplicate by id and order by seq, and recover gaps through polling.

Hosted Terse deployment, Neon projection, and live Track B model/Relay integration are not implemented. SDK 0.14.6 has no `deploy` CLI command; hosted deployment requires the official registration API and configured infrastructure. See `workers/sim/src/agents/TRACK_B_HANDOFF.md` for the runtime/turn interface.




Recovery scope: the product bootstrap restores automatic runs from its durable registration index, with no status request. `smoke:unattended` verifies this and verifies stopped runs remain stopped. The raw SDK-only probe still reproduces lost alarms. Hosted recovery and hard-kill/power-loss durability are unverified. See `workers/sim/SETUP.md`.
