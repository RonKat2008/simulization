export const dynamic = 'force-dynamic';
/** Deployment provenance only. Never return environment configuration or credentials. */
export function GET() {
  return Response.json({ commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null }, {
    headers: { 'cache-control': 'no-store' },
  });
}
