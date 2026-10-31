import type { ReactNode } from 'react'

/** Shared button class recipes so every page uses one button language. */
const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60'

const BUTTON_VARIANT = {
  primary: 'bg-primary text-primary-foreground hover:bg-foreground',
  secondary:
    'border text-foreground hover:border-primary hover:text-primary active:bg-surface-raised',
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
        : 'text-muted-foreground'
  return <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs ${toneClass}`}>{children}</span>
}

/** Surface card: one radius/border/padding recipe for panels across pages. */
export const CARD_CLASS = 'rounded-lg border bg-surface p-5 sm:p-6'
