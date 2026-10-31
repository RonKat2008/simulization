import { PressLink, Stagger, StaggerItem } from './reveal'
import { SectionHeading } from './section-heading'
import { Disclosure, buttonClass } from './ui'

const POINTS = [
  ['Numbers from code', 'No model makes a statistic.'],
  ['Opus explains', 'Every claim cites events.'],
  ['Anonymized logs', 'Company names hidden.'],
  ['One prompt', 'Only the model differs.'],
]

export function Method() {
  return (
    <section id="method" aria-labelledby="method-title" className="scroll-mt-14 border-b">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6 md:py-28">
        <SectionHeading id="method-title" kicker="Method" title="What to trust." />
        <Stagger as="ul" className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border lg:grid-cols-4">
          {POINTS.map(([title, body], i) => (
            <StaggerItem as="li" key={title} lift className="flex flex-col gap-2 bg-surface p-5 sm:p-6">
              <span className="font-display text-xs tracking-widest text-primary" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-base text-foreground">{title}</span>
              <span className="text-sm text-muted-foreground">{body}</span>
            </StaggerItem>
          ))}
        </Stagger>
        <Disclosure summary="Caveats">
          <p>
            <span className="text-foreground">Every metric</span> is a pure function over the event log.
            Claude Opus reads the transcript and cites event IDs; claims citing events that do not exist are dropped.
            Company names are replaced before the reviewer sees the log, because Anthropic models are also contestants.
            Every agent gets the same prompt and rules; only the underlying model differs.
          </p>
          <p>
            <span className="text-foreground">Judge caveat.</span> Anonymizing logs does not fully remove
            reviewer bias, since an Anthropic model reviews a run that includes an Anthropic contestant.
            That is why no figure comes from the reviewer; it only explains, with citations.
          </p>
          <p>
            <span className="text-foreground">Limitations.</span> Results are early signals from a
            small number of runs; a real study needs many more seeds and confidence intervals.
          </p>
        </Disclosure>
      </div>
    </section>
  )
}

export function Cta() {
  return (
    <section aria-labelledby="cta-title" className="pixel-grid">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 md:py-28">
        <h2 id="cta-title" className="font-display text-4xl font-semibold text-balance sm:text-5xl">
          See the evidence
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PressLink href="/launch" className={buttonClass('primary')}>Launch</PressLink>
          <PressLink href="/run/featured" className={buttonClass('secondary')}>Replay</PressLink>
          <PressLink href="/report" className={buttonClass('secondary')}>Report</PressLink>
        </div>
      </div>
    </section>
  )
}
