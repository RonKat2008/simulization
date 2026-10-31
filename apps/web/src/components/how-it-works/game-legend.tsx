import { Stagger, StaggerItem } from '../landing/reveal'
import { Disclosure } from '../landing/ui'
import { Section, LAB } from './section'

// Mirrors LINK_COLOR in src/game/narrate.ts (relationship arcs, colored by action type, never by company).
const ARCS = [
  ['#f3efe2', 'Talking'],
  ['#ff7eb6', 'Pact'],
  ['#ffe14d', 'Offer on the table'],
  ['#a3e635', 'Deal done'],
  ['#8a93a8', 'Offer declined'],
  ['#e5484d', 'Violation'],
] as const

const PLACES = [
  ['Market square', 'center'],
  ['6 stalls', 'top row'],
  ['6 coalition tents', 'bottom row'],
  ['Lantern shrine', 'right'],
  ['Stocks', 'left'],
]

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-surface p-5">
      <h3 className="font-display text-lg">{title}</h3>
      {children}
    </div>
  )
}

export function GameLegend() {
  return (
    <Section
      id="game-view"
      kicker="Reading the game view"
      title="What the village is showing you."
      description="Everything on screen comes from the referee's event log."
      tint
    >
      <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StaggerItem>
          <Card title="Places">
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {PLACES.map(([p, where]) => (
                <li key={p} className="flex justify-between gap-3"><span className="text-foreground">{p}</span><span>{where}</span></li>
              ))}
            </ul>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card title="Cloak color">
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {LAB.map((l) => (
                <li key={l.id} className="flex items-center gap-2"><span aria-hidden="true" className={`size-3 ${l.bg}`} />{l.company}</li>
              ))}
              <li className="flex items-center gap-2"><span aria-hidden="true" className="size-3 bg-muted-foreground" />Gray in BLIND: company hidden</li>
            </ul>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card title="Lines between merchants">
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {ARCS.map(([c, label]) => (
                <li key={label} className="flex items-center gap-3">
                  <span aria-hidden="true" className="h-0.5 w-8" style={{ backgroundColor: c }} />
                  {label}
                </li>
              ))}
            </ul>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card title="Bubbles and icons">
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li><span className="text-foreground">Bubble</span> over a merchant: its latest action in a few words.</li>
              <li><span className="text-violation">Red outline</span> or a LIE tag: the referee checked and the claim was false.</li>
              <li><span className="text-foreground">Heart</span> = pact. <span className="text-violation">Cracked heart</span> = broken pact.</li>
            </ul>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card title="Lantern glow">
            <p className="text-sm text-muted-foreground">Each merchant&rsquo;s lantern gets brighter the more coins it has compared with the richest merchant.</p>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card title="Red and pink">
            <p className="text-sm text-muted-foreground"><span className="text-violation">Red</span> is only for violations the simulator verified. <span className="text-accent">Pink</span> tags a turn that mentions a test.</p>
          </Card>
        </StaggerItem>
      </Stagger>
      <Disclosure summary="Observer view and keyboard shortcuts">
        <p>You watch as an observer, so lies and private plans are visible to you that merchants cannot see. In BLIND runs the view hides company colors but metrics still use true companies.</p>
        <p>Press <kbd className="rounded-sm border px-1.5 font-display text-xs text-foreground">?</kbd> in the game view for the guide and shortcuts.</p>
      </Disclosure>
    </Section>
  )
}
