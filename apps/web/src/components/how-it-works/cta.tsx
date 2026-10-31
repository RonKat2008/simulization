import { PressLink } from '../landing/reveal'
import { buttonClass } from '../landing/ui'

export function HowItWorksCta() {
  return (
    <section aria-labelledby="hiw-cta-title" className="pixel-grid">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 md:py-24">
        <h2 id="hiw-cta-title" className="font-display text-3xl font-semibold text-balance sm:text-5xl">Now watch it happen.</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PressLink href="/run/featured" className={buttonClass('primary')}>Watch the featured run</PressLink>
          <PressLink href="/runs" className={buttonClass('secondary')}>Browse runs</PressLink>
          <PressLink href="/report" className={buttonClass('secondary')}>Read the report</PressLink>
        </div>
      </div>
    </section>
  )
}
