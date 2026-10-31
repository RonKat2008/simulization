import HeroVideo from './hero-video'
import { PressLink, Stagger, StaggerItem } from './reveal'
import { buttonClass } from './ui'

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b">
      <HeroVideo showChapters />
      <div className="relative z-10 mx-auto flex min-h-[min(78vh,720px)] max-w-6xl items-center px-4 pb-24 pt-16 sm:px-6 md:pt-24">
        <Stagger className="flex max-w-xl flex-col gap-6">
          <StaggerItem>
            <h1 id="hero-title" className="text-display font-semibold text-foreground">
              Do AI agents <span className="text-muted-foreground">play favorites?</span>
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="max-w-md text-[17px] leading-relaxed text-muted-foreground">
              18 AI merchants. 3 labs. One market where every lie is recorded.
            </p>
          </StaggerItem>
          <StaggerItem className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PressLink href="/run/featured" className={buttonClass('primary')}>
              Watch a replay
            </PressLink>
            <PressLink href="/experiment" className={buttonClass('secondary')}>
              See the results
            </PressLink>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  )
}
