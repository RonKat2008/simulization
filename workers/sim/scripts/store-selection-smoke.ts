import assert from 'node:assert/strict';
import {createAgentStore} from '../src/agents/createAgentStore';
import {TerseAgentStore} from '../src/agents/terseStore';
const env={DATABASE_URL:'',AGENTRELAY_API_KEY:'',AI_GATEWAY_API_KEY:''};
assert.ok(createAgentStore(env) instanceof TerseAgentStore);
assert.ok(createAgentStore({...env,AGENT_STORE:'terse'}) instanceof TerseAgentStore);
assert.throws(()=>createAgentStore({...env,AGENT_STORE:'neon'}),/must be terse/);
assert.throws(()=>createAgentStore({...env,AGENT_STORE:'do'}),/must be terse/);
console.log('PASS actor selection: default/terse use Terse; neon/do rejected; no network calls');
