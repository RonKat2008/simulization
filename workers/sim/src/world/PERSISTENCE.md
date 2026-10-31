# Run persistence (`persistence.ts`) — Terse Durable Actors

Durable checkpoint/recovery for one run (WorldActor). `persistence.ts` imports nothing from `durable-actors`;
it takes any async `{ get(key), put(key, value) }`, and ships an adapter over Terse actor SQLite.

## Proven (real runtime, no mocks) — `scripts/terse-probe.ts`
`PATH=/tmp/simulization-bun/node_modules/.bin:$PATH bun scripts/terse-probe.ts` (from `workers/sim`), ends with `[probe] PASS`.
Uses `startLocalActors` (`durable-actors/dev`) + `createActorTransport` (`durable-actors/backend`), a unique temp data dir,
and always stops the runtime in `finally`. It verifies:
1. `@Persisted` fields + SQL rows survive a real runtime stop/start (different pid, process confirmed gone).
2. `this.db.transaction` rolls back **both** `@Persisted` writes and SQL writes when the callback throws
   (the official guide is contradictory about `@Atomic`; **there is no `@Atomic` in 0.14.6** — use `db.transaction`).
3. `RunPersistence` over `createTerseCheckpointStorage(this.db)` inside a real actor: init idempotent; duplicate
   commit = no-op; a checkpoint commit inside a throwing `db.transaction` rolls back; bad/stale/gap commits and
   tampered snapshots are rejected; a full **6-round, 18-agent stub game restarted mid-game** (after 5 phases) is
   *deep-equal* to an uninterrupted in-process game (30 phases; event count depends on seed and current rule version), and the checkpoint is
   byte-identical after another restart.

## API
```ts
import { RunPersistence, createTerseCheckpointStorage } from './persistence';
const p = new RunPersistence(createTerseCheckpointStorage(this.db)); // inside an Actor method
await p.load();                                   // Checkpoint | undefined (integrity-checked)
await p.initialize(state);                        // state.seq must be 0; idempotent for the same run
await p.commit(phaseKey(before), after, events);  // { checkpoint, duplicate }
```
`Checkpoint = { state, events, committedKeys }`; returned objects are deep copies. Other backends: implement
`CheckpointStorage` (`TerseSqlCheckpointStorage` is the SQL one; `SqlDatabase` = the `exec` part of `ActorDatabase`).

## Storage
Table `run_checkpoint(key TEXT PRIMARY KEY, value TEXT NOT NULL)` (created lazily, `CREATE TABLE IF NOT EXISTS`).
One snapshot = **one row**, JSON text, written by a single `INSERT ... ON CONFLICT(key) DO UPDATE` statement.
A single SQLite statement is atomic: old snapshot or new snapshot, never partial. Whole-snapshot rewrite per commit
(tested at over 200 KB on the local runtime).

## Semantics
- `expectedKey = phaseKey(stateBeforeResolve)`. Commit order:
  1. key in `committedKeys` → `{ duplicate: true }`, existing checkpoint, **no write, payload ignored**.
  2. key ≠ `phaseKey(checkpoint.state)` or run not `running` → `PersistenceError('stale')`.
  3. Validate before writing: `state.runId`, `state.seq === prev.seq + events.length`, running state advances past
     `expectedKey`, events pass `EventSchema`, right `runId`, contiguous `seq` from `prev.seq + 1`, `id === runId-seq`
     → else `'invalid'`.
  4. Single `put`.
- **Event stream starts at seq 1** and `state.seq` always equals the number of stored events (= last seq):
  `initialize` rejects `state.seq !== 0` (`'invalid'`); `load` rejects a stored stream not starting at 1 or with
  `state.seq !== events.length` (`'corrupt'`). (Fixes the earlier review bug where a stream could start anywhere.)
- Recovery: `load()` after restart, resume from `checkpoint.state`. A commit whose ack/broadcast was lost is retried
  safely (duplicate no-op); re-broadcast with `events.filter(e => e.seq > after)`.
- Error codes: `uninitialized | stale | invalid | corrupt | mismatch` (`PersistenceError.code`).

## Terse integration rules learned from the probe
- **Every method on an `Actor` subclass must be `async`** (even private helpers; build fails with
  "actor method X must be async"). Put sync helpers at module level.
- Instance fields need `@Persisted`/`@Ephemeral`. `this.db` is only valid during an actor call: build
  `RunPersistence` inside the method (cheap) — don't create it in a field initializer.
- To commit the checkpoint atomically with other `@Persisted` fields, wrap in `await this.db.transaction(async () => {...})`;
  a throw rolls everything back (probe-verified). `exec` is synchronous; statements autocommit outside a transaction.
- Concurrency: one actor = serialized calls (do not use `@Interleave` on WorldActor). The in-instance queue in
  `RunPersistence` only matters if you hold one instance across overlapping awaits.
- Actor entrypoints may import workspace code (`../../src/engine/...`, `@simulization/shared`); the Terse build bundled them.

## Running the runtime locally
- `startLocalActors` downloads the runtime binary on first use to `~/.cache/durable-actors/0.14.6/<platform>/`
  (from GitHub releases, sha256-checked) unless `DURABLE_ACTORS_BINARY` is set.
- The runtime spawns **`bun` from PATH** to compile the entrypoint. Without a `bun` on PATH it fails with
  `run local actor build: No such file or directory` / "exited without readiness information". Export
  `PATH=/tmp/simulization-bun/node_modules/.bin:$PATH` (or install Bun globally).
- `quiet: true` hides runtime output; set `PROBE_VERBOSE=1` to see build errors.

## Limitations
- Whole-snapshot rewrite per commit (O(log size)); shard events into per-phase rows if runs grow a lot.
- Duplicate commits are not compared against stored events (assumes deterministic resolve from seed/state).
- Does not verify engine invariants beyond the above. No Neon projection (WorldActor's job).
- Proven against the local runtime only; not against a hosted Terse deployment.

Table existence is deliberately not cached: a failed transaction may roll back CREATE TABLE. The same adapter safely retries initialization after rollback. Product coverage is in `scripts/world-smoke.ts`; the standalone probe does not establish product correctness.




Recovery scope: the product bootstrap restores automatic runs from its durable registration index, with no status request. `smoke:unattended` verifies this and verifies stopped runs remain stopped. The raw SDK-only probe still reproduces lost alarms. Hosted recovery and hard-kill/power-loss durability are unverified. See `workers/sim/SETUP.md`.
