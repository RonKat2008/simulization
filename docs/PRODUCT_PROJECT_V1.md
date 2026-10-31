# Product project four-turn-v1

Optional feature integrated on follow-through with Starting Luck evidence and hosted launch guard. Config name is
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
or privileged observer views. The existing inspector renders this compactly, bounded by the replay cursor.

Events use the existing contiguous `${runId}-${seq}` IDs and deterministic `epoch+seq`
timestamps. Merchants resolve in sorted ID order. Reset precedes the interrupting
ACT event; target switch emits reset then progress; sale emits seller reset before
buyer trade_accept. Completion replaces the fourth progress event (one event).
Invalid batches discard candidate events before fallback reset/pass emission.

## Runtime integration and root handoff

Runtime accepts optional `product_project` with only `off | four-turn-v1` permitted.
API registration/start, directory conflict checks, World start/conflict/status,
checkpoint JSON, recovery bootstrap and Neon config preserve the version.
Omission reads as off; disabled engine state and prompts remain unchanged.
Recovery now also forwards existing wealth_visibility, label_mode and monitoring.
Trusted `input.self.productProject?.version` selects the prompt and model output
schema in takeTurn. Only enabled turns advertise improve; observer product event
names never appear as agent actions. No liveAdapter change is needed: its Relay
allowlist already excludes project events, and observations stay self-only.

SQL storage uses existing `ground_truth` JSONB, without migration:
`{__productProjectV1: event.productProject, groundTruth: event.groundTruth ?? null}`
for project payloads. Legacy events keep their original ground_truth representation.
`apps/web/src/mastra/db.ts:rowToEvent` unwraps this envelope before EventSchema parse;
API replay and analysis share that reader. Raw checkpoints/WebSockets already use
public EventSchema. Any additional direct SQL reader must use rowToEvent as well.

Root/Starting Luck report grouping contract: normalize missing product_project to
`off`; preserve exact version strings, never coerce to boolean or pool enabled with
disabled. Add product_project to every existing comparison/synthesis/gallery key:
condition × wealth_visibility × mode × label_mode × monitoring × product_project.
Matched LABELED/BLIND pairs must share product_project as well as seed, roster/models
and the other existing settings; condition is the comparison axis. Default headline
pairs require product_project=off in addition to all current default restrictions.
Keep future/unknown values separate or reject them, never silently treat them as off.
No report, metric, launch/viewer UI or shared index files were edited here.

Compact privileged-observer fold contract: consume committed events in ascending
seq, deduplicate by runId+seq (or id); keep per actor `{completed:false,progress:null}`.
product_progress sets progress to `{goodId,turns,lastRound:event.round}`;
product_reset clears progress; product_complete clears progress and permanently
sets completed=true. Only these three types change project display state. Completion
turns=4 is terminal, not another progress event. Do not infer payout from progress;
completion qualityGain is authoritative, including zero. Reset/switch ordering is
already encoded in seq. Rebuild from the start when seeking backwards; repeated
poll/WebSocket events must not increment counters. Keep goods/quality/progress out
of other-agent inputs and Relay. Launch, observer UI and report grouping are integrated below; metric v2 is unchanged.

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

On the original engine-only checkout, full `pnpm --filter sim typecheck` was blocked by absent dependency
links for out-of-scope actor/web imports (`durable-actors`, `zod`, `zustand`, shared).
Focused checks passed. Bun is unavailable here; SQLite recovery uses Node instead.
This verifies the real storage adapter on SQLite, not the running Terse actor's
transaction/alarm lifecycle; root retains runtime integration/final verification.

## Runtime local verification (integrated checkout)

Focused scripts: `product-project-runtime.ts` (API and actor entrypoint isolation,
registration conflicts, defaults, historical status, trusted prompt/output schema),
`product-project-projection.ts` (real Neon client with intercepted fetch, all three
project event types, exact reader roundtrip, stable retry and malformed rejection).
`product-project-recovery.ts` additionally verifies all immutable settings survive
reload, and duplicated interruption commits emit exactly one reset.
Actor entrypoint tests replace SDK/storage transport and scheduler; real checkpoint
logic is used. SQLite tests exercise the actual adapter and transactional rollback.
No actual Terse actor lifecycle or real Neon SQL execution is verified. Bun is absent.
No model/Relay requests, actor bootstrap, external writes or provisioning occurred.

Integrated validation passed: full `pnpm typecheck` (shared, agents, web, sim, actors);
product-project-contract, product-project-recovery, product-project-runtime,
product-project-projection; baseline smoke, projection-smoke, monitoring-smoke
(original prompt SHA-256), and label-mode-smoke. Dependencies installed using the
existing frozen lockfile; no dependency or lockfile changes.


## Follow-through integration

The existing local launch form has an advanced off / four-turn-v1 option (default
and omitted payload remain off). Both halves of a requested pair receive the same
version. The existing hosted policy still hides the form and rejects launch before
body parsing or actor transport; no hosted-policy changes were made.

The selected-agent inspector shows idle, turns/4 or completed with authoritative
quality gain. Its privileged fold sorts and deduplicates committed events, rebuilds
through the replay cursor, clears progress on reset and never clears completion.
No panel, agent observations or Relay payloads were added by the UI integration.

Report loading quotas, selection, comparison groups, gallery pairs, synthesis
aggregates and hierarchy strata retain exact project versions. Missing means off;
unknown explicit versions remain separate. The experiment headline's existing
settings-key gate excludes enabled and unknown projects. The legacy hierarchy
visibility summary covers off only; visibilityByProject contains each separate
version's comparison. Initial-inventory evidence is preserved unchanged alongside
project metadata through commits, SQLite reloads and Neon projection.

Verification on the integrated checkout: full pnpm typecheck; product-project
contract, recovery, runtime, projection and web integration scripts; initial-evidence,
starting-luck and hosted-launch contracts; smoke, projection-smoke, monitoring-smoke
and label-mode-smoke. Web integration command:
`pnpm --filter sim exec tsx ../../apps/web/scripts/product-project-integration.ts`.
Tests cover four consecutive ACTs, reset/restart, forced skip, sale/return, deadline,
quality and completion caps, duplicate commits, rollback and backward replay seek.
Projection uses intercepted transport; recovery uses in-memory SQLite. No real SQL
service, model, Relay, provisioning, deployment or paid run was used. Rendered UI
and the real Terse alarm lifecycle were not exercised in this integration.

## Root acceptance checks

Independent read-only review confirmed engine and privacy rules and found a theft
metric event-coverage defect. `ACT_TURN_TYPES` now includes product_progress and
product_complete, never product_reset. The existing formula is unchanged: one
improvement and one theft are two ACT turns, so theft frequency is 1/2. Regression
covers progress, completion, reset plus pass, and unchanged work behavior.
Project activity now has plain recorded-action copy; missing quality gain is
reported as not recorded rather than invented as zero.

Actual pinned Terse + Next.js lifecycle passed with
`SIM_TEST_PRODUCT_PROJECT=four-turn-v1 PATH=/tmp/simulization-bun/node_modules/.bin:$PATH pnpm --filter sim smoke:next`:
setting retained across startup/restart, conflicting idempotency retry rejected,
unattended resume with no status request, six stub rounds, 266 ordered events and
144 decision turns. This verifies the enabled setting through real actors, not
model choice of improve; completion itself is covered by deterministic rule and
SQLite recovery tests. External credentials are blanked by the harness. No paid
model, Relay or real Neon execution is claimed.
