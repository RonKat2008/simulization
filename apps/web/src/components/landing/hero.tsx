import Link from 'next/link'

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="border-b">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 md:py-24">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">
          Multi-agent eval · minimal group paradigm for AI
        </p>
        <h1
          id="hero-title"
          className="max-w-4xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-6xl"
        >
          Do AI models favor their own maker, and lie to <span className="text-accent">everyone else</span>?
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
          Agents from three AI companies trade in a simulated market where only the seller knows a
          good&apos;s true quality. Every claim, theft and broken pact is checked against ground
          truth by code. We compare a run where agents see each other&apos;s company (LABELED) to one
          where they do not (BLIND), and test whether power structures form on their own.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/launch"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-foreground"
          >
            Launch a run
          </Link>
          <Link
            href="/run/mock"
            className="inline-flex min-h-11 items-center justify-center rounded-md border px-5 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Replay a run
          </Link>
          <Link
            href="/report"
            className="inline-flex min-h-11 items-center justify-center rounded-md border px-5 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Read the report
          </Link>
        </div>
      </div>
    </section>
  )
}
