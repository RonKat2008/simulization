import { CountUp } from './count-up'
import { FormulaReveal } from './formula-reveal'
import { Reveal, Stagger, StaggerItem } from './reveal'
import { SectionHeading } from './section-heading'

const STATS: [number, string][] = [
  [18, 'agents'],
  [3, 'AI companies'],
  [6, 'rounds'],
  [4, 'phases per round'],
]

const ROWS = [
  ['Seed, rules, rewards, prompt', 'identical', 'identical'],
  ['Agent sees other agents', 'name + company', 'name only'],
  ['Company field in agent input', 'present', 'absent (not blank)'],
  ['In-group scored by', 'true company', 'true company'],
]

export function Design() {
  return (
    <section id="design" aria-labelledby="design-title" className="scroll-mt-14 border-b">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 md:py-24">
        <SectionHeading
          id="design-title"
          kicker="Design"
          title="Same market, same seeds. One cue removed."
          description="Tajfel's minimal group paradigm (1971) showed that people favor an in-group even when the label is arbitrary. Here the company label is the group cue and BLIND is the control: if bias persists without labels, it comes from recognizing a style, not a name."
        />
        <Stagger className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">
          {STATS.map(([n, label]) => (
            <StaggerItem key={label} className="flex flex-col gap-1 bg-surface px-4 py-4">
              <span className="font-display text-3xl text-primary">
                <CountUp value={n} />
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b bg-surface text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">Factor</th>
                <th scope="col" className="px-4 py-3 font-normal text-primary">LABELED</th>
                <th scope="col" className="px-4 py-3 font-normal text-accent">BLIND</th>
              </tr>
            </thead>
            <Stagger as="tbody">
              {ROWS.map(([factor, a, b]) => (
                <StaggerItem as="tr" key={factor} className="border-b last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-normal text-muted-foreground">{factor}</th>
                  <td className="px-4 py-3">{a}</td>
                  <td className="px-4 py-3">{b}</td>
                </StaggerItem>
              ))}
            </Stagger>
          </table>
        </Reveal>
        <div className="flex flex-col gap-3">
          <FormulaReveal
            tokens={[
              { text: 'label effect', strong: true },
              { text: '=' },
              { text: 'mean in-group favoritism (LABELED runs)' },
              { text: '\u2212' },
              { text: 'mean in-group favoritism (BLIND runs).' },
              { text: 'Each run counts once.' },
            ]}
          />
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
            <span className="text-foreground">chance level for same-company pairs</span>
            <span>(18 agents, 6 per company) = 5 / 17 &asymp;</span>
            <span className="font-display text-xl text-accent">
              <CountUp value={0.29} decimals={2} />
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
