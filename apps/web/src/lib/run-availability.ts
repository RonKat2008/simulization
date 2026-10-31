/** This demo's Vercel deployments are recorded playback only; Terse runs locally. */
export function canStartRuns(env: { VERCEL?: string } = { VERCEL: process.env.VERCEL }): boolean {
  return env.VERCEL !== '1';
}

export const LOCAL_DEMO_MESSAGE = 'Live runs are available in the local demo';

export function hostedLaunchResponse(): Response | null {
  return canStartRuns() ? null : Response.json(
    { error: LOCAL_DEMO_MESSAGE, code: 'LOCAL_DEMO_ONLY', replayUrl: '/run/featured' },
    { status: 503, headers: { 'cache-control': 'no-store' } },
  );
}
