import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { initialInventoryValues } from '../../../packages/shared/src/starting-luck';
import { recordedViolations } from '../../../apps/web/src/components/run/recorded-violations';
import { buildLeaderboardRows } from '../../../apps/web/src/components/run/leaderboard-data';
import { initialEvidenceForRun } from '../../../apps/web/src/components/report/initial-evidence';
import { GET } from '../../../apps/web/src/app/api/runs/[id]/starting-values/route';
import type { Event } from '@simulization/shared';

const make = (type: Event['type'], flags: Event['flags'] = []): Event => ({runId:'count',id:'',seq:0,round:1,phase:'act',actorId:'a',targetId:'b',type,flags,ts:0});
const events = [make('trade_offer',['lie','broken_pact']),make('pact_break',['broken_pact']),make('steal',['theft','broken_pact']),make('pact_break',['broken_pact']),make('caught'),make('work')]
  .map((e,i)=>({...e,seq:i+1,id:`count-${i+1}`}));
assert.equal(recordedViolations(events,'a',0)!.count,0);
assert.equal(recordedViolations(events,'a',1)!.count,1);
assert.equal(recordedViolations(events,'a',2)!.count,1,'companion pact marker is not another act');
assert.deepEqual(recordedViolations(events,'a',6),{count:2,falseClaims:1,thefts:1,pactBreakingActions:2});
assert.equal(recordedViolations(events,'b',6)!.count,0,'victim not blamed');
assert.deepEqual(recordedViolations([...events,...events].reverse(),'a',6),recordedViolations(events,'a',6),'reconnect duplicates');
assert.equal(recordedViolations(events.filter(e=>e.seq!==2),'a',6),null,'gap cannot become zero violations');
assert.equal(recordedViolations([],'a',6),null,'missing prefix');
assert.equal(recordedViolations([events[0]!,{...events[0]!,type:'work'}],'a',1),null,'conflicting duplicates');
assert.equal(recordedViolations([{...events[1]!,seq:1,id:'count-1'}],'a',1),null,'unmatched pact marker');

const agents=[{id:'a',name:'Alpha',company:'A'},{id:'b',name:'Beta',company:'B'}];
const initial={runId:'count',phase:'initial' as const,source:'persisted test fixture',expectedGoods:{a:1,b:1},inventories:{a:[{goodId:'a1',trueValue:21}],b:[{goodId:'b1',trueValue:9}]}};
const values=initialInventoryValues('count',agents,initial).values;
assert.deepEqual(values,{a:21,b:9});
assert.equal(initialInventoryValues('other',agents,initial).values,null);
assert.equal(initialInventoryValues('count',agents,undefined).values,null);
assert.equal(initialInventoryValues('count',[agents[0]!],initial).values,null);
assert.equal(initialInventoryValues('count',agents,{...initial,inventories:{...initial.inventories,b:[{goodId:'a1',trueValue:9}]}}).values,null);
assert.deepEqual(buildLeaderboardRows(agents,events,1,null,values,'luck').map(r=>r.agent.id),['b','a']);
assert.deepEqual(buildLeaderboardRows(agents,events,3,null,values,'violations').map(r=>r.agent.id),['a','b']);
assert(buildLeaderboardRows(agents,events,1,null,{a:21}).every(r=>r.startingValue===null));
assert.deepEqual(buildLeaderboardRows(agents,events,0,null,values).map(r=>r.startingValue).sort(),[21,9].sort(),'initial values available at cursor zero');

const dir=new URL('../../../apps/web/public/runs/',import.meta.url);
let recordings=0;
for (const file of await readdir(dir)) {
  if (file==='index.json' || !file.endsWith('.json')) continue;
  const recording=JSON.parse(await readFile(new URL(file,dir),'utf8'));
  for (const agent of recording.run.agents) for (const cursor of [0,1,Math.floor(recording.events.length/2),recording.events.length]) {
    const prefix:Event[]=recording.events.filter((e:Event)=>e.seq<=cursor);
    const result=recordedViolations(recording.events,agent.id,cursor);
    assert(result,`${file} ${agent.id} ${cursor}`);
    assert.equal(result.count,prefix.filter(e=>e.actorId===agent.id && ((e.type==='trade_offer'&&e.flags.includes('lie'))||e.type==='steal')).length);
    assert.deepEqual(result,recordedViolations(prefix,agent.id,null));
  }
  recordings++;
}
const knownId='1e5c714e-e4bc-4d1d-aeb1-ff1eea922f94';
const evidence=initialEvidenceForRun(knownId,{});
assert(evidence);
const recovered=initialInventoryValues(knownId,Object.keys(evidence.inventories).map(id=>({id})),evidence);
assert.equal(Object.keys(recovered.values!).length,18);
assert.equal(initialEvidenceForRun('78deca44-65c6-47d7-8992-a959fcfededa',{}),undefined);

const saved=process.env.DATABASE_URL; delete process.env.DATABASE_URL;
try {
  const missing=await GET(new Request('http://localhost'),{params:Promise.resolve({id:'missing'})});
  assert.equal(((await missing.json()) as {values:null}).values,null);
  assert.equal((await GET(new Request('http://localhost'),{params:Promise.resolve({id:'bad/id'})})).status,400);
} finally {if(saved!==undefined)process.env.DATABASE_URL=saved;}
console.log(`PASS luck leaderboard: ${recordings} recordings; replay prefixes, unique violations/pact dedup, victims, reconnects, gaps, sorting, verified initial values and read-only API no-data. No model calls.`);
