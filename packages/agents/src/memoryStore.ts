// Owner: Person B. In-memory AgentStore (Node/tests/sim:local). Same takeTurn() pipeline as production stores.
import type { AgentState, AgentStore, AgentTurnInput, AgentTurnOutput } from "@simulization/shared";
import { isTurnExpired } from "./limits";
import { StubModelClient } from "./stubModel";
import { takeTurn } from "./takeTurn";
import type { ModelClient, TurnMeta } from "./types";

export interface MemoryAgentStoreOptions {
  /** Defaults to a StubModelClient. */
  model?: ModelClient;
  /** Called with per-turn telemetry (attempts, passReason, tokens). */
  onTurn?: (runId: string, meta: TurnMeta) => void;
}

export class MemoryAgentStore implements AgentStore {
  private readonly states = new Map<string, AgentState>();
  private readonly model: ModelClient;
  private readonly onTurn?: (runId: string, meta: TurnMeta) => void;

  constructor(opts: MemoryAgentStoreOptions = {}) {
    this.model = opts.model ?? new StubModelClient();
    this.onTurn = opts.onTurn;
  }

  private key = (runId: string, agentId: string): string => `${runId}/${agentId}`;

  async init(runId: string, agentId: string, state: AgentState): Promise<void> {
    this.states.set(this.key(runId, agentId), state);
  }

  async load(runId: string, agentId: string): Promise<AgentState> {
    const state = this.states.get(this.key(runId, agentId));
    if (!state) throw new Error(`MemoryAgentStore: no state for ${runId}/${agentId} (call init first)`);
    return state;
  }

  async save(runId: string, agentId: string, state: AgentState): Promise<void> {
    this.states.set(this.key(runId, agentId), state);
  }

  async takeTurn(runId: string, agentId: string, input: AgentTurnInput, signal?: AbortSignal): Promise<AgentTurnOutput> {
    const state = await this.load(runId, agentId);
    const outcome = await takeTurn({ agentId, state, input, model: this.model, signal });
    if (isTurnExpired(signal)) return outcome.output; // timed out: the world already passed this turn, don't save
    await this.save(runId, agentId, outcome.state);
    this.onTurn?.(runId, outcome.meta);
    return outcome.output;
  }
}
