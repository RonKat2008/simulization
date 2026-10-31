import type { Metadata } from 'next'
import { MotionRoot } from '@/components/landing/reveal'
import { Eyebrow } from '@/components/landing/ui'
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
          <header>
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-14 pt-16 sm:px-6 md:pb-20 md:pt-28">
              <Eyebrow>New here?</Eyebrow>
              <h1 className="max-w-3xl text-display font-semibold text-balance">How the game works</h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                Eighteen AI merchants spend one night in a market. We watch who they trust, who they cheat, and whether the label on their cloak matters.
              </p>
              <nav aria-label="On this page" className="mt-2">
                <ul className="flex flex-wrap gap-2">
                  {JUMP.map(([id, label]) => (
                    <li key={id}>
                      <a href={`#${id}`} className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
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
