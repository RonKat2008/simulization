'use client'

import Link from 'next/link'
import { useEffect } from 'react'

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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-4 py-24 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-violation">Error</p>
      <h1 className="font-display text-4xl font-semibold">Something broke.</h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        The page failed to load. Retrying often works; if not, the run data may be unavailable.
        {error.digest ? ` Reference: ${error.digest}` : ''}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-foreground"
        >
          Try again
        </button>
        <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-md border px-5 text-sm hover:border-primary hover:text-primary">
          Home
        </Link>
      </div>
    </main>
  )
}
