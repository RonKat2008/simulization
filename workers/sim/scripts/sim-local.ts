import { runStubGame } from '../src/engine/runner';
const result = await runStubGame({runId:'local-stub',seed:42,condition:'BLIND',agentCount:6});
console.log(JSON.stringify({mode:'deterministic-stub',status:result.state.status,round:result.state.round,events:result.events.length,finalScores:result.state.finalScores},null,2));
