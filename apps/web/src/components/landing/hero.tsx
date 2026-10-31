import Link from 'next/link'
import { VillagePreview } from './village-preview'
import { buttonClass } from './ui'

export function Hero() {
  return <section aria-labelledby="hero-title" className="border-b">
    <div className="mx-auto grid max-w-7xl items-center gap-7 px-4 py-8 sm:px-6 md:py-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.35fr)] lg:gap-10">
      <div className="flex flex-col gap-5">
        <p className="text-sm font-medium text-primary">An observable multi-agent experiment</p>
        <h1 id="hero-title" className="max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Watch AI agents trade, form alliances, and compete.</h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">Inspect what they say, what they do, and how the outcomes change.</p>
        <div className="flex flex-wrap gap-3"><Link href="/run/featured" className={buttonClass('primary')}>Watch a recorded experiment</Link><Link href="/launch" className={buttonClass('secondary')}>Start an experiment</Link></div>
        <p className="text-sm leading-relaxed text-muted-foreground"><Link href="/runs" className="text-primary underline underline-offset-4">Browse recorded runs</Link> · Replay is free to explore and makes no new model calls. Starting a live experiment requires operator access.</p>
      </div>
      <VillagePreview />
    </div>
  </section>
}
