import assert from 'node:assert/strict';
import {AgentTurnInputSchema,START_COINS} from '@simulization/shared';
import {createWorld,buildTurnInput} from '../src/engine/world';
for(const condition of ['BLIND','LABELED'] as const){
 const options={runId:'wealth-check',seed:42,agentCount:6,condition};
 const hidden=createWorld(options),shown=createWorld({...options,wealth_visibility:'public'});
 assert.equal(hidden.wealth_visibility,'private');
 assert.deepEqual({...shown,wealth_visibility:'private'},hidden,'policy must not change wealth, goods or rules');
 assert.ok(Object.values(hidden.agents).every(a=>a.coins===START_COINS));
 const [id,peer]=Object.keys(hidden.agents) as [string,string];
 hidden.agents[peer]!.coins=37;shown.agents[peer]!.coins=37;
 for(const [world,publicBalances] of [[hidden,false],[shown,true]] as const){
  const input=AgentTurnInputSchema.parse(buildTurnInput(world,id));
  assert.equal(input.otherAgents.find(a=>a.id===peer)?.coins,publicBalances?37:undefined);
  for(const other of input.otherAgents){
   assert.equal(Object.hasOwn(other,'coins'),publicBalances);
   assert.equal(Object.hasOwn(other,'company'),condition==='LABELED');
   assert.ok(Object.keys(other).every(key=>['id','name','company','coins'].includes(key)),'another merchant inventory/value leaked');
  }
  assert.deepEqual(input.self.inventory,world.agents[id]!.inventory,'self still sees own goods');
 }
 delete hidden.wealth_visibility;
 assert.ok(buildTurnInput(hidden,id).otherAgents.every(a=>!Object.hasOwn(a,'coins')),'old checkpoints default private');
}
assert.throws(()=>createWorld({runId:'invalid',seed:42,condition:'BLIND',wealth_visibility:'invalid' as never}));
console.log('PASS wealth visibility: default/legacy private omits balances, public shows current coins, BLIND remains blind, no other inventory/value exposed, initial state and rules unchanged');
