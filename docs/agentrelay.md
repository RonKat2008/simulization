# AgentRelay (Relaycast) in Simulization

AgentRelay is a hosted messaging engine for agents (Relaycast): workspaces, agent identities, channels, DMs,
threads, search, realtime. We use only the REST part, over plain `fetch`, so it runs in Cloudflare workerd
without the SDK. All agent-to-agent traffic in a run goes through it, and every message is also logged as a
world event.

Code: `packages/agents/src/relayClient.ts` (REST client), `runRelay.ts` (per-run naming, setup, delivery, inbox
pulls with cursors), `relayInbox.ts` (turn-time wrapper that never blocks a turn).

## Getting a key

No auth is needed to create a workspace (verified):

```bash
curl -s -X POST https://armadillo.agentrelay.com/v1/workspaces \
  -H 'content-type: application/json' \
  -d '{"name":"simulization-dev-<unique>","expires_in_seconds":2592000}'
# -> {"ok":true,"data":{"workspace_id":"...","api_key":"ar_ws_...","created_at":"...","expires_at":"..."}}
```

The key is shown once. `expires_in_seconds` (60..2592000) makes it a throwaway; omit it for a persistent
workspace. `createWorkspace()` in `relayClient.ts` does the same call. Never commit the key.

## Env vars

- `AGENTRELAY_API_KEY`: workspace key (`ar_ws_*`).
- `AGENTRELAY_BASE_URL`: default `https://armadillo.agentrelay.com/v1`. Keys minted on armadillo only work there.
  Legacy `rk_live_*` keys live on `https://cast.agentrelay.com` (that host did not serve `/v1/health` when checked;
  only `/health`), so use armadillo for new keys.

Dev workspace for this repo: created 2026-10-31, expires 2026-11-30, key in the repo-root `.env` (gitignored).

## Auth model

- Workspace key: register agents, create channels.
- Agent token (`ar_ag_*`, returned once as `data.token` from `POST /agents`): post, DM, join, read as that agent.
  `RunRelay.setupRun` returns `agentId -> token`; the token is stored in `AgentState.relayToken`.
- Names are unique per workspace; duplicate registration gives 409 `agent_already_exists`, so never re-register
  a run's agents (a lost token cannot be re-read; `POST /agents/{name}/rotate-token` exists but we did not get it
  working with the workspace key, see UNCONFIRMED).

## Naming per run

For run id `R`, `runSlug = <first 6 chars of slug(R)>-<fnv1a base36 of R>`.
- Agent `A-04` -> relay agent `run-<runSlug>-a-04` (inverse: `agentIdFromRelayName`).
- Public square -> channel `run-<runSlug>-public`. Coalition `c1` -> `run-<runSlug>-c1`.
- DMs have no channel; the API creates a `dm_<hash>` conversation per pair on first `POST /dm`.

## Message flow

1. An agent's turn returns message actions to the WorldActor.
2. WorldActor validates and writes the event to the log, and only then calls `RunRelay.deliverMessage`
   (public channel post, `POST /dm`, or coalition channel post) with an idempotency key.
3. At the start of each turn, `withRelayInbox` calls `pullInbox`: public channel + current coalition channel +
   every DM conversation, each read with `after=<last seen id>`. Cursor is a JSON blob in `AgentState.inboxCursor`
   (`c`: source -> max id, `recent`: last `INBOX_SIZE` messages). Own messages are skipped. On any relay error the
   world-built inbox is used instead.

## Verified API behavior (live, 2026-10-31)

- Envelope `{ok, data}`; lists are a bare array in `data`.
- `GET .../messages` returns NEWEST-FIRST. `after=<id>` returns only newer messages (also newest-first). `before=<id>`
  returns older. With `limit`, you get the newest `limit` messages after the cursor, so more than `limit` (50) new
  messages in one source between pulls would drop the older ones (not a concern at our volumes).
- Ids are snowflakes (numeric strings, increasing in time). Message sender is `agent_name`.
- `POST /dm` returns `data.conversation_id`; `GET /dm/conversations` (as recipient) lists it with `participants`;
  `GET /dm/{id}/messages?after=` works.
- Channel create: 409 `channel_already_exists` on duplicate (handled). Creator is NOT auto-joined.
- `invite` adds the target directly as a member, but the inviter must already be a member (403 `not_a_member`).
- A non-member agent token could still read and post to a channel (membership is not enforced for reads/posts). The
  e2e only reads the coalition channel when the agent's `coalitionId` says so, so privacy is by our code, not the API.
- `leave` returns 204 No Content (client handles it).
- Rate limit headers: `x-ratelimit-limit: 30000` per window (reset about 60s later). Far above our needs.

## Scripts

- `pnpm --filter sim spike:relay`: exercises every client endpoint against the real API.
- `pnpm --filter sim relay:e2e`: RunRelay end to end (3 agents, public + dm + coalition, cursor checks).

## Workers compatibility

`relayClient.ts` / `runRelay.ts` use only `fetch`, `URLSearchParams`, `JSON`; no Node APIs, no sockets. The SDK
`@agent-relay/sdk` is a thin layer over `@relaycast/sdk` (realtime WebSocket client) with one `node:util` import in
its source; it would probably bundle under `nodejs_compat`, but we do not need it (no push; we poll with cursors),
so we did not add the dependency.

## UNCONFIRMED

- Retention / message size limits and per-workspace agent caps on the hosted service.
- `rotate-token` with the workspace key (returned no `data.token` in a quick try; shape not inspected).
- What happens at workspace expiry mid-run (docs: `401 workspace_expired`).
- Whether `cast.agentrelay.com` serves `/v1` for legacy keys.
- Behavior with more than 50 new messages per source between pulls (see above).
