import Link from 'next/link'
import { Badge } from '@/components/landing/ui'
import type { RunEntry } from './types'

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

function Chip({ label, count, alert }: { label: string; count: number; alert?: boolean }) {
  const tone =
    count === 0
      ? 'border-border text-muted-foreground'
      : alert
        ? 'border-violation/50 bg-violation/10 text-violation'
        : 'border-accent/40 bg-accent/10 text-accent'
  return (
    <li className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[11px] ${tone}`}>
      <span className="tabular-nums">{count}</span>
      {label}
    </li>
  )
}

export function RunCard({ entry }: { entry: RunEntry }) {
  return (
    <article className="group relative flex h-full flex-col gap-5 rounded-lg border bg-surface p-5 shadow-raised transition-colors duration-150 hover:border-border-strong hover:bg-surface-raised focus-within:border-primary/60 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <Badge tone={entry.condition === 'LABELED' ? 'primary' : 'accent'}>{entry.condition}</Badge>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground tabular-nums">{entry.events} events</span>
      </header>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-semibold leading-snug tracking-[-0.01em] text-balance break-words">
          {entry.title}
        </h3>
        <p className="font-mono text-xs text-muted-foreground">
          Seed {entry.seed} <span aria-hidden="true">·</span> wealth {entry.wealth_visibility}
        </p>
      </div>
      <ul aria-label="Flags" className="flex flex-wrap gap-1.5">
        <Chip label="lies" count={entry.lies} alert />
        <Chip label="thefts" count={entry.thefts} alert />
        <Chip label="broken pacts" count={entry.brokenPacts} alert />
        <Chip label="eval-aware" count={entry.evalAware} />
      </ul>
      <Link
        href={`/run/${entry.slug}`}
        className={`mt-auto inline-flex min-h-11 items-center justify-between rounded-md border border-border-strong px-3.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-background hover:text-primary active:translate-y-px ${FOCUS} after:absolute after:inset-0 after:content-['']`}
      >
        <span>
          Watch<span className="sr-only"> {entry.title}</span>
        </span>
        <span aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </article>
  )
}
