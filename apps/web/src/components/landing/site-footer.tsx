import Link from 'next/link'
import { Logo } from './site-header'

const FOOT_LINK =
  'inline-flex min-h-10 items-center rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Logo />
          <p>Recorded observations. Cautious conclusions.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-0">
            <li><Link href="/launch" className={FOOT_LINK}>Experiment settings</Link></li>
            <li><Link href="/runs" className={FOOT_LINK}>Recorded runs</Link></li>
            <li><Link href="/how-it-works" className={FOOT_LINK}>How it works</Link></li>
            <li><Link href="/report" className={FOOT_LINK}>Report</Link></li>
            <li>
              <a href="https://github.com/RonKat2008/simulization" target="_blank" rel="noopener noreferrer" className={FOOT_LINK}>
                GitHub
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
