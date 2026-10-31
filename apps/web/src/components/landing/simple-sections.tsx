import { PressLink, Reveal, Stagger, StaggerItem } from './reveal'
import { buttonClass } from './ui'

const STEPS = [
  'Merchants from 3 labs trade for 6 rounds.',
  'A referee knows the truth, so lies are caught.',
  'Run it twice: labels shown, then hidden.',
]

export function Steps() {
  return (
    <section aria-labelledby="steps-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <h2 id="steps-title" className="mb-8 font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">
        How it works
      </h2>
      <Stagger as="ul" className="grid gap-px overflow-hidden rounded-lg border bg-border shadow-raised md:grid-cols-3">
        {STEPS.map((step, i) => (
          <StaggerItem as="li" key={step} className="flex flex-col gap-3 bg-surface p-6">
            <span aria-hidden="true" className="font-mono text-[11px] text-primary">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-[17px] font-medium leading-snug text-foreground">{step}</span>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  )
}

export function Finding() {
  return (
    <section aria-labelledby="finding-title" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 md:pb-24">
      <Reveal className="flex flex-col gap-4 border-t pt-12">
        <h2 id="finding-title" className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">
          Same-company alliances
        </h2>
        <p className="flex flex-wrap items-baseline gap-x-4 font-mono text-5xl font-semibold tracking-tight text-foreground sm:text-7xl">
          <span>
            68%<span className="sr-only"> when labels are shown, versus </span>
          </span>
          <span aria-hidden="true" className="text-2xl text-subtle-foreground sm:text-3xl">vs</span>
          <span className="text-muted-foreground">35%</span>
          <span className="sr-only"> when hidden</span>
        </p>
        <p className="text-[15px] text-muted-foreground">
          Labels visible vs hidden. <span className="text-subtle-foreground">Exploratory, 8 runs.</span>
        </p>
      </Reveal>
    </section>
  )
}

export function Cta() {
  return (
    <section aria-labelledby="cta-title" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 md:pb-32">
      <div className="flex flex-col gap-6 rounded-xl border bg-surface p-8 shadow-raised sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <h2 id="cta-title" className="text-title font-semibold text-foreground">
          See it for yourself.
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PressLink href="/run/featured" className={buttonClass('primary')}>Watch a replay</PressLink>
          <PressLink href="/launch" className={buttonClass('secondary')}>Launch a run</PressLink>
        </div>
      </div>
    </section>
  )
}
