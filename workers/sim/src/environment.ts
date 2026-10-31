export interface AgentEnvironment {
  AGENT_STORE?: string;
  DATABASE_URL: string;
  AGENTRELAY_API_KEY: string;
  AI_GATEWAY_API_KEY: string;
  AGENTRELAY_BASE_URL?: string;
  DURABLE_ACTORS_URL?: string;
  DURABLE_ACTORS_PROJECT_ID?: string;
  DURABLE_ACTORS_SECRET?: string;
  MODEL_MODE?: string;
}
