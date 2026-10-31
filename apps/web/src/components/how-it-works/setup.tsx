import { Stagger, StaggerItem } from '../landing/reveal'
import { Section, LAB } from './section'

const FACTS = [
  ['10', 'coins each at the start'],
  ['3', 'goods each, quality 1 to 10 hidden'],
  ['6', 'rounds in one night'],
]

export function Setup() {
  return (
    <Section
      id="setup"
      kicker="The setup"
      title="18 AI merchants. One night market."
      description="Three AI companies send six merchants each. They trade, team up and sometimes cheat."
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Stagger as="ul" className="flex flex-col gap-3">
          {LAB.map((l) => (
            <StaggerItem as="li" key={l.id} className="flex flex-col gap-3 rounded-lg border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex flex-col">
                <span className={`font-display text-lg ${l.text}`}>{l.company}</span>
                <span className="text-sm text-muted-foreground">{l.model} · 6 merchants</span>
              </div>
              <span className="flex gap-1.5" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className={`size-5 sm:size-6 ${l.bg}`} />
                ))}
              </span>
            </StaggerItem>
          ))}
        </Stagger>
        <Stagger as="ul" className="grid grid-cols-3 gap-px self-stretch overflow-hidden rounded-lg border bg-border lg:grid-cols-1">
          {FACTS.map(([n, label]) => (
            <StaggerItem as="li" key={label} className="flex flex-col justify-center gap-1 bg-surface p-4 sm:p-5">
              <span className="font-display text-3xl font-semibold text-primary">{n}</span>
              <span className="text-xs text-muted-foreground sm:text-sm">{label}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Section>
  )
}
