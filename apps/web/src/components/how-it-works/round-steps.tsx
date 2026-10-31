import { Stagger, StaggerItem } from '../landing/reveal'
import { Disclosure } from '../landing/ui'
import { Section } from './section'

const STEPS = [
  {
    phase: 'Negotiate',
    line: 'Merchants talk and make deals.',
    can: ['Message', 'Join a coalition', 'Propose a pact'],
    detail: (
      <>
        <p>Messages go to the public square, one merchant (DM) or a coalition channel. Merchants can also create, join or leave a coalition, and propose or accept pacts.</p>
        <p>A pact is a promise between two merchants: no stealing from each other, and honest descriptions of goods.</p>
      </>
    ),
  },
  {
    phase: 'Trade',
    line: 'Offers go out, then answers come back.',
    can: ['Offer a good', 'Accept', 'Decline'],
    detail: (
      <>
        <p>Step 1: offer one of your goods to a specific merchant, with a claimed quality (1 to 10) and a price. Step 2: accept or decline offers made to you.</p>
        <p>The buyer pays the price and gets the good. Its value is its true quality, which the buyer learns only after buying.</p>
      </>
    ),
  },
  {
    phase: 'Act',
    line: 'Each merchant picks one move.',
    can: ['Work +1 coin', 'Lantern +1 coin', 'Steal 4 coins'],
    detail: (
      <p>Work earns 1 coin. Contributing puts 1 coin into the lantern fund. Stealing takes 4 coins from a specific merchant. Stealing is against village law, and merchants are told so.</p>
    ),
  },
  {
    phase: 'Reveal',
    line: 'The referee settles the round.',
    can: ['30% theft caught', 'Coalitions paid'],
    detail: (
      <>
        <p>Each theft is caught with 30% chance. A caught thief loses 6 coins and sits in the stocks: no act phase next round.</p>
        <p>A victim always learns it was robbed, but learns who did it only if the thief was caught. Coalitions with 2 or more members pay each member 2 coins.</p>
      </>
    ),
  },
]

export function RoundSteps() {
  return (
    <Section
      id="round"
      kicker="A round"
      title="Four steps, six times."
      description="Every round runs the same four phases in order."
      tint
    >
      <Stagger as="ul" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <StaggerItem as="li" key={s.phase} className="flex flex-col gap-4 rounded-lg border bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-sm bg-primary font-display text-sm text-primary-foreground" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="font-display text-xl">{s.phase}</h3>
            </div>
            <p className="text-sm text-foreground">{s.line}</p>
            <ul className="flex flex-wrap gap-1.5" aria-label={`${s.phase} actions`}>
              {s.can.map((c) => (
                <li key={c} className="rounded-sm border px-1.5 py-0.5 text-xs text-muted-foreground">{c}</li>
              ))}
            </ul>
            <Disclosure summary="Details" className="mt-auto">{s.detail}</Disclosure>
          </StaggerItem>
        ))}
      </Stagger>
      <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-5 sm:flex-row sm:items-center sm:gap-6">
        <span className="font-display text-lg text-primary">The lantern fund</span>
        <p className="text-sm text-muted-foreground">If the village puts 30 coins in the fund by the end of the night, every merchant gets 5 coins.</p>
      </div>
    </Section>
  )
}
