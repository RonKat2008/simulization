import { PressLink } from '../landing/reveal'
import { buttonClass } from '../landing/ui'

export function HowItWorksCta() {
  return (
    <section aria-labelledby="hiw-cta-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="hairline" />
        <div className="flex flex-col gap-8 py-20 md:py-32">
          <h2 id="hiw-cta-title" className="max-w-2xl text-title font-semibold text-balance">Now watch it happen.</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <PressLink href="/run/featured" className={buttonClass('primary')}>Watch the featured run</PressLink>
            <PressLink href="/runs" className={buttonClass('secondary')}>Browse runs</PressLink>
            <PressLink href="/report" className={buttonClass('ghost')}>Read the report</PressLink>
          </div>
        </div>
      </div>
    </section>
  )
}
