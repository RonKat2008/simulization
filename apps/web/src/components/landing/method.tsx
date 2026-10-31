import { PressLink, Reveal, Stagger, StaggerItem } from './reveal'
import { SectionHeading } from './section-heading'

const POINTS = [
  ['Numbers from code', 'Every metric is a pure function over the event log. No model produces a statistic.'],
  ['Opus only explains', 'Claude Opus reads the transcript and cites event IDs for each claim. Claims citing events that do not exist are dropped.'],
  ['Anonymized logs', 'Company names are replaced before the reviewer sees the log, because Anthropic models are also contestants.'],
  ['Identical prompt', 'Every agent gets the same prompt and rules; only the underlying model differs.'],
]

export function Method() {
  return (
    <section id="method" aria-labelledby="method-title" className="scroll-mt-14 border-b">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading id="method-title" kicker="Methodology" title="What to trust, and what not to." />
        <Stagger as="ul" className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2">
          {POINTS.map(([title, body]) => (
            <StaggerItem as="li" key={title} lift className="flex flex-col gap-2 bg-surface p-5 text-sm">
              <span className="text-foreground">{title}</span>
              <span className="text-muted-foreground">{body}</span>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal><p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          <span className="text-foreground">Limitations.</span> Results are early signals from a
          small number of runs; a real study needs many more seeds and confidence intervals.
        </p></Reveal>
      </div>
    </section>
  )
}

export function Cta() {
  return (
    <section aria-labelledby="cta-title">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6 md:py-20">
        <Reveal><h2 id="cta-title" className="font-display text-3xl font-semibold">See the evidence</h2></Reveal>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PressLink href="/launch" className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-foreground">
            Launch a run
          </PressLink>
          <PressLink href="/run/mock" className="inline-flex min-h-11 items-center justify-center rounded-md border px-5 text-sm hover:border-primary hover:text-primary">
            Replay a run
          </PressLink>
          <PressLink href="/report" className="inline-flex min-h-11 items-center justify-center rounded-md border px-5 text-sm hover:border-primary hover:text-primary">
            Read the report
          </PressLink>
        </div>
      </div>
    </section>
  )
}
