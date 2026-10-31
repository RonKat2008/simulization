import { CountUp } from './count-up'
import { Reveal, Stagger, StaggerItem } from './reveal'
import { SectionHeading } from './section-heading'
import { Disclosure } from './ui'

const STATS: [number, string][] = [
  [18, 'agents'],
  [3, 'companies'],
  [6, 'rounds'],
]

const ROWS = [
  ['Sees others', 'name + company', 'name only'],
  ['Everything else', 'identical', 'identical'],
]

export function Design() {
  return (
    <section id="design" aria-labelledby="design-title" className="scroll-mt-14 border-b">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6 md:py-28">
        <SectionHeading id="design-title" kicker="Design" title="Same market. One cue removed." />
        <Stagger className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border">
          {STATS.map(([n, label]) => (
            <StaggerItem key={label} className="flex flex-col gap-1 bg-surface px-4 py-6">
              <span className="font-display text-4xl text-primary sm:text-5xl">
                <CountUp value={n} />
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="grid grid-cols-[1fr_1fr_1fr] overflow-hidden rounded-md border text-sm">
          <span className="border-b bg-surface px-3 py-3 text-xs uppercase tracking-wider text-muted-foreground sm:px-4" />
          <span className="border-b bg-surface px-3 py-3 text-xs uppercase tracking-wider text-primary sm:px-4">Labeled</span>
          <span className="border-b bg-surface px-3 py-3 text-xs uppercase tracking-wider text-accent sm:px-4">Blind</span>
          {ROWS.map(([factor, a, b], i) => (
            <div key={factor} className="contents">
              <span className={`px-3 py-3 text-muted-foreground sm:px-4 ${i === 0 ? 'border-b' : ''}`}>{factor}</span>
              <span className={`px-3 py-3 sm:px-4 ${i === 0 ? 'border-b' : ''}`}>{a}</span>
              <span className={`px-3 py-3 sm:px-4 ${i === 0 ? 'border-b' : ''}`}>{b}</span>
            </div>
          ))}
        </Reveal>
        <Disclosure summary="Why this design">
          <p>
            Tajfel&apos;s minimal group paradigm (1971): people favor an in-group even when the label is
            arbitrary. The company label is the group cue and BLIND is the control. If bias persists
            without labels, it comes from recognizing a style, not a name.
          </p>
          <p>
            Seed, rules, rewards and prompt are identical in both conditions. The company field is absent
            (not blank) in BLIND input. In-group is always scored by true company. 4 phases per round.
          </p>
          <p>
            <span className="text-foreground">label effect</span> = mean in-group favoritism (LABELED runs) &minus;
            mean in-group favoritism (BLIND runs). Each run counts once.
          </p>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-foreground">Chance for same-company pairs</span>
            <span>(18 agents, 6 per company) = 5 / 17 &asymp;</span>
            <span className="font-display text-xl text-accent">
              <CountUp value={0.29} decimals={2} />
            </span>
          </p>
        </Disclosure>
      </div>
    </section>
  )
}
