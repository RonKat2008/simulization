import Link from 'next/link'
import { buttonClass, Eyebrow } from '@/components/landing/ui'
import { SiteHeader } from '@/components/landing/site-header'

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-4 py-24 sm:px-6">
        <Eyebrow>404</Eyebrow>
        <h1 className="text-display font-semibold text-balance">No such page or run.</h1>
        <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
          The address does not match anything here. A run id may be wrong, or the run was never saved.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/" className={buttonClass('primary')}>
            Home
          </Link>
          <Link href="/launch" className={buttonClass('secondary')}>
            Launch a run
          </Link>
        </div>
      </main>
    </>
  )
}
