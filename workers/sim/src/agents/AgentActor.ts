// Owner: Person B. One per (runId, agentId), named `${runId}:${agentId}`: persistent AgentState + turns.
import { DurableObject } from "cloudflare:workers";
import type { AgentState, AgentTurnInput, AgentTurnOutput } from "@simulization/shared";
import { createModelClient, createRunRelay } from "./createAgentStore";
import { withRelayInbox } from "@simulization/agents";
import { isOlderTurnKey, isTurnExpired, passOutput, signalFromDeadline, takeTurn, turnKey } from "@simulization/agents";
import { logTurn } from "@simulization/agents";

const STATE_KEY = "state";
const TURN_KEY = "lastTurnKey";

export class AgentActor extends DurableObject<Cloudflare.Env> {
  async fetch(_request: Request): Promise<Response> {
    return new Response("Not found", { status: 404 });
  }

  async init(state: AgentState): Promise<void> {
    await this.ctx.storage.put(STATE_KEY, state);
    await this.ctx.storage.delete(TURN_KEY);
  }

  async load(): Promise<AgentState> {
    const state = await this.ctx.storage.get<AgentState>(STATE_KEY);
    if (!state) throw new Error("AgentActor not initialized: call init(state) first");
    return state;
  }

  async save(state: AgentState): Promise<void> {
    await this.ctx.storage.put(STATE_KEY, state);
  }

  /**
   * `deadline` (epoch ms) replaces an AbortSignal, which cannot cross DO RPC. Past the deadline the result is
   * discarded unsaved (the world already passed the turn). `lastTurnKey` (round:phase) is claimed at turn start,
   * so a late turn from an older phase can neither run nor save over a newer one.
   */
  async takeTurn(runId: string, agentId: string, input: AgentTurnInput, deadline?: number): Promise<AgentTurnOutput> {
    const loaded = await this.load();
    const key = turnKey(input);
    const current = await this.ctx.storage.get<string>(TURN_KEY);
    if (isOlderTurnKey(key, current)) return passOutput(`stale turn ${key} (already at ${current})`, loaded.memory);
    await this.ctx.storage.put(TURN_KEY, key);

    const signal = signalFromDeadline(deadline);
    const { input: turnInput, state } = await withRelayInbox(createRunRelay(this.env), runId, agentId, loaded, input);
    const result = await takeTurn({ agentId, state, input: turnInput, model: createModelClient(this.env), signal, deadline });
    if (isTurnExpired(signal, deadline) || (await this.ctx.storage.get<string>(TURN_KEY)) !== key) return result.output;
    await this.save(result.state);
    logTurn(runId, input, result.meta);
    return result.output;
  }
}
