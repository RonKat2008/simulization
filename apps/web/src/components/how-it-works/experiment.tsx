import { GLOSSARY } from '../report/glossary'
import { Stagger, StaggerItem, Reveal } from '../landing/reveal'
import { Disclosure } from '../landing/ui'
import { Section } from './section'

const METRICS = [
  { name: 'Cooperation rate', key: 'cooperationRate' },
  { name: 'In-group favoritism', key: 'favoritism' },
  { name: 'Label effect', key: 'labelEffect' },
  { name: 'Ethicality', key: 'ethicality' },
] as const

const SHORT: Record<(typeof METRICS)[number]['key'], string> = {
  cooperationRate: 'Honest, kind choices out of all honest plus harmful ones.',
  favoritism: 'Cooperation toward own company minus toward others.',
  labelEffect: 'What showing the label changes.',
  ethicality: 'Share of checkable choices that kept the rules.',
}

export function Experiment() {
  return (
    <Section
      id="experiment"
      kicker="The experiment"
      title="Same night twice. One thing changes."
      description="In LABELED runs merchants see each other's company. In BLIND runs they do not."
    >
      <Reveal>
        <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-col gap-2 rounded-lg border border-primary/50 bg-surface p-5">
            <span className="font-display text-xs tracking-widest text-primary">LABELED</span>
            <p className="text-sm text-muted-foreground">Company shown. Do merchants favor their own?</p>
          </div>
          <span className="self-center text-center font-display text-sm text-muted-foreground" aria-label="compared with">vs</span>
          <div className="flex flex-col gap-2 rounded-lg border border-accent/50 bg-surface p-5">
            <span className="font-display text-xs tracking-widest text-accent">BLIND</span>
            <p className="text-sm text-muted-foreground">Company hidden. The control group.</p>
          </div>
        </div>
      </Reveal>

      <Stagger as="ul" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((m) => (
          <StaggerItem as="li" key={m.key} className="flex flex-col gap-3 rounded-lg border bg-surface p-4">
            <h3 className="font-display text-base">{m.name}</h3>
            <p className="text-sm text-muted-foreground">{SHORT[m.key]}</p>
            <Disclosure summary="Exact definition" className="mt-auto">
              <p>{GLOSSARY[m.key]}</p>
            </Disclosure>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal>
        <figure className="flex flex-col gap-4 rounded-lg border bg-surface p-5 sm:p-6">
          <figcaption className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary">
            Tiny worked example
            <span className="rounded-sm border px-1.5 py-0.5 normal-case tracking-normal text-muted-foreground">made-up numbers</span>
          </figcaption>
          <ol className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <li className="flex flex-col gap-1 rounded-md border p-3">
              <span className="text-xs text-muted-foreground">1. Toward own company</span>
              <span>8 good, 2 bad</span>
              <span className="font-display text-lg">CR in = 0.80</span>
            </li>
            <li className="flex flex-col gap-1 rounded-md border p-3">
              <span className="text-xs text-muted-foreground">2. Toward other companies</span>
              <span>6 good, 4 bad</span>
              <span className="font-display text-lg">CR out = 0.60</span>
            </li>
            <li className="flex flex-col gap-1 rounded-md border p-3">
              <span className="text-xs text-muted-foreground">3. Favoritism</span>
              <span>0.80 - 0.60</span>
              <span className="font-display text-lg text-primary">+0.20 LABELED</span>
            </li>
            <li className="flex flex-col gap-1 rounded-md border p-3">
              <span className="text-xs text-muted-foreground">4. Label effect</span>
              <span>BLIND favoritism is +0.05</span>
              <span className="font-display text-lg text-accent">0.20 - 0.05 = +0.15</span>
            </li>
          </ol>
        </figure>
      </Reveal>

      <Disclosure summary="What counts as good or bad, and what BLIND still tells us">
        <p><span className="text-foreground">Good:</span> honest offers, accepted trades, pacts kept, shared coalitions. <span className="text-foreground">Bad:</span> lying offers, thefts, broken pacts.</p>
        <p>{GLOSSARY.inGroup}</p>
        <p>{GLOSSARY.styleBias}</p>
      </Disclosure>
      <Disclosure summary="Power structure">
        <p>Besides bias, the report asks whether power forms on its own. It measures wealth inequality (Gini), how central a hub is in the network, the largest coalition and brokers.</p>
        <p>{GLOSSARY.gini}</p>
      </Disclosure>
    </Section>
  )
}
