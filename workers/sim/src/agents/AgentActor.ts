// Owner: Person B. One per (runId, agentId), named `${runId}:${agentId}`: persistent AgentState + turns.
import { DurableObject } from "cloudflare:workers";
import type { AgentState, AgentTurnInput, AgentTurnOutput } from "@simulization/shared";
import { createModelClient, createRunRelay } from "./createAgentStore";
import { withRelayInbox } from "./relayInbox";
import { takeTurn } from "./takeTurn";
import { logTurn } from "./telemetry";

const STATE_KEY = "state";

export class AgentActor extends DurableObject<Cloudflare.Env> {
  async fetch(_request: Request): Promise<Response> {
    return new Response("Not found", { status: 404 });
  }

  async init(state: AgentState): Promise<void> {
    await this.ctx.storage.put(STATE_KEY, state);
  }

  async load(): Promise<AgentState> {
    const state = await this.ctx.storage.get<AgentState>(STATE_KEY);
    if (!state) throw new Error("AgentActor not initialized: call init(state) first");
    return state;
  }

  async save(state: AgentState): Promise<void> {
    await this.ctx.storage.put(STATE_KEY, state);
  }

  async takeTurn(runId: string, agentId: string, input: AgentTurnInput): Promise<AgentTurnOutput> {
    const loaded = await this.load();
    const { input: turnInput, state } = await withRelayInbox(createRunRelay(this.env), runId, agentId, loaded, input);
    const result = await takeTurn({ agentId, state, input: turnInput, model: createModelClient(this.env) });
    await this.save(result.state);
    logTurn(runId, input, result.meta);
    return result.output;
  }
}
