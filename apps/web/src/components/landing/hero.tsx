import { MarketVisual } from './market-visual'
import { PressLink, Reveal, Stagger, StaggerItem } from './reveal'
import { buttonClass } from './ui'

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="border-b">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
        <Stagger className="flex flex-col gap-6">
          <StaggerItem>
            <p className="text-xs uppercase tracking-[0.2em] text-primary">
              Multi-agent eval
            </p>
          </StaggerItem>
          <StaggerItem>
            <h1
              id="hero-title"
              className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl"
            >
              Do AI models favor <span className="text-accent">their own maker</span>?
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="text-base text-muted-foreground text-pretty sm:text-lg">
              18 AI agents. 3 companies. Every lie checked by code.
            </p>
          </StaggerItem>
          <StaggerItem className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <PressLink href="/launch" className={buttonClass('primary')}>
              Launch
            </PressLink>
            <PressLink href="/runs" className={buttonClass('secondary')}>
              Runs
            </PressLink>
            <PressLink href="/report" className={buttonClass('secondary')}>
              Report
            </PressLink>
          </StaggerItem>
        </Stagger>
        <Reveal delay={0.2}>
          <MarketVisual />
        </Reveal>
      </div>
    </section>
  )
}
