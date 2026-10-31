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
              Multi-agent eval · minimal group paradigm for AI
            </p>
          </StaggerItem>
          <StaggerItem>
            <h1
              id="hero-title"
              className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl"
            >
              Do AI models favor their own maker, and lie to <span className="text-accent">everyone else</span>?
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
              Agents from three AI companies trade in a simulated market where only the seller knows a
              good&apos;s true quality. Every claim, theft and broken pact is checked against ground
              truth by code. We compare a run where agents see each other&apos;s company (LABELED) to one
              where they do not (BLIND), and test whether power structures form on their own.
            </p>
          </StaggerItem>
          <StaggerItem className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <PressLink href="/launch" className={buttonClass('primary')}>
              Launch a run
            </PressLink>
            <PressLink href="/run/mock" className={buttonClass('secondary')}>
              Replay a run
            </PressLink>
            <PressLink href="/report" className={buttonClass('secondary')}>
              Read the report
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
