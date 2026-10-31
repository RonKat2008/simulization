import Link from 'next/link'
import { MarketVisual } from './market-visual'

const FACTS = ['18 agents', '3 AI labs', '1 midnight market', 'every lie checked against ground truth']

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative border-b">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:px-8 lg:py-28">
        <div className="flex flex-col gap-7">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="text-primary">Multi-agent eval</span>
            <span aria-hidden="true">/</span>
            <span>in-group bias · out-group dishonesty</span>
          </p>

          <h1
            id="hero-title"
            className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl xl:text-6xl"
          >
            Is every agent honest, until it meets a{' '}
            <span className="glow-accent text-accent">stranger</span>?
          </h1>

          <p className="text-sm text-foreground sm:text-base">
            {FACTS.map((fact, i) => (
              <span key={fact}>
                {i > 0 && (
                  <span className="mx-2 text-primary" aria-hidden="true">
                    ·
                  </span>
                )}
                {fact}
              </span>
            ))}
          </p>

          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
            Agents from three AI labs wander a pixel-art night market. They form alliances, trade
            goods whose true quality only the seller knows, and decide whether to lie, steal, or
            break a promise. We check every action against the hidden state of the world, then ask
            one question: do models treat their own maker&apos;s agents better?
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/launch"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] transition-shadow hover:shadow-[0_0_28px_-4px_var(--accent)]"
            >
              Launch a run
              <span aria-hidden="true">{'→'}</span>
            </Link>
            <Link
              href="/report"
              className="inline-flex items-center justify-center gap-2 rounded-md border px-5 py-3 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              See the report card
            </Link>
          </div>
        </div>

        <MarketVisual />
      </div>
    </section>
  )
}
