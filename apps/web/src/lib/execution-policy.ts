/** Server-side execution policy. Public reads and recorded replays never need a key. */
import { timingSafeEqual } from 'node:crypto';

type Env = Record<string, string | undefined>;
export interface LaunchAvailability {
  mode: 'live' | 'stub';
  enabled: boolean;
  requiresToken: boolean;
  reason: string | null;
}
const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);

export function reachableActorConfiguration(env: Env): boolean {
  if (!env.VERCEL) return true;
  try {
    const url = new URL(env.DURABLE_ACTORS_URL ?? '');
    return url.protocol === 'https:' && !loopback(url.hostname) && Boolean(env.DURABLE_ACTORS_PROJECT_ID);
  } catch { return false; }
}

export function launchAvailability(env: Env = process.env): LaunchAvailability {
  const mode = env.SIM_RUN_MODE === 'stub' ? 'stub' : 'live';
  const requiresToken = Boolean(env.SIM_OPERATOR_TOKEN);
  let reason: string | null = null;
  if (env.VERCEL && !requiresToken) reason = 'Starting experiments is reserved for the demo operator. Watch a recorded experiment instead.';
  else if (!reachableActorConfiguration(env)) reason = 'The hosted simulation backend is not configured. Recorded experiments remain available.';
  else if (mode === 'live' && ['DATABASE_URL', 'AI_GATEWAY_API_KEY', 'AGENTRELAY_API_KEY'].some(key => !env[key])) reason = 'Live experiment credentials are not configured. Recorded experiments remain available.';
  else if (env.SIM_RUN_MODE && !['live', 'stub'].includes(env.SIM_RUN_MODE)) reason = 'The experiment mode is not configured correctly.';
  else if (mode === 'live' && env.MODEL_MODE === 'stub') reason = 'Live mode cannot use scripted model decisions.';
  return { mode, enabled: !reason, requiresToken, reason };
}

/** Guard paid analysis and run mutations before any work, also on direct HTTP requests. */
export function executionDenied(req: Request, env: Env = process.env): Response | null {
  const expected = env.SIM_OPERATOR_TOKEN;
  if (expected) {
    const supplied = req.headers.get('x-sim-operator-token') ?? '';
    const a = Buffer.from(expected), b = Buffer.from(supplied);
    if (a.length === b.length && timingSafeEqual(a, b)) return null;
    return Response.json({ error: 'An operator key is required for this action.' }, { status: 403 });
  }
  // Keep the local launcher usable, but do not accidentally authorize a network-facing deployment.
  const url = new URL(req.url);
  const origin = req.headers.get('origin');
  if (!env.VERCEL && loopback(url.hostname) && (!origin || origin === url.origin)) return null;
  return Response.json({ error: 'Operator execution is disabled. Recorded experiments remain available.' }, { status: 403 });
}
