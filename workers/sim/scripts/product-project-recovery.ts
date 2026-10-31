// Local SQLite only: exercises the production checkpoint adapter without starting actors.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { RunPersistence, createTerseCheckpointStorage, type SqlDatabase } from '../src/world/persistence';
import { createWorld, advancePhase } from '../src/engine/world';
import { resolvePhase } from '../src/engine/rules';
import { phaseKey, type Turns } from '../src/engine/types';
import { createRng } from '@simulization/shared';

const db = new DatabaseSync(':memory:');
const sql: SqlDatabase = { exec<Row extends object>(statement: string, ...bindings: any[]): Row[] {
  return (/^\s*(SELECT|PRAGMA)/i.test(statement) ? db.prepare(statement).all(...bindings) : (db.prepare(statement).run(...bindings), [])) as Row[];
} };
const storage = createTerseCheckpointStorage(sql);
const reload = () => new RunPersistence(storage);
const initial = createWorld({runId:'recovery',seed:1,condition:'LABELED',agentCount:2,product_project:'four-turn-v1',wealth_visibility:'public',label_mode:'swapped',monitoring:'unmonitored'});
initial.agents['merchant-01']!.inventory[0]!.trueQuality=2;
await reload().initialize(initial);
const initialInventory=(await reload().load())!.initialInventory;
assert.ok(initialInventory);
let actCommits=0;
while ((await reload().load())!.state.status === 'running') {
  const cp=(await reload().load())!;
  for(const key of ['product_project','wealth_visibility','label_mode','monitoring'] as const)assert.equal(cp.state[key],initial[key]);
  assert.deepEqual(cp.initialInventory,initialInventory);
  const before=cp.state; const key=phaseKey(before);
  const turns: Turns = before.phase === 'act' ? {'merchant-01':{private_plan:'',actions:[{type:'improve' as const,goodId:'good-1-1'}],memory_update:''},'merchant-02':{private_plan:'',actions:before.round===1?[{type:'improve' as const,goodId:'good-2-1'}]:[{type:'pass' as const}],memory_update:''}} : {};
  const resolved=resolvePhase(before,turns,createRng(1));const after=advancePhase(resolved.state);
  if (before.phase==='act' && before.round===2) {
    db.exec('BEGIN');
    await reload().commit(key,after,resolved.events);
    assert.equal((await reload().load())!.state.productProjects!['merchant-01']!.progress!.turns,2);
    // Simulate caller failure after the checkpoint write, inside its transaction.
    try { throw new Error('injected transaction failure'); } catch { db.exec('ROLLBACK'); }
    assert.deepEqual(await reload().load(),cp,'rollback retains previous phase/progress/events');
  }
  const committed=await reload().commit(key,after,resolved.events);
  assert.equal(committed.duplicate,false);
  assert.deepEqual((await reload().commit(key,after,resolved.events)).checkpoint,committed.checkpoint);
  assert.equal((await reload().commit(key,after,resolved.events)).duplicate,true);
  await assert.rejects(()=>reload().commit('wrong-phase-key',after,resolved.events),/stale/);
  assert.deepEqual(await reload().load(),committed.checkpoint,'rejected precommit request has no effect');
  if(before.phase==='act') {
    actCommits++;
    const a=(await reload().load())!.state;
    assert.equal(a.agents['merchant-01']!.inventory[0]!.trueQuality,actCommits>=4?8:2);
    assert.equal(a.productProjects!['merchant-01']!.completed,actCommits>=4);
    if(actCommits<4)assert.equal(a.productProjects!['merchant-01']!.progress!.turns,actCommits);
  }
}
const cp=(await reload().load())!;
assert.equal(cp.events.filter(e=>e.type==='product_complete').length,1);
assert.equal(cp.events.filter(e=>e.type==='product_progress').length,4);
assert.equal(cp.events.filter(e=>e.type==='product_reset').length,1,'duplicate interrupted ACT does not reset twice');
assert.equal(new Set(cp.events.map(e=>e.id)).size,cp.events.length);
assert.equal(new Set(cp.committedKeys).size,30);
db.close();
console.log('product-project-recovery: PASS (real RunPersistence + TerseSqlCheckpointStorage, local SQLite rollback/reload/duplicates)');
