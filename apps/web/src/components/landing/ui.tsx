import type { ReactNode } from 'react'

/** Shared button class recipes so every page uses one button language. */
const BUTTON_BASE =
  'inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-md px-4.5 text-sm font-medium tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'

const BUTTON_VARIANT = {
  primary:
    'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_2px_rgb(0_0_0/0.4)] hover:bg-[color-mix(in_oklab,var(--primary)_88%,white)]',
  secondary:
    'border border-border-strong bg-surface text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.03)] hover:border-[color-mix(in_oklab,var(--border-strong)_60%,var(--foreground))] hover:bg-surface-raised',
  ghost: 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
} as const

export function buttonClass(variant: keyof typeof BUTTON_VARIANT = 'primary', extra = ''): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${extra}`.trim()
}

/** Small mono label used for tags such as run mode or wealth visibility. */
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'accent' }) {
  const toneClass =
    tone === 'primary'
      ? 'border-primary/50 text-primary'
      : tone === 'accent'
        ? 'border-accent/50 text-accent'
        : 'border-border-strong text-muted-foreground'
  return (
    <span className={`inline-flex h-5 items-center rounded-sm border px-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] ${toneClass}`}>
      {children}
    </span>
  )
}

/** Surface card: one radius/border/padding recipe for panels across pages. */
export const CARD_CLASS = 'rounded-lg border bg-surface p-5 shadow-raised sm:p-6'

/** Section eyebrow: mono micro-label with an index, e.g. "01 · Design". */
export function Eyebrow({ index, children }: { index?: string; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">
      {index ? <span className="text-primary">{index}</span> : null}
      {index ? <span aria-hidden="true" className="h-px w-4 bg-border-strong" /> : null}
      <span>{children}</span>
    </p>
  )
}

/** Native disclosure: detail stays reachable (and in the DOM) without crowding the screen. */
export function Disclosure({ summary, children, className = '' }: { summary: string; children: ReactNode; className?: string }) {
  return (
    <details className={`group rounded-lg border bg-surface transition-colors open:border-border-strong ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 text-sm text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary group-open:rounded-b-none group-open:text-foreground [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 shrink-0 text-subtle-foreground transition-transform duration-200 ease-out group-open:rotate-180">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="flex flex-col gap-3 border-t px-4 py-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </details>
  )
}
