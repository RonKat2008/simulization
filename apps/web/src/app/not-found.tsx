import Link from 'next/link'
import { SiteHeader } from '@/components/landing/site-header'

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-4 py-24 sm:px-6">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">404</p>
        <h1 className="font-display text-4xl font-semibold">No such page or run.</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          The address does not match anything here. A run id may be wrong, or the run was never saved.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-foreground">
            Home
          </Link>
          <Link href="/report" className="inline-flex min-h-11 items-center justify-center rounded-md border px-5 text-sm hover:border-primary hover:text-primary">
            Report
          </Link>
        </div>
      </main>
    </>
  )
}
