// Proves Terse Durable Actors persistence with a REAL runtime (no mocks):
//   1. @Persisted state survives runtime stop/start
//   2. db.transaction rolls back @Persisted + SQL writes on throw
// Run: <bun> scripts/terse-probe.ts   (from workers/sim; first run downloads the runtime binary)
import { createActorTransport } from 'durable-actors/backend';
import { startLocalActors, type LocalActorRuntime } from 'durable-actors/dev';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { runStubGame } from '../src/engine/runner';

const project = fileURLToPath(new URL('..', import.meta.url));
const ACTOR = 'ProbeActor';
const ID = 'probe-1';

const connect = (rt: LocalActorRuntime) => {
  const { projectId, controlPlaneUrl, apiKey } = rt.connection;
  return createActorTransport({ projectId, controlPlaneUrl, apiKey });
};

async function main() {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'simulization-terse-probe-'));
  const options = { project, entrypoint: 'scripts/fixtures/terse-probe-actors.ts', dataDir, projectId: 'simulization-probe', quiet: process.env.PROBE_VERBOSE !== '1' };
  let rt: LocalActorRuntime | undefined;
  const call = async (c: ReturnType<typeof connect>, method: string, ...args: unknown[]) => c.invoke(ACTOR, ID, method, args);
  try {
    console.log(`[probe] data dir ${dataDir}`);
    rt = await startLocalActors(options);
    console.log(`[probe] runtime #1 up pid=${rt.connection.pid}`);
    let c = connect(rt);
    assert.deepEqual(await call(c, 'getMarker'), { marker: '', counter: 0 });

    await call(c, 'setMarker', 'pineapple');
    assert.deepEqual(await call(c, 'getMarker'), { marker: 'pineapple', counter: 1 });
    await call(c, 'committedTransaction', 'committed');
    assert.deepEqual(await call(c, 'getMarker'), { marker: 'committed', counter: 2 });
    assert.equal(await call(c, 'sqlValue'), 'committed');

    // Atomic rollback: both @Persisted fields and SQL row must revert.
    await assert.rejects(call(c, 'failedTransaction', 'should-not-survive'));
    assert.deepEqual(await call(c, 'getMarker'), { marker: 'committed', counter: 2 }, '@Persisted not rolled back');
    assert.equal(await call(c, 'sqlValue'), 'committed', 'SQL row not rolled back');
    console.log('[probe] PASS rollback: failed db.transaction reverted @Persisted fields and SQL row');

    const pid1 = rt.connection.pid;
    await rt.stop();
    rt = undefined;
    assert.throws(() => process.kill(pid1, 0), { code: 'ESRCH' }, 'runtime #1 still alive');
    console.log('[probe] runtime #1 stopped (process gone)');

    rt = await startLocalActors(options);
    console.log(`[probe] runtime #2 up pid=${rt.connection.pid}`);
    assert.notEqual(rt.connection.pid, pid1);
    c = connect(rt);
    assert.deepEqual(await call(c, 'getMarker'), { marker: 'committed', counter: 2 }, '@Persisted lost across restart');
    assert.equal(await call(c, 'sqlValue'), 'committed', 'SQL row lost across restart');
    console.log('[probe] PASS restart: @Persisted state + SQL row survived a real runtime stop/start');
    await rt.stop();
    rt = undefined;
    console.log('[probe] runtime #2 stopped');

    await runPersistenceScenario();
    console.log('[probe] PASS');
  } finally {
    await rt?.stop().catch((e) => console.error('[probe] stop failed', e));
    await rm(dataDir, { recursive: true, force: true });
  }
}

/** RunPersistence on Terse SQLite, in a real actor, across restart(s), compared to an in-process reference game. */
async function runPersistenceScenario() {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'simulization-terse-run-'));
  const options = { project, entrypoint: 'scripts/fixtures/terse-probe-actors.ts', dataDir, projectId: 'simulization-probe-run', quiet: process.env.PROBE_VERBOSE !== '1' };
  const RUN = 'RunProbeActor', RID = 'run-1';
  let rt: LocalActorRuntime | undefined;
  const call = async (c: ReturnType<typeof connect>, method: string, ...args: unknown[]) => c.invoke(RUN, RID, method, args) as Promise<any>;
  const runOpts = { runId: 'probe-run', seed: 42, condition: 'LABELED' as const, agentCount: 18, epoch: 0 };
  try {
    const reference = await runStubGame(runOpts); // pure, in this process
    rt = await startLocalActors(options);
    let c = connect(rt);
    assert.deepEqual(await call(c, 'init', runOpts.runId, runOpts.seed, runOpts.agentCount), { seq: 0 });
    assert.deepEqual(await call(c, 'init', runOpts.runId, runOpts.seed, runOpts.agentCount), { seq: 0 }, 'initialize not idempotent');

    // duplicate commit is a no-op; failed transaction rolls the checkpoint back
    assert.equal(await call(c, 'initializeRollbackRetry'),0);
    console.log('[probe] PASS checkpoint initialization rollback/retry with same storage adapter');
    const twice = await call(c, 'stepTwice');
    assert.equal(twice.first, false); assert.equal(twice.second, true);
    assert.equal(twice.seqAfter, twice.eventsAfter, 'seq must equal events stored');
    const rb = await call(c, 'commitThenThrow');
    assert.equal(rb.after, rb.before, 'checkpoint advanced despite transaction rollback');
    assert.equal(await call(c, 'flagValue'), 'new');
    console.log(`[probe] PASS duplicate no-op (seq ${twice.seqAfter}) and transactional rollback of a checkpoint commit`);

    const rejects = await call(c, 'rejects');
    assert.deepEqual(rejects, { stale: 'stale', seqGap: 'invalid', badEventSeq: 'invalid', initSeqNonZero: 'invalid', mismatch: 'mismatch', streamNotFromOne: 'corrupt', stateSeqMismatch: 'corrupt', checkpointSeqAfter: String(twice.seqAfter) });
    console.log('[probe] PASS rejects bad commits/initial seq/tampered snapshots; checkpoint unchanged');

    // 5 phases then a hard restart mid-game
    for (let i = 0; i < 5; i++) await call(c, 'step');
    const beforeRestart: string = await call(c, 'dump');
    const seqAtRestart = JSON.parse(beforeRestart).state.seq;
    await rt.stop(); rt = undefined;
    rt = await startLocalActors(options);
    c = connect(rt);
    assert.equal(await call(c, 'dump'), beforeRestart, 'checkpoint differs after restart');
    console.log(`[probe] PASS restart mid-game: checkpoint (seq ${seqAtRestart}) byte-identical after runtime stop/start`);

    let last: any;
    for (let n = 0; n < 200; n++) { last = await call(c, 'step'); if (last.status !== 'running') break; }
    assert.equal(last.status, 'done');
    const finalDump: string = await call(c, 'dump');
    const cp = JSON.parse(finalDump);
    assert.deepEqual(cp.events, JSON.parse(JSON.stringify(reference.events)), 'persisted events differ from reference game');
    assert.deepEqual(cp.state, JSON.parse(JSON.stringify(reference.state)), 'persisted state differs from reference game');
    assert.equal(cp.events[0].seq, 1);
    assert.ok(cp.events.every((e: { seq: number; id: string }, i: number) => e.seq === i + 1 && e.id === `probe-run-${e.seq}`));
    console.log(`[probe] PASS 6-round 18-agent game resumed after restart == uninterrupted reference: ${cp.events.length} events, snapshot ${finalDump.length} bytes, ${cp.committedKeys.length} committed phases`);

    await rt.stop(); rt = undefined;
    rt = await startLocalActors(options);
    c = connect(rt);
    assert.equal(await call(c, 'dump'), finalDump, 'final checkpoint differs after second restart');
    console.log('[probe] PASS final checkpoint byte-identical after another restart');
  } finally {
    await rt?.stop().catch((e) => console.error('[probe] stop failed', e));
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error('[probe] FAIL', e); process.exit(1); });
