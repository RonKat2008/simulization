# Track A / B integration contract

Based on origin/main 173303c. WorldActor runs from workers/sim/src/actors.ts; B's real MerchantAgent and ExperimentRunner run from actors/src/actors.ts. Both use Terse 0.14.6. The obsolete Cloudflare store and placeholder AgentActor are removed; no fallback exists.

Shared AgentStore.takeTurn arguments: (runId, agentId, input, signal?, requestId?, deadline?). B's fourth AbortSignal remains compatible; A supplies stable fifth requestId and sixth epoch-ms deadline. All optional additions are integration changes. TerseAgentStore forwards the deadline and request ID. Same turn retries keep identity; offers/responses have distinct keys. MerchantAgent atomically caches the completed output with state and replays it after restart. Relay names preserve opaque merchant-NN IDs. These bounded fixes affect B's integration files, not its gateway/Relay provider choice.

A uses TerseAgentStore + RunRelay in world/liveAdapter.ts. A new manually stepped WorldActor can call enableLive(), which requires gateway/Relay keys and MERCHANT_ACTORS_URL. No live-mode stub fallback. Validated messages/coalition events are delivered after commit. deliveredSeq persists only after successful delivery; event ID is message idempotency key. Pending events flush before the next phase or duplicate retry. Actual network delivery and coalition operation retry behavior remain unverified.

MODEL_MODE=stub explicitly enables B's StubModelClient in MerchantAgent for credential-free adapter tests; it must be unset for live verification. No fake credentials are used. Tests cover same-turn cache across real runtime restart, cancellation, expired deadline, trade-step identity and Relay naming only—not live model/Relay service behavior.

Both launch commands load repository-root .env; shell values win. Neon remains the agreed permanent reporting database. No external projection is implemented yet. See workers/sim/SETUP.md and src/engine/INTEGRATION_HANDOFF.md.

Actor-selection correction: factory defaults to terse and rejects AGENT_STORE=neon/do. Neon remains database/projection only. Root .env must use AGENT_STORE=terse; DURABLE_ACTORS_URL/PROJECT_ID aliases are accepted by A live adapter. No credential values were copied from screenshots.
