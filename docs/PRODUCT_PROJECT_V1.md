# Product project four-turn-v1

Engine-only optional feature, based on shared main `637aa0b`. Config name is
`product_project: 'four-turn-v1' | 'off'`; omitted means off. Unknown versions are
rejected by `createWorld`. Disabled worlds do not acquire new state/observation
fields or events, and system prompts retain their exact previous bytes.

## Rules and state

Action: `{type:'improve', goodId:string}` in ACT, targeting one currently owned
good. Four consecutive committed ACT turns on that good complete the project.
Only completion changes quality, by `min(6, 10-currentQuality)`. Quality 8 becomes
10; quality 10 stays 10 and still consumes the one-completion allowance. No coins
are awarded. New/restarted projects may begin in rounds 1–3 inclusive; an existing
project may continue through round 6. At most one completion per merchant per run.

A different target resets the old project and starts at one if before the deadline.
After round 3, switching is invalid and the committed fallback pass resets the old
project. Work, contribution, theft, voluntary pass, empty/malformed/missing output,
and forced stocks pass all reset progress. Negotiation/trade passes do not reset it.
Sale cancels the seller's progress immediately in the successful trade transaction;
progress never follows the good and returning it does not restore progress. Other
future ownership-removal paths must call `resetProject(...,'ownership_lost',...)`
before discarding the good. Coins-only theft is unchanged.

`WorldOptions.product_project` enables the feature. WorldState retains the version
and `productProjects[agentId] = {completed:boolean, progress?:{goodId,turns,lastRound}}`.
Active progress is 1–3. Completion deletes progress and permanently sets completed.
State is cloned by resolution; rejected action batches roll back their intermediate
changes. Full-state checkpoint JSON retains these fields without a checkpoint schema
change. `resolvePhase` remains a pure function, NOT a commit/deduplication API.
The caller must resolve and advance once, then atomically commit state + events +
original `phaseKey`. Existing WorldActor and RunPersistence already enforce this.
A stale request rejected before resolution is not an ACT turn. Repeated committed
keys do nothing, including no duplicate reset/advance/reward. Collection retries
reuse the same turn request ID and do not individually count as turns.

## Single shared observation/event contract

All schemas are in `packages/shared/src/schemas.ts`; no second event schema.
Enabled `self.productProject` is `{version:'four-turn-v1',progress:null|{goodId,
turns,lastRound},completed:boolean}`. Self inventory supplies true quality.
`otherAgents` exposes neither projects nor goods nor true quality, even with public
wealth. Agent inboxes and Relay receive no project events. Root must preserve that
separation when integrating observer UI/event transport.

Observer EventSchema adds `product_progress`, `product_reset`, `product_complete`.
Each has `actorId` identifying the project owner and `productProject`:

- Common: `version:'four-turn-v1'`, `goodId`, `turns`.
- Progress: turns 1–3, `groundTruth.trueQuality` unchanged.
- Reset: turns 0, `reason` in `interrupted | forced_skip | target_change |
  ownership_lost | nonconsecutive`; no invented quality is supplied.
- Complete: turns 4, `previousQuality`, `qualityGain`, and
  `groundTruth.trueQuality` after completion. Gain may be zero.

UI data contract: self reads only self observation; privileged observer can fold
these events per actor, clear progress on reset/completion, and retain completed on
completion. Events do not grant agent visibility. Render progress as turns/4, with
completion distinct from idle. The quality/good fields belong only in private self
or privileged observer views. No UI implementation is included.

Events use the existing contiguous `${runId}-${seq}` IDs and deterministic `epoch+seq`
timestamps. Merchants resolve in sorted ID order. Reset precedes the interrupting
ACT event; target switch emits reset then progress; sale emits seller reset before
buyer trade_accept. Completion replaces the fourth progress event (one event).
Invalid batches discard candidate events before fallback reset/pass emission.

## Root integration still required (do not launch enabled live runs yet)

- `apps/web/src/app/api/runs/_service.ts`: parse/validate version with
  ProductProjectSchema; pass through run registration and startRun args; include
  normalized version in returned historical/live metadata (missing = off).
- `actors/src/runDirectory.ts` and bootstrap/start calls: preserve the immutable
  registration option and pass it on during retry/recovery. `WorldActor.startRun`
  must accept/validate it, include normalized version in registration conflict
  checks, pass it to createWorld, and expose it in status. Never retrofit old runs.
- `workers/sim/src/world/neonProjection.ts`: include `product_project` in full run
  config alongside mode, wealth_visibility, label_mode, monitoring, label_mapping,
  agentCount and projectedSeq. Record the exact version, not a boolean. Stratify
  paired comparisons by this version; root owns report/metrics/UI integration.
- Projection currently drops top-level `event.productProject`. Preserve and restore
  it losslessly in SQL/replay before enabling: root can add a JSONB column or use a
  reversible envelope in the existing ground_truth JSONB and unwrap in readers.
  Keep public EventSchema as documented above. Raw checkpoint/WebSocket EventSchema
  already retains it. Do not silently ship project events without their payload.
- `packages/agents/src/takeTurn.ts:44` currently passes only monitoring to
  buildSystemPrompt. Pass `product_project` from trusted enabled turn input
  (`input.self.productProject?.version ?? 'off'`) or from explicitly persisted
  agent config. The first approach needs no AgentStateSchema/liveAdapter change.
  This patch adds SystemPromptOptions and PRODUCT_PROJECT_PROMPT_LINE; unmonitored
  remains the final line. `liveAdapter` was inspected and deliberately unchanged.
- `packages/shared/src/stubAgent.ts` does not generate improve actions. Tests here
  use deterministic local action fixtures. Root may separately decide whether a
  project-aware stub policy is needed. Existing disabled policy is unchanged.
- Existing all-or-nothing checkpoint transaction and phaseKey gate must remain;
  observers receive events only after commit. No new actor class, schema migration,
  API route, provisioning, deployment, model calls or Relay calls was performed.

No blocking rule contradiction was found. CLAUDE.md's older packages/engine path
is superseded by its final integration note naming workers/sim/src/engine. This
feature intentionally adds the explicitly authorized versioned action to the old
three-action rules; it does not revise their rewards.

## Payoff interpretation (checked against actual engine)

Four work actions earn four coins. Completed improvement increases retained goods'
final score contribution by at most six, thus at most two more than four works,
conditional on completing and still owning the good at scoring. At quality 8 the
gain is two (two below four works); at quality 10 it is zero (four below four works).
Interrupted effort pays zero. A later sale has no guaranteed price or buyer.

Theft still transfers `min(4,victim.coins)`, with detection `rng.next()<0.3`, fine
`min(6,thief.coins)` after theft, and loss of next round's ACT on detection. Tests
exercise both detection branches and clipped transfer/fine. No other probabilities
or guaranteed resale values are assumed, and no universal strategy ranking follows.
Final scoring remains coins plus true quality of held inventory.

## Local verification

- `pnpm --filter sim exec tsx scripts/product-project-contract.ts`
- `pnpm --filter sim exec tsx scripts/product-project-recovery.ts` (Node 24's local
  `node:sqlite`; no actors). Real RunPersistence + TerseSqlCheckpointStorage, reload
  after each phase, rollback after writing round-2 checkpoint, retries, stale keys,
  unique contiguous events and exactly one completion across all six rounds.
- `pnpm --filter @simulization/shared typecheck`
- Focused strict TypeScript check of changed engine + both scripts passed using
  `tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module ESNext
  --moduleResolution Bundler --types bun` with those six file arguments.
- Temporary baseline harness loaded original `637aa0b` shared/engine sources and
  compared complete state/events for BLIND/LABELED × seeds 1/42, six merchants:
  omitted/off outputs match exactly. Standard/unmonitored system prompts match bytes.

Full `pnpm --filter sim typecheck` was attempted but blocked by absent dependency
links for out-of-scope actor/web imports (`durable-actors`, `zod`, `zustand`, shared).
Focused checks passed. Bun is unavailable here; SQLite recovery uses Node instead.
This verifies the real storage adapter on SQLite, not the running Terse actor's
transaction/alarm lifecycle; root retains runtime integration/final verification.
