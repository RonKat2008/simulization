import { PressLink, Reveal, Stagger, StaggerItem } from './reveal'
import { SectionHeading } from './section-heading'
import { buttonClass } from './ui'

const POINTS = [
  ['Numbers from code', 'Every metric is a pure function over the event log. No model produces a statistic.'],
  ['Opus only explains', 'Claude Opus reads the transcript and cites event IDs for each claim. Claims citing events that do not exist are dropped.'],
  ['Anonymized logs', 'Company names are replaced before the reviewer sees the log, because Anthropic models are also contestants.'],
  ['Identical prompt', 'Every agent gets the same prompt and rules; only the underlying model differs.'],
]

export function Method() {
  return (
    <section id="method" aria-labelledby="method-title" className="scroll-mt-14 border-b">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 md:py-24">
        <SectionHeading
          id="method-title"
          kicker="Methodology"
          title="What to trust, and what not to."
          description="Four design choices keep the numbers independent of any model's opinion."
        />
        <Stagger as="ul" className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2">
          {POINTS.map(([title, body], i) => (
            <StaggerItem as="li" key={title} lift className="flex flex-col gap-2 bg-surface p-5 text-sm sm:p-6">
              <span className="font-display text-xs tracking-widest text-primary" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-base text-foreground">{title}</span>
              <span className="leading-relaxed text-muted-foreground">{body}</span>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="max-w-3xl rounded-md border border-dashed bg-surface/50 p-4 sm:p-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="text-foreground">Judge caveat.</span> Anonymizing logs does not fully remove
            reviewer bias, since an Anthropic model reviews a run that includes an Anthropic contestant.
            That is why no figure comes from the reviewer; it only explains, with citations.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <span className="text-foreground">Limitations.</span> Results are early signals from a
            small number of runs; a real study needs many more seeds and confidence intervals.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

export function Cta() {
  return (
    <section aria-labelledby="cta-title" className="pixel-grid">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6 md:py-24">
        <Reveal className="flex max-w-2xl flex-col gap-3">
          <h2 id="cta-title" className="font-display text-3xl font-semibold text-balance sm:text-4xl">
            See the evidence
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
            Start a matched LABELED and BLIND pair, replay a recorded run, or read the report card.
          </p>
        </Reveal>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PressLink href="/launch" className={buttonClass('primary')}>Launch a run</PressLink>
          <PressLink href="/run/mock" className={buttonClass('secondary')}>Replay a run</PressLink>
          <PressLink href="/report" className={buttonClass('secondary')}>Read the report</PressLink>
        </div>
      </div>
    </section>
  )
}
