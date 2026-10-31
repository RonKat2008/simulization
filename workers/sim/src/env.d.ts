// Secrets and vars not declared in wrangler.jsonc (set via .dev.vars / wrangler secret).
declare namespace Cloudflare {
  interface Env {
    DATABASE_URL: string;
    AGENTRELAY_API_KEY: string;
    AI_GATEWAY_API_KEY: string;
    AGENTRELAY_BASE_URL?: string;
    DURABLE_ACTORS_URL?: string;
    DURABLE_ACTORS_PROJECT_ID?: string;
    DURABLE_ACTORS_SECRET?: string;
  }
}
