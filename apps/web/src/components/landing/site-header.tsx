import Link from 'next/link'

const NAV = [
  { href: '/#how', label: 'How it works' },
  { href: '/#conditions', label: 'Conditions' },
  { href: '/#metrics', label: 'Metrics' },
]

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid grid-cols-2 gap-0.5" aria-hidden="true">
        <span className="size-1.5 bg-lab-a" />
        <span className="size-1.5 bg-lab-b" />
        <span className="size-1.5 bg-lab-c" />
        <span className="size-1.5 bg-primary" />
      </span>
      <span className="font-display text-lg font-semibold tracking-wide text-foreground">
        Simulization
      </span>
    </span>
  )
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Simulization home">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm text-muted-foreground">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="transition-colors hover:text-accent">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Link
          href="/report"
          className="ml-auto text-sm text-muted-foreground transition-colors hover:text-accent md:hidden"
        >
          Report
        </Link>
        <Link
          href="/launch"
          className="whitespace-nowrap rounded-md border border-primary/50 px-3 py-1.5 text-sm text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          Launch a run
        </Link>
      </div>
    </header>
  )
}
