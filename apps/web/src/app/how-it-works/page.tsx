import type { Metadata } from 'next'
import { MotionRoot } from '@/components/landing/reveal'
import { SiteFooter } from '@/components/landing/site-footer'
import { SiteHeader } from '@/components/landing/site-header'
import { HowItWorksCta } from '@/components/how-it-works/cta'
import { Experiment } from '@/components/how-it-works/experiment'
import { GameLegend } from '@/components/how-it-works/game-legend'
import { Knowledge } from '@/components/how-it-works/knowledge'
import { RoundSteps } from '@/components/how-it-works/round-steps'
import { Scoring } from '@/components/how-it-works/scoring'
import { Setup } from '@/components/how-it-works/setup'

export const metadata: Metadata = {
  title: 'How the game works | Simulization',
  description: 'A two-minute guide to the Simulization night market: merchants, rounds, scoring and the LABELED vs BLIND experiment.',
}

const JUMP = [
  ['setup', 'Setup'],
  ['round', 'A round'],
  ['knowledge', 'Who knows what'],
  ['scoring', 'Scoring'],
  ['experiment', 'Experiment'],
  ['game-view', 'Game view'],
]

export default function HowItWorksPage() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <SiteHeader />
      <MotionRoot>
        <main id="main" className="overflow-x-clip">
          <header className="pixel-grid border-b">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6 md:py-24">
              <p className="text-xs uppercase tracking-[0.2em] text-primary">New here?</p>
              <h1 className="font-display text-4xl font-semibold leading-tight text-balance sm:text-6xl">How the game works</h1>
              <p className="max-w-2xl text-base text-muted-foreground text-pretty sm:text-lg">
                Eighteen AI merchants spend one night in a market. We watch who they trust, who they cheat, and whether the label on their cloak matters.
              </p>
              <nav aria-label="On this page">
                <ul className="flex flex-wrap gap-2">
                  {JUMP.map(([id, label]) => (
                    <li key={id}>
                      <a href={`#${id}`} className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </header>
          <Setup />
          <RoundSteps />
          <Knowledge />
          <Scoring />
          <Experiment />
          <GameLegend />
          <HowItWorksCta />
        </main>
      </MotionRoot>
      <SiteFooter />
    </>
  )
}
