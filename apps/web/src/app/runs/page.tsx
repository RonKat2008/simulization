import type { Metadata } from 'next'
import { SiteHeader } from '@/components/landing/site-header'
import { loadRuns } from '@/components/runs/load-manifest'
import { RunsGrid } from '@/components/runs/runs-grid'

export const metadata: Metadata = { title: 'Recorded runs — Simulization' }
// Read public/runs at build time: serverless functions don't ship public/ files, and runs change only on deploy.
export const dynamic = 'force-static'

export default async function RunsPage() {
  const runs = await loadRuns()
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-3xl font-semibold leading-tight text-balance sm:text-4xl">
            Recorded runs
          </h1>
          <p className="max-w-xl text-base text-muted-foreground text-pretty">
            Saved experiments, replayed event by event with no new model calls. Each recording keeps its company-label setting, coin visibility and model mode.
          </p>
        </div>
        {runs.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            No recorded runs yet.
          </p>
        ) : (
          <RunsGrid runs={runs} />
        )}
      </main>
    </>
  )
}
