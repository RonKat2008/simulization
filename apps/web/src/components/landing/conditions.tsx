import { SectionHeading } from './section-heading'

const ROSTER = [
  { name: 'Wren', lab: 'A', swatch: 'bg-lab-a', text: 'text-lab-a' },
  { name: 'Moss', lab: 'B', swatch: 'bg-lab-b', text: 'text-lab-b' },
  { name: 'Ember', lab: 'C', swatch: 'bg-lab-c', text: 'text-lab-c' },
  { name: 'Quill', lab: 'A', swatch: 'bg-lab-a', text: 'text-lab-a' },
]

type Condition = {
  name: 'LABELED' | 'BLIND'
  summary: string
  showLab: boolean
}

const CONDITIONS: Condition[] = [
  {
    name: 'LABELED',
    summary: 'Agents see which lab built every other agent. In-group favoritism has a cue to latch onto.',
    showLab: true,
  },
  {
    name: 'BLIND',
    summary: 'Agents see names only; the lab field is absent, not blank. Any remaining gap comes from style or behavior, not from the label.',
    showLab: false,
  },
]

function ConditionPanel({ condition }: { condition: Condition }) {
  return (
    <article
      className="flex flex-col gap-6 rounded-lg border bg-surface p-6 transition-colors hover:border-accent/50 sm:p-8"
      aria-labelledby={`cond-${condition.name}`}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h3 id={`cond-${condition.name}`} className="font-display text-2xl font-semibold tracking-wider">
            {condition.name}
          </h3>
          <span className="rounded-sm border px-2 py-0.5 text-xs text-muted-foreground">
            {condition.showLab ? 'name + lab' : 'name only'}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{condition.summary}</p>
      </header>

      <div className="rounded-md border bg-background">
        <p className="border-b px-4 py-2 text-xs text-muted-foreground">
          {'agent view · nearby stalls'}
        </p>
        <ul className="flex flex-col">
          {ROSTER.map((agent) => (
            <li
              key={agent.name}
              className="flex items-center justify-between gap-4 border-b px-4 py-2.5 text-sm last:border-b-0"
            >
              <span className="flex items-center gap-3">
                <span
                  className={`size-2.5 ${condition.showLab ? agent.swatch : 'bg-muted-foreground/40'}`}
                  aria-hidden="true"
                />
                {agent.name}
              </span>
              {condition.showLab ? (
                <span className={`text-xs ${agent.text}`}>{`Lab ${agent.lab}`}</span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  <span aria-hidden="true">{'— — —'}</span>
                  <span className="sr-only">lab hidden</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export function Conditions() {
  return (
    <section id="conditions" aria-labelledby="conditions-title" className="scroll-mt-14 border-b">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <SectionHeading
          id="conditions-title"
          kicker="Two conditions"
          title="Same market. Same seed. One label removed."
          description="Both conditions share the same prompt, rules, rewards, and seeded world generation. The only thing that changes is whether agents can see who made whom. Metrics always score in-group by true lab."
        />
        <div className="grid gap-6 md:grid-cols-2">
          {CONDITIONS.map((c) => (
            <ConditionPanel key={c.name} condition={c} />
          ))}
        </div>
        <div className="rounded-md border bg-surface px-5 py-4">
          <p className="text-sm">
            <span className="text-muted-foreground">{'label effect  = '}</span>
            <span className="text-primary">metric</span>
            <span className="text-muted-foreground">(LABELED)</span>
            <span className="text-muted-foreground">{'  −  '}</span>
            <span className="text-primary">metric</span>
            <span className="text-muted-foreground">(BLIND)</span>
          </p>
        </div>
      </div>
    </section>
  )
}
