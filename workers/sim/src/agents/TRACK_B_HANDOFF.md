# Current consolidated integration (2026-10-31)

A's `actors/src/runtime.ts` exports the existing B actors together with WorldActor, RunDirectory and ReportJob. `pnpm actors:dev` is now the single local actor service on `DURABLE_ACTORS_URL` (:7100); `pnpm dev` serves the Next.js API on :3000. `SIM_URL=http://localhost:3000/api` and `NEXT_PUBLIC_SIM_URL=/api`. B retains its actor/pipeline/Relay files; A owns preparation, World, directory, reports dispatch and Next run APIs. `prepare-runtime.mjs` calls B's existing vendor script and prepares A's source under the same SDK instance.

B's 669bbbd, bfd873e and 9873034 are integrated. Real per-provider gateway calls passed; Relay public/DM/coalition delivery and recipient cursors passed. An 18-agent live run passed a complete round and actual in-run Relay delivery matched committed message text; merchant state contained received inbox messages. Stub adapter regression still passes cancellation, deadlines and duplicate caching across restart.

A's live initialization now saves each token before further setup requests and reuses stored tokens. Remaining B decision: the documented POST /agents duplicate-name response cannot recover a token if the original response was lost. A exposes a setupError rather than silently replacing live agents. Confirm supported token recovery before claiming full external-service exactly-once initialization.

A's legacy manually stepped driver is still supported for isolated tests. The product path is POST /api/runs -> durable registration -> asynchronous live setup -> automatic phases -> Neon projection -> ReportJob -> E's persisted analysis. See ../engine/INTEGRATION_HANDOFF.md for the API contract and verified limits.

---

Historical contract notes follow; the consolidated entrypoint and Next.js routes above supersede the earlier split-runtime launch instructions.

# Track A / B integration contract

Based on origin/main 173303c. WorldActor runs from workers/sim/src/actors.ts; B's real MerchantAgent and ExperimentRunner run from actors/src/actors.ts. Both use Terse 0.14.6. The obsolete Cloudflare store and placeholder AgentActor are removed; no fallback exists.

Shared AgentStore.takeTurn arguments: (runId, agentId, input, signal?, requestId?, deadline?). B's fourth AbortSignal remains compatible; A supplies stable fifth requestId and sixth epoch-ms deadline. All optional additions are integration changes. TerseAgentStore forwards the deadline and request ID. Same turn retries keep identity; offers/responses have distinct keys. MerchantAgent atomically caches the completed output with state and replays it after restart. Relay names preserve opaque merchant-NN IDs. These bounded fixes affect B's integration files, not its gateway/Relay provider choice.

A uses TerseAgentStore + RunRelay in world/liveAdapter.ts. A new manually stepped WorldActor can call enableLive(), which requires gateway/Relay keys and MERCHANT_ACTORS_URL. No live-mode stub fallback. Validated messages/coalition events are delivered after commit. deliveredSeq persists only after successful delivery; event ID is message idempotency key. Pending events flush before the next phase or duplicate retry. Actual network delivery and coalition operation retry behavior remain unverified.

MODEL_MODE=stub explicitly enables B's StubModelClient in MerchantAgent for credential-free adapter tests; it must be unset for live verification. No fake credentials are used. Tests cover same-turn cache across real runtime restart, cancellation, expired deadline, trade-step identity and Relay naming only—not live model/Relay service behavior.

Both launch commands load repository-root .env; shell values win. Neon remains the agreed permanent reporting database. No external projection is implemented yet. See workers/sim/SETUP.md and src/engine/INTEGRATION_HANDOFF.md.

Actor-selection correction: factory defaults to terse and rejects AGENT_STORE=neon/do. Neon remains database/projection only. Root .env must use AGENT_STORE=terse; DURABLE_ACTORS_URL/PROJECT_ID aliases are accepted by A live adapter. No credential values were copied from screenshots.
