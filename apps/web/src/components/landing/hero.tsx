import HeroVideo from './hero-video'
import { PressLink, Stagger, StaggerItem } from './reveal'
import { buttonClass } from './ui'

const FACTS: [string, string][] = [
  ['18', 'agents'],
  ['3', 'labs'],
  ['2', 'conditions'],
]

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b">
      <HeroVideo showChapters />
      <div className="relative z-10 mx-auto flex min-h-[min(82vh,760px)] max-w-6xl items-center px-4 pb-24 pt-16 sm:px-6 md:pt-24">
        <Stagger className="flex max-w-xl flex-col gap-7">
          <StaggerItem>
            <p className="inline-flex h-7 items-center gap-2 rounded-full border border-border-strong bg-surface pl-1 pr-3 text-xs text-muted-foreground">
              <span className="inline-flex h-5 items-center rounded-full bg-primary/12 px-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-primary">
                Eval
              </span>
              In-group bias in AI agents
            </p>
          </StaggerItem>
          <StaggerItem>
            <h1 id="hero-title" className="text-display font-semibold text-foreground">
              Do AI models favor <span className="text-muted-foreground">their own maker?</span>
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="max-w-md text-[17px] leading-relaxed text-muted-foreground">
              Agents from three labs trade in one market. Hide the company labels and see what changes.
              Every lie is checked by code.
            </p>
          </StaggerItem>
          <StaggerItem className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <PressLink href="/launch" className={buttonClass('primary')}>
              Launch a run
            </PressLink>
            <PressLink href="/runs" className={buttonClass('secondary')}>
              Watch runs
            </PressLink>
            <PressLink href="/report" className={buttonClass('ghost')}>
              Report <span aria-hidden="true">→</span>
            </PressLink>
          </StaggerItem>
          <StaggerItem>
            <div className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <dl className="flex gap-8">
                {FACTS.map(([n, label]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <dt className="sr-only">{label}</dt>
                    <dd className="font-mono text-xl text-foreground">{n}</dd>
                    <dd aria-hidden="true" className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">
                      {label}
                    </dd>
                  </div>
                ))}
              </dl>
              <PressLink
                href="/experiment"
                className="group inline-flex min-h-11 items-center gap-1.5 self-start rounded-md text-sm text-foreground underline decoration-border-strong decoration-1 underline-offset-[6px] transition-colors hover:decoration-primary sm:self-auto"
              >
                See the controlled experiment
                <span aria-hidden="true" className="text-primary transition-transform duration-150 group-hover:translate-x-0.5">→</span>
              </PressLink>
            </div>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  )
}
