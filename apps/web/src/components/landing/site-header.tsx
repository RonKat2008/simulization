'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const REPO_URL = 'https://github.com/RonKat2008/simulization'

const NAV = [
  { href: '/runs', label: 'Recorded runs', match: (p: string) => p.startsWith('/run') },
  { href: '/launch', label: 'Experiment settings', match: (p: string) => p.startsWith('/launch') },
  { href: '/how-it-works', label: 'How it works', match: (p: string) => p.startsWith('/how-it-works') },
  { href: '/report', label: 'Report', match: (p: string) => p.startsWith('/report') },
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

function linkClass(active: boolean) {
  return `inline-flex min-h-10 items-center rounded-sm border-b-2 px-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    active
      ? 'border-primary text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  }`
}

export function SiteHeader() {
  const pathname = usePathname() ?? '/'
  // Menu is open only for the pathname it was opened on, so navigating closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt === pathname
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next
    setOpenAt(value ? pathname : null)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenAt(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Simulization home" onClick={() => setOpen(false)} className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => {
            const active = item.match(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={linkClass(active)}
              >
                {item.label}
              </Link>
            )
          })}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={linkClass(false)}>
            GitHub
          </a>
        </nav>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="inline-flex min-h-11 min-w-16 items-center justify-center rounded-md border px-3 text-sm text-foreground transition-colors hover:border-primary hover:text-primary active:bg-surface-raised md:hidden"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Primary mobile" className="border-t bg-background motion-safe:animate-[menu-in_150ms_ease-out] md:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col px-4 py-2 sm:px-6">
            {NAV.map((item) => {
              const active = item.match(pathname)
              return (
                <li key={item.href} className="border-b last:border-b-0">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-12 items-center gap-3 rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                      active ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    <span aria-hidden="true" className={`size-1.5 ${active ? 'bg-primary' : 'bg-transparent'}`} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
            <li>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center gap-3 rounded-sm text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
              >
                <span aria-hidden="true" className="size-1.5" />
                GitHub<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
