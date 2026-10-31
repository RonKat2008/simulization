import type { Metadata } from 'next'
import { SiteHeader } from '@/components/landing/site-header'
import { Eyebrow } from '@/components/landing/ui'
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
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 pb-24 pt-14 sm:px-6 lg:pt-24">
        <div className="flex flex-col gap-5">
          <Eyebrow>Archive</Eyebrow>
          <h1 className="text-title font-semibold text-balance">
            Recorded runs
          </h1>
          <p className="max-w-md text-base text-muted-foreground text-pretty">
            Real games, replayed event by event. Matched seeds, labeled vs blind.
          </p>
        </div>
        {runs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
            No recorded runs yet.
          </p>
        ) : (
          <RunsGrid runs={runs} />
        )}
      </main>
    </>
  )
}
