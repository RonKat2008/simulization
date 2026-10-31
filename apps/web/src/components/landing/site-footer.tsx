import Link from 'next/link'
import { Logo } from './site-header'

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <Logo />
          <p>
            Built for <span className="text-foreground">Haunted Hacks 2026</span>
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-6">
            <li>
              <Link href="/launch" className="transition-colors hover:text-accent">
                Launch a run
              </Link>
            </li>
            <li>
              <Link href="/report" className="transition-colors hover:text-accent">
                Report card
              </Link>
            </li>
            <li>
              <a href="#how" className="transition-colors hover:text-accent">
                Method
              </a>
            </li>
            <li>
              <a
                href="https://github.com/RonKat2008/simulization"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-accent"
              >
                GitHub
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
