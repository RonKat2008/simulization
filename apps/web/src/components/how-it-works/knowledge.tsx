import { Stagger, StaggerItem } from '../landing/reveal'
import { Disclosure } from '../landing/ui'
import { Section } from './section'

const COLUMNS = [
  {
    title: 'A merchant knows',
    tone: 'text-primary',
    items: ['Its own goods, with true quality', 'Its own coins, pacts and coalition', 'Messages and offers sent to it', 'The lantern fund total'],
  },
  {
    title: 'A merchant does not know',
    tone: 'text-muted-foreground',
    items: ['True quality of anyone else’s goods', 'Anyone’s private plan', 'Whether a claim is a lie, until it buys'],
  },
  {
    title: 'Only the referee knows',
    tone: 'text-violation',
    items: ['Every true quality', 'Every lie, theft and broken pact', 'Who is mentioning a test'],
  },
]

export function Knowledge() {
  return (
    <Section
      id="knowledge"
      kicker="Who knows what"
      title="Merchants see little. The referee sees everything."
      description="The referee is the simulator: it checks every action against ground truth, so no model has to judge."
    >
      <Stagger as="ul" className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((c) => (
          <StaggerItem as="li" key={c.title} className="flex flex-col gap-3 rounded-lg border bg-surface p-5">
            <h3 className={`font-display text-lg ${c.tone}`}>{c.title}</h3>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {c.items.map((it) => (
                <li key={it} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 size-1 shrink-0 bg-border" />
                  {it}
                </li>
              ))}
            </ul>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border bg-surface p-5">
          <h3 className="font-display text-lg">Company label</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <p className="flex flex-col gap-1 rounded-md border border-primary/50 p-3">
              <span className="font-display text-xs tracking-widest text-primary">LABELED</span>
              <span className="text-muted-foreground">Merchants see each other&rsquo;s company.</span>
            </p>
            <p className="flex flex-col gap-1 rounded-md border border-accent/50 p-3">
              <span className="font-display text-xs tracking-widest text-accent">BLIND</span>
              <span className="text-muted-foreground">Names only. Company is absent.</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border bg-surface p-5">
          <h3 className="font-display text-lg">Messages</h3>
          <p className="text-sm text-muted-foreground">Public, DM and coalition messages reach their recipients. A merchant&rsquo;s private plan reaches no one, but you can read it in the game view.</p>
        </div>
      </div>

      <Disclosure summary="Can merchants see each other's coins?">
        <p>It depends on a run setting. With wealth private (the default), merchants cannot see each other&rsquo;s coin balances. With wealth public, they can.</p>
        <p>Merchants never see each other&rsquo;s goods quality either way.</p>
      </Disclosure>
    </Section>
  )
}
