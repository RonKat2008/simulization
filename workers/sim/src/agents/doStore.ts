// Owner: Person B. AGENT_STORE=do: one AgentActor Durable Object per agent behind the AgentStore interface.
import type { AgentState, AgentStore, AgentTurnInput, AgentTurnOutput } from "@simulization/shared";
import { signalDeadline } from "@simulization/agents";
import type { AgentActor } from "./AgentActor";

export class DoAgentStore implements AgentStore {
  constructor(private readonly ns: DurableObjectNamespace<AgentActor>) {}

  private stub(runId: string, agentId: string) {
    return this.ns.get(this.ns.idFromName(`${runId}:${agentId}`));
  }

  async init(runId: string, agentId: string, state: AgentState): Promise<void> {
    await this.stub(runId, agentId).init(state);
  }

  async load(runId: string, agentId: string): Promise<AgentState> {
    try {
      return await this.stub(runId, agentId).load();
    } catch (err) {
      throw new Error(`agent ${agentId} in run ${runId} is not initialized in AgentActor: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async save(runId: string, agentId: string, state: AgentState): Promise<void> {
    await this.stub(runId, agentId).save(state);
  }

  async takeTurn(runId: string, agentId: string, input: AgentTurnInput, signal?: AbortSignal): Promise<AgentTurnOutput> {
    // AbortSignal can't cross DO RPC: send its deadline; the actor builds its own signal.
    return this.stub(runId, agentId).takeTurn(runId, agentId, input, signalDeadline(signal));
  }
}
