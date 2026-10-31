import Link from 'next/link'
import { Logo } from './site-header'

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Logo />
          <p>Haunted Hacks 2026. Early signals, not a finished study.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li><Link href="/launch" className="hover:text-foreground">Launch</Link></li>
            <li><Link href="/run/mock" className="hover:text-foreground">Replay</Link></li>
            <li><Link href="/report" className="hover:text-foreground">Report</Link></li>
            <li>
              <a href="https://github.com/RonKat2008/simulization" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                GitHub
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
