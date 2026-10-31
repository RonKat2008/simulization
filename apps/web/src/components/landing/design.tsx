import { CountUp } from './count-up'
import { Reveal, Stagger, StaggerItem } from './reveal'
import { LandingSection } from './section-heading'
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
    <LandingSection
      id="design"
      titleId="design-title"
      index="01"
      kicker="Design"
      title="Same market. One cue removed."
      description="Two conditions, identical in every way except what each agent can see about the others."
    >
        <Stagger className="grid grid-cols-3 divide-x overflow-hidden rounded-lg border bg-surface shadow-raised">
          {STATS.map(([n, label]) => (
            <StaggerItem key={label} className="flex flex-col gap-1.5 px-4 py-6 sm:px-6 sm:py-7">
              <span className="font-mono text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
                <CountUp value={n} />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">{label}</span>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface">
              <tr className="border-b">
                <th scope="col" className="px-4 py-3 font-normal"><span className="sr-only">Factor</span></th>
                <th scope="col" className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-primary">Labeled</th>
                <th scope="col" className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-accent">Blind</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([factor, a, b], i) => (
                <tr key={factor} className={i < ROWS.length - 1 ? 'border-b' : ''}>
                  <th scope="row" className="px-4 py-3.5 font-normal text-muted-foreground">{factor}</th>
                  <td className="px-4 py-3.5 text-foreground">{a}</td>
                  <td className="px-4 py-3.5 text-foreground">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <span className="font-mono text-base text-foreground">
              <CountUp value={0.29} decimals={2} />
            </span>
          </p>
        </Disclosure>
    </LandingSection>
  )
}
