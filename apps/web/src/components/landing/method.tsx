import { PressLink, Stagger, StaggerItem } from './reveal'
import { LandingSection } from './section-heading'
import { Disclosure, buttonClass } from './ui'

const POINTS = [
  ['Numbers from code', 'No model makes a statistic.'],
  ['3 labs explain', 'Every claim cites events.'],
  ['Anonymized logs', 'Company names hidden.'],
  ['One prompt', 'Only the model differs.'],
]

export function Method() {
  return (
    <LandingSection id="method" titleId="method-title" index="04" kicker="Method" title="What to trust.">
        <Stagger as="ul" className="grid gap-px overflow-hidden rounded-lg border bg-border shadow-raised sm:grid-cols-2">
          {POINTS.map(([title, body], i) => (
            <StaggerItem as="li" key={title} className="flex flex-col gap-1.5 bg-surface p-5 transition-colors hover:bg-surface-raised sm:p-6">
              <span className="mb-2 font-mono text-[11px] text-primary" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-[15px] font-medium text-foreground">{title}</span>
              <span className="text-sm text-muted-foreground">{body}</span>
            </StaggerItem>
          ))}
        </Stagger>
        <Disclosure summary="Caveats">
          <p>
            <span className="text-foreground">Every metric</span> is a pure function over the event log.
            A 3-lab judge ensemble (Claude, GPT, Gemini) reads the transcript and cites event IDs; claims citing events that do not exist are dropped.
            Company names are replaced before the judges see the log, because every judge's lab is also a contestant.
            Every agent gets the same prompt and rules; only the underlying model differs.
          </p>
          <p>
            <span className="text-foreground">Judge caveat.</span> Anonymizing logs does not fully remove
            judge bias, since each judge's lab fields contestants. No figure comes from a judge; each lab&apos;s
            merchants are scored only by the other two labs&apos; judges, and each judge&apos;s self-preference is shown.
          </p>
          <p>
            <span className="text-foreground">Limitations.</span> Results are early signals from a
            small number of runs; a real study needs many more seeds and confidence intervals.
          </p>
        </Disclosure>
    </LandingSection>
  )
}

export function Cta() {
  return (
    <section aria-labelledby="cta-title">
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 md:pb-32">
        <div className="flex flex-col gap-8 rounded-xl border bg-surface p-8 shadow-raised sm:p-12 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3">
            <h2 id="cta-title" className="text-title font-semibold text-foreground">
              See the evidence.
            </h2>
            <p className="max-w-sm text-[15px] text-muted-foreground">Replay a recorded run or read the report card.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <PressLink href="/launch" className={buttonClass('primary')}>Launch a run</PressLink>
            <PressLink href="/runs" className={buttonClass('secondary')}>Runs</PressLink>
            <PressLink href="/report" className={buttonClass('secondary')}>Report</PressLink>
          </div>
        </div>
      </div>
    </section>
  )
}
