'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { SiteHeader } from '@/components/landing/site-header'
import { buttonClass } from '@/components/landing/ui'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <>
    <SiteHeader />
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-4 py-24 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-violation">Error</p>
      <h1 className="font-display text-4xl font-semibold text-balance">Something broke.</h1>
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty">
        The page failed to load. Retrying often works; if not, the run data may be unavailable.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          Reference: <code className="rounded-sm border bg-surface px-1.5 py-0.5">{error.digest}</code>
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className={`${buttonClass('primary')} active:scale-[0.97]`}
        >
          Try again
        </button>
        <Link href="/" className={buttonClass('secondary')}>
          Home
        </Link>
      </div>
    </main>
    </>
  )
}
