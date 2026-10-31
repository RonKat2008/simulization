'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { SiteHeader } from '@/components/landing/site-header'
import { buttonClass, Eyebrow } from '@/components/landing/ui'

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
      <Eyebrow>Error</Eyebrow>
      <h1 className="text-display font-semibold text-balance">Something broke.</h1>
      <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground text-pretty">
        The page failed to load. Retrying often works; if not, the run data may be unavailable.
      </p>
      {error.digest ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">
          Reference: <code className="rounded-sm border bg-surface px-1.5 py-0.5 normal-case tracking-normal text-muted-foreground">{error.digest}</code>
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
