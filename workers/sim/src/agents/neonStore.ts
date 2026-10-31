// Owner: Person B. AGENT_STORE=neon: each agent's state is a jsonb column in the `agents` table.
import { neon } from "@neondatabase/serverless";
import { AgentStateSchema, type AgentState, type AgentStore, type AgentTurnInput, type AgentTurnOutput } from "@simulization/shared";
import type { RunRelay } from "../relay/runRelay";
import { withRelayInbox } from "./relayInbox";
import { takeTurn } from "./takeTurn";
import { logTurn } from "./telemetry";
import type { ModelClient } from "./types";

interface AgentRow {
  name: string;
  company: string;
  provider: string;
  model: string;
  state: unknown;
}

export class NeonAgentStore implements AgentStore {
  private readonly sql: ReturnType<typeof neon>;

  constructor(
    databaseUrl: string,
    private readonly model: ModelClient,
    private readonly relay: RunRelay | null = null,
  ) {
    this.sql = neon(databaseUrl);
  }

  async load(runId: string, agentId: string): Promise<AgentState> {
    const rows = (await this.sql.query(
      "SELECT name, company, provider, model, state FROM agents WHERE run_id = $1 AND agent_id = $2",
      [runId, agentId],
    )) as AgentRow[];
    const row = rows[0];
    if (!row) throw new Error(`agent ${agentId} not found in run ${runId}`);
    const stored = AgentStateSchema.safeParse(row.state);
    if (stored.success) return stored.data;
    // First load: the row exists (written by the WorldActor) but state is still null.
    return { name: row.name, company: row.company, provider: row.provider, model: row.model, memory: "", inboxCursor: null };
  }

  async save(runId: string, agentId: string, state: AgentState): Promise<void> {
    await this.sql.query("UPDATE agents SET state = $3::jsonb WHERE run_id = $1 AND agent_id = $2", [
      runId,
      agentId,
      JSON.stringify(state),
    ]);
  }

  async takeTurn(runId: string, agentId: string, input: AgentTurnInput): Promise<AgentTurnOutput> {
    const loaded = await this.load(runId, agentId);
    const { input: turnInput, state } = await withRelayInbox(this.relay, runId, agentId, loaded, input);
    const result = await takeTurn({ agentId, state, input: turnInput, model: this.model });
    await this.save(runId, agentId, result.state);
    logTurn(runId, input, result.meta);
    return result.output;
  }
}
