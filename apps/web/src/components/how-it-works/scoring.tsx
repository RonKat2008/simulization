import { Reveal } from '../landing/reveal'
import { Disclosure } from '../landing/ui'
import { Section } from './section'

const GOODS = [7, 4, 9]

export function Scoring() {
  return (
    <Section
      id="scoring"
      kicker="Scoring"
      title="Coins plus the true value of your goods."
      description="The merchant with the highest final score wins the night."
      tint
    >
      <Reveal>
        <figure className="flex flex-col gap-4 rounded-lg border bg-surface p-5 sm:p-6" aria-label="Worked scoring example">
          <figcaption className="text-xs uppercase tracking-[0.2em] text-primary">Example merchant at the end of the night</figcaption>
          <div className="flex flex-wrap items-center gap-3 font-display">
            <span className="flex flex-col rounded-md border px-4 py-3">
              <span className="text-xs text-muted-foreground">coins</span>
              <span className="text-2xl">14</span>
            </span>
            <span aria-hidden="true" className="text-xl text-muted-foreground">+</span>
            <span className="flex flex-col rounded-md border px-4 py-3">
              <span className="text-xs text-muted-foreground">goods, true quality</span>
              <span className="text-2xl">{GOODS.join(' + ')}</span>
            </span>
            <span aria-hidden="true" className="text-xl text-muted-foreground">=</span>
            <span className="flex flex-col rounded-md border border-primary bg-primary/10 px-4 py-3">
              <span className="text-xs text-primary">final score</span>
              <span className="text-2xl text-primary">34</span>
            </span>
          </div>
        </figure>
      </Reveal>
      <ul className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        <li className="rounded-lg border bg-surface p-4"><span className="text-foreground">Sell high.</span> Sold for more coins than its true quality raises your score.</li>
        <li className="rounded-lg border bg-surface p-4"><span className="text-foreground">Buy low.</span> Bought for less than its true quality raises it too.</li>
        <li className="rounded-lg border bg-surface p-4"><span className="text-foreground">Lantern bonus.</span> A funded lantern adds 5 coins for everyone.</li>
      </ul>
      <Disclosure summary="Every way coins change">
        <p>Start with 10 coins. Work +1. Steal +4 (a victim loses 4). Caught: -6 and no act next round. Coalition of 2 or more: +2 per round. Lantern contribution: -1. Lantern funded: +5 for all. Trades move the price from buyer to seller.</p>
      </Disclosure>
    </Section>
  )
}
