// No actors, model calls, credentials or remote DB. Real local SQLite plus intercepted Neon HTTP.
import assert from 'node:assert/strict';
import { neon, neonConfig } from '@neondatabase/serverless';
import { createWorld } from '../src/engine/world';
import { stepWorld } from '../src/engine/runner';
import { phaseKey } from '../src/engine/types';
import { CHECKPOINT_KEY, RunPersistence, createTerseCheckpointStorage, type SqlDatabase, type Checkpoint } from '../src/world/persistence';
import { projectCheckpoint } from '../src/world/neonProjection';

const sqliteModule = 'node:sqlite';
const { DatabaseSync } = await import(sqliteModule);
const sqlite = new DatabaseSync(':memory:');
const db: SqlDatabase = {
  exec(sql, ...args) {
    const statement = sqlite.prepare(sql);
    if (/^SELECT/i.test(sql)) return statement.all(...args);
    statement.run(...args);
    return [];
  },
};
const storage = createTerseCheckpointStorage(db);
const persistence = new RunPersistence(storage);
const state = createWorld({runId:'initial-evidence-contract',seed:42,condition:'BLIND',agentCount:6,epoch:0});
const original = structuredClone(state);
const first = await persistence.initialize(state);
assert.deepEqual(state, original, 'capture cannot change engine state');
assert.equal(first.initialInventory?.version, 'initial-inventory-v1');
assert.equal(first.initialInventory?.valuation, 'quality-as-value-v1');
assert.equal(first.events.length, 0);
assert.equal(Object.keys(first.initialInventory!.inventories).length, 6);
assert.equal(Object.values(first.initialInventory!.inventories).flat().length, 18);
const baseline = structuredClone(first.initialInventory);
for (const a of Object.values(state.agents)) assert.deepEqual(first.initialInventory!.inventories[a.id], a.inventory.map(g=>({goodId:g.goodId,trueValue:g.trueQuality})));
first.initialInventory!.inventories['merchant-01']![0]!.trueValue = 999;
assert.deepEqual((await persistence.load())!.initialInventory, baseline, 'returned data cannot mutate durable evidence');

const next = await stepWorld(state);
sqlite.exec('BEGIN');
await persistence.commit(phaseKey(state), next.state, next.events);
sqlite.exec('ROLLBACK');
assert.deepEqual((await persistence.load())!.initialInventory, baseline);
assert.equal((await persistence.load())!.state.seq, 0, 'transaction rollback restores checkpoint and evidence');
const committed = await persistence.commit(phaseKey(state), next.state, next.events);
assert.deepEqual(committed.checkpoint.initialInventory, baseline);
assert.deepEqual((await new RunPersistence(storage).load())!.initialInventory, baseline, 'fresh instance reload');
const duplicate = await persistence.commit(phaseKey(state), next.state, next.events);
assert.equal(duplicate.duplicate, true);
assert.deepEqual(duplicate.checkpoint.initialInventory, baseline);
const changed = structuredClone(next.state);
changed.agents['merchant-01']!.inventory = [];
assert.deepEqual((await persistence.initialize(changed)).initialInventory, baseline, 'initialize retry cannot replace allocation');

// Legacy checkpoints remain legacy, even when initialize is retried with regenerated state.
const raw = await storage.get<Record<string, unknown>>(CHECKPOINT_KEY);
const legacy = structuredClone(raw!); delete legacy.initialInventory;
await storage.put(CHECKPOINT_KEY, legacy);
assert.equal((await persistence.initialize(state)).initialInventory, undefined);
const after = await stepWorld(next.state);
assert.equal((await persistence.commit(phaseKey(next.state),after.state,after.events)).checkpoint.initialInventory, undefined);

for (const corrupt of [
  {...baseline, runId:'different'},
  {...baseline, version:'unknown'},
  {...baseline, source:'inferred from final holdings'},
  {...baseline, expectedGoods:{}},
  {...baseline, inventories:{...baseline!.inventories, extra:[]}},
]) {
  await storage.put(CHECKPOINT_KEY, {...raw,initialInventory:corrupt});
  await assert.rejects(persistence.load(), /corrupt/);
}
const badGoods = structuredClone(baseline!);
badGoods.inventories['merchant-02']![0]!.goodId = badGoods.inventories['merchant-01']![0]!.goodId;
await storage.put(CHECKPOINT_KEY,{...raw,initialInventory:badGoods});
await assert.rejects(persistence.load(), /corrupt/);
await storage.put(CHECKPOINT_KEY, raw);

const empty = new RunPersistence(createTerseCheckpointStorage(db,'empty_checkpoint'));
sqlite.exec('BEGIN'); await empty.initialize(state); sqlite.exec('ROLLBACK');
assert.equal(await empty.load(), undefined, 'failed initialization does not leave allocation metadata behind');
assert.deepEqual((await empty.initialize(state)).initialInventory, baseline);
const invalid = new RunPersistence(createTerseCheckpointStorage(db,'invalid_checkpoint'));
await assert.rejects(invalid.initialize({...state,round:2}), /pre-action/);
assert.equal(await invalid.load(),undefined);

const oldFetch = neonConfig.fetchFunction;
const requests:{queries:{query:string;params:string[]}[]}[]=[];
neonConfig.fetchFunction=async (_url:unknown, options:RequestInit)=>{
  requests.push(JSON.parse(String(options.body)));
  return Response.json({results:Array.from({length:3},()=>({fields:[],rows:[]}))});
};
try {
  const sql=neon('postgresql://fixture:fixture@example.invalid/fixture');
  const checkpoint=(await persistence.load())!;
  await projectCheckpoint(checkpoint,'deterministic-stub',sql);
  const config=requests[0]!.queries[0]!.params.map(p=>{try{return JSON.parse(p);}catch{return null;}}).find(p=>p?.initialInventory);
  assert.deepEqual(config.initialInventory,baseline);
  await projectCheckpoint(checkpoint,'deterministic-stub',sql);
  assert.deepEqual(requests[1],requests[0]);
  const {initialInventory:_,...legacyCheckpoint}=checkpoint;
  await projectCheckpoint(legacyCheckpoint,'deterministic-stub',sql);
  assert.equal(requests[2]!.queries[0]!.params.some(p=>typeof p === 'string' && p.includes('initialInventory')),false,'legacy projection must not overwrite prior metadata');
  await assert.rejects(projectCheckpoint({...checkpoint,initialInventory:badGoods} as Checkpoint,'deterministic-stub',sql),/initial inventory/);
  assert.equal(requests.length,3,'invalid evidence rejected before HTTP');
} finally { neonConfig.fetchFunction=oldFetch; sqlite.close(); }
console.log('PASS initial evidence: immutable capture, SQLite reload/rollback/retry, legacy absence, validation and atomic Neon projection metadata; no external calls.');
