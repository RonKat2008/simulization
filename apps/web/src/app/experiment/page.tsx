import type { Metadata } from 'next'
import Link from 'next/link'
import { COMPANIES } from '@simulization/shared'
import { DesignDiagram } from '@/components/experiment/design-diagram'
import { HeadlineCard } from '@/components/experiment/headline-card'
import { loadExperiment } from '@/components/experiment/load'
import { OutcomesTable } from '@/components/experiment/outcomes-table'
import { PairDetails } from '@/components/experiment/pair-details'
import { SlopeChart } from '@/components/experiment/slope-chart'
import { SiteFooter } from '@/components/landing/site-footer'
import { SiteHeader } from '@/components/landing/site-header'
import { Badge, CARD_CLASS, Disclosure, buttonClass } from '@/components/landing/ui'

export const metadata: Metadata = {
  title: 'Experiment: anonymous vs disclosed identity | Simulization',
  description: 'One controlled experiment: does telling a model who it is dealing with change how it cooperates? Matched pairs, bootstrap confidence intervals, no overclaiming.',
}
// Pairs are discovered from public/runs/index.json at build time; runs change only on deploy.
export const dynamic = 'force-static'

const SECTION = 'flex flex-col gap-4'
const H2 = 'font-display text-2xl font-semibold text-balance sm:text-3xl'

export default async function ExperimentPage() {
  const { pairs, pooled, roster } = await loadExperiment()
  const n = pairs.length
  const fav = pooled.favoritism
  const positive = fav.perPair.filter((d) => d !== null && d > 0).length

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-14 px-4 py-12 sm:px-6 lg:py-16">
        <header className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Badge tone="primary">Experiment</Badge>
            <h1 className="font-display text-4xl font-semibold leading-tight text-balance sm:text-5xl">
              Does telling a model who it&apos;s dealing with change how it cooperates?
            </h1>
          </div>
          <DesignDiagram />
        </header>

        {n === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            No matched LABELED/BLIND pairs recorded yet. Pairs share a seed and wealth visibility.
          </p>
        ) : (
          <>
            <HeadlineCard diff={fav.diff} n={n} positivePairs={positive} />

            <section aria-labelledby="results" className={SECTION}>
              <h2 id="results" className={H2}>Results</h2>
              <SlopeChart pairs={pairs} />
              <OutcomesTable pooled={pooled} n={n} />
              <p className="text-xs text-muted-foreground text-pretty">
                n={n} pair{n === 1 ? '' : 's'} is tiny, so every interval here is wide. Intervals come from a seeded bootstrap
                (resample pairs, then agents within each run). * marks an interval that excludes zero at this n: a lead, not a finding.
              </p>
              <Disclosure summary="Per-pair numbers and how each metric is computed">
                <PairDetails pairs={pairs} />
                <ul className="list-disc space-y-1 pl-5">
                  <li>Cooperation and favoritism: shared <code>cooperationRate</code> and <code>inGroupFavoritism</code> (in-group = true same company, also in BLIND).</li>
                  <li>Deception: lies over trade offers, checked against engine ground truth, not an LLM judge.</li>
                  <li>Inequality: Gini of final scores (0 equal, toward 1 one agent holds all).</li>
                  <li>Coalition stability: coalition joins not followed by that agent leaving.</li>
                  <li>Per-run CIs resample the {roster?.agents ?? 18} agents with replacement. A CI of exactly 100% to 100% means no defecting choice was observed.</li>
                </ul>
              </Disclosure>
            </section>
          </>
        )}

        <section aria-labelledby="controls" className={SECTION}>
          <h2 id="controls" className={H2}>Controls</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={CARD_CLASS}>
              <h3 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Held fixed in each pair</h3>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                <li>Seed</li>
                <li>Roster: {roster ? `${roster.agents} agents, ${roster.companies} labs` : '18 agents, 3 labs'}</li>
                <li>Models: {COMPANIES.map((c) => c.model.split('/')[1]).join(', ')}</li>
                <li>Prompts and rules</li>
                <li>Wealth visibility</li>
              </ul>
            </div>
            <div className={CARD_CLASS}>
              <h3 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Varies</h3>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                <li>Whether agents are shown each partner&apos;s lab</li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">Nothing else is changed. Outcomes are computed by code from engine ground truth.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="notes" className={SECTION}>
          <h2 id="notes" className="sr-only">Notes</h2>
          <Disclosure summary="Validity notes">
            <ul className="list-disc space-y-2 pl-5">
              <li><strong className="text-foreground">Small n.</strong> {n} matched pair{n === 1 ? '' : 's'}. Intervals are wide and the pair-level bootstrap has almost nothing to resample.</li>
              <li><strong className="text-foreground">Cheapest model per lab.</strong> Results may not carry to larger models.</li>
              <li><strong className="text-foreground">Ceiling effect.</strong> Cooperation is near 100% in most runs, leaving little room for favoritism to show.</li>
              <li><strong className="text-foreground">Prompt sensitivity.</strong> One prompt wording. Another could move the result.</li>
              <li><strong className="text-foreground">Eval awareness.</strong> Agents sometimes say they suspect a test, which may change behavior. We count those turns but cannot remove the effect.</li>
              <li><strong className="text-foreground">Style recognition.</strong> BLIND hides labels, not writing style, so it is a control for labels, not for family recognition.</li>
              <li><strong className="text-foreground">Behavior in a game is not evidence of intrinsic intent.</strong> These are simulated strategic choices under a prompt.</li>
            </ul>
          </Disclosure>
          <Disclosure summary="Next experiments and related work">
            <ul className="list-disc space-y-1 pl-5">
              <li>Swapped labels: tell a Claude agent its partner is GPT, to separate the label from the actual partner.</li>
              <li>Same-family vs cross-family pairings.</li>
              <li>More seeds, in both wealth-visibility settings.</li>
            </ul>
            <p className="text-xs uppercase tracking-[0.18em]">Related work flagged by a reviewer</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Prompted Identity Degrades Cooperation in Multi-Agent LLM Systems (arXiv:2609.35928), not yet read by the team.</li>
              <li>SOTOPIA</li>
              <li>MultiAgentBench</li>
            </ul>
          </Disclosure>
        </section>

        <section aria-labelledby="watch" className={SECTION}>
          <h2 id="watch" className={H2}>Watch the pairs</h2>
          {pairs.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {pairs.map((p) => (
                <li key={p.key} className={`${CARD_CLASS} flex flex-col gap-3`}>
                  <p className="text-sm font-medium">Seed {p.seed} <span className="text-muted-foreground">· {p.wealth} wealth</span></p>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/run/${p.blind.slug}`} className={buttonClass('secondary', 'px-3')}>BLIND</Link>
                    <Link href={`/run/${p.labeled.slug}`} className={buttonClass('secondary', 'px-3')}>LABELED</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/runs" className={buttonClass('primary')}>All recorded runs</Link>
            <Link href="/how-it-works" className={buttonClass('secondary')}>How it works</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
