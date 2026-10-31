// Read-only evidence check. Does not launch runs, generate reviews or send messages.
import assert from 'node:assert/strict';
import {createActorTransport} from 'durable-actors/backend';
import {EventSchema,ReviewSchema} from '@simulization/shared';
import {RelayClient,channelName} from '@simulization/agents';
import {loadProjectEnv} from './load-env';
loadProjectEnv();
const id=process.argv[2];assert.ok(id,'provide existing run ID');
const complete=process.argv.includes('--complete');
const base=process.env.WEB_URL??'http://localhost:3000';
const get=async(path:string)=>{const response=await fetch(base+path);assert.ok(response.ok);return response.json() as Promise<any>;};
const s=await get(`/api/runs/${id}`);
assert.equal(s.wealth_visibility,'public');assert.equal(s.mode,'live-model-relay');
const events=(await get(`/api/runs/${id}/events`)).map((e:unknown)=>EventSchema.parse(e));
events.forEach((e:any,i:number)=>{assert.equal(e.seq,i+1);assert.equal(e.id,`${id}-${i+1}`);});
const t=createActorTransport({controlPlaneUrl:process.env.DURABLE_ACTORS_URL!,projectId:process.env.DURABLE_ACTORS_PROJECT_ID??'local',apiKey:process.env.DURABLE_ACTORS_SECRET||undefined});
const receipts=await Promise.all(s.agents.map((a:any)=>t.invoke('MerchantAgent',`${id}.${a.id}`,'observationReceipt',[]) as Promise<any>));
assert.equal(receipts.length,18);
assert.ok(receipts.every(r=>r&&r.peers===17&&r.peersWithCoins===17&&!r.peerInventoryExposed&&r.modelMode==='gateway'));
assert.ok(receipts.some(r=>r.outputTokens>0&&!r.passReason),'no successful real model receipt');
const agent=await t.invoke('MerchantAgent',`${id}.${s.agents[0].id}`,'load',[]) as any;
const relay=new RelayClient(process.env.AGENTRELAY_API_KEY!,process.env.AGENTRELAY_BASE_URL);
const messages=await relay.channelMessages(agent.relayToken,channelName(id,'public'));
assert.ok(messages.some(m=>events.some((e:any)=>e.type==='message'&&e.channel==='public'&&e.text===m.text)),'no actual Relay message matched committed events');
if(complete){
 assert.equal(s.status,'done');assert.equal(events.length,s.seq);
 const report=await get(`/api/runs/${id}/report`);assert.equal(report.config.wealth_visibility,'public');assert.equal(report.config.mode,'live-model-relay');assert.ok(report.metrics);
 const review=ReviewSchema.parse(report.review);const ids=new Set(events.map((e:any)=>e.id));
 assert.ok(review.claims.every(c=>c.eventIds.length&&c.eventIds.every(x=>ids.has(x))));
 console.log(JSON.stringify({check:'PASS complete live run and persisted report',id,seq:s.seq,claims:review.claims.length,metricTurns:report.metrics.evalAwareness.total}));
}
console.log(JSON.stringify({check:'PASS live observations, real gateway output and actual Relay delivery',id,round:s.round,phase:s.phase,eventCount:events.length,receipts:receipts.length,successfulInitialModels:receipts.filter(r=>r.outputTokens>0&&!r.passReason).length,relayMessages:messages.length}));
