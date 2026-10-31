import Link from 'next/link'
import { settingBadges } from './settings'
import type { RunEntry } from './types'

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

function ConditionBadge({ condition }: { condition: RunEntry['condition'] }) {
  const tone =
    condition === 'LABELED'
      ? 'border-primary/60 bg-primary/10 text-primary'
      : 'border-accent/60 bg-accent/10 text-accent'
  return (
    <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium tracking-wider ${tone}`}>
      {condition}
    </span>
  )
}

function Chip({ label, count, alert }: { label: string; count: number; alert?: boolean }) {
  const tone =
    count === 0
      ? 'border-border text-muted-foreground'
      : alert
        ? 'border-violation/70 bg-violation/10 text-violation'
        : 'border-accent/50 bg-accent/10 text-accent'
  return (
    <li className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs ${tone}`}>
      <span className="tabular-nums">{count}</span>
      {label}
    </li>
  )
}

export function RunCard({ entry }: { entry: RunEntry }) {
  return (
    <article className="group relative flex h-full flex-col gap-4 rounded-md border bg-surface p-4 transition-colors hover:border-primary/60 hover:bg-surface-raised focus-within:border-primary/60 sm:p-5">
      <header className="flex items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-1.5">
          <ConditionBadge condition={entry.condition} />
          {settingBadges(entry).map((b) => (
            <span key={b} className="rounded-sm border border-violation/60 bg-violation/10 px-2 py-0.5 text-xs font-medium tracking-wider text-violation">
              {b}
            </span>
          ))}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{entry.events} events</span>
      </header>
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-xl font-semibold leading-snug text-balance break-words">
          {entry.title}
        </h3>
        <p className="text-sm text-muted-foreground">
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
        className={`mt-auto inline-flex min-h-11 items-center justify-between rounded-sm border px-3 text-sm text-foreground transition-colors hover:border-primary hover:text-primary active:bg-surface-raised ${FOCUS} after:absolute after:inset-0 after:content-['']`}
      >
        <span>
          Watch<span className="sr-only"> {entry.title}</span>
        </span>
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </article>
  )
}
