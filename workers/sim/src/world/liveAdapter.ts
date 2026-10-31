import { COMPANIES, type AgentStore, type Event } from '@simulization/shared';
import { RunRelay, RelayClient, attachRelayTokens } from '@simulization/agents';
import { DurableActorsClient, TerseAgentStore } from '../agents/terseStore';
import type { WorldState } from '../engine/types';
export function liveServices() {
  if (!process.env.AGENTRELAY_API_KEY || !process.env.AI_GATEWAY_API_KEY) throw new Error('Live mode requires gateway and Relay credentials; no stub fallback');
  if(process.env.AGENT_STORE && process.env.AGENT_STORE !== 'terse') throw new Error('AGENT_STORE must be terse for live actors');
  const url=process.env.MERCHANT_ACTORS_URL ?? process.env.DURABLE_ACTORS_URL;
  if(!url) throw new Error('MERCHANT_ACTORS_URL must point to Track B MerchantAgent runtime');
  const store=new TerseAgentStore(new DurableActorsClient({baseUrl:url,projectId:process.env.MERCHANT_PROJECT_ID??process.env.DURABLE_ACTORS_PROJECT_ID??'local',secret:process.env.DURABLE_ACTORS_SECRET}));
  const relay=new RunRelay(new RelayClient(process.env.AGENTRELAY_API_KEY,process.env.AGENTRELAY_BASE_URL));
  return {store,relay};
}
export async function initializeLive(s:WorldState):Promise<Record<string,string>> {
  const {store,relay}=liveServices();
  for(const a of Object.values(s.agents)) {
    const c=COMPANIES.find(c=>c.id===a.company)!;
    try {await store.load(s.runId,a.id);} catch(error) {
      // Only initialize an explicitly uninitialized actor, never mask network failures.
      if(!String(error).includes('not initialized')) throw error;
      await store.init(s.runId,a.id,{name:a.name,company:a.company,provider:c.provider,model:c.model,memory:'',inboxCursor:null});
    }
  }
  const tokens=await relay.setupRun(s.runId,Object.keys(s.agents));
  await attachRelayTokens(store,s.runId,tokens);
  return tokens;
}
export async function deliverLiveEvent(event:Event,tokens:Record<string,string>):Promise<void> {
  const {relay}=liveServices();const token=tokens[event.actorId];
  if(!token) return;
  if(event.type==='message') await relay.deliverMessage(event.runId,token,{channel:event.channel!,to:event.targetId,text:event.text!},event.id);
  else if(event.type==='coalition_create') await relay.createCoalition(event.runId,event.channel!,token);
  else if(event.type==='coalition_join') await relay.joinCoalition(event.runId,event.channel!,token);
  else if(event.type==='coalition_leave') await relay.leaveCoalition(event.runId,event.channel!,token);
}
export function liveStore():Pick<AgentStore,'takeTurn'> {return liveServices().store;}
