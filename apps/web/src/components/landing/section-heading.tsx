import type { ReactNode } from 'react'
import { Eyebrow } from './ui'

type SectionHeadingProps = {
  id: string
  kicker: string
  title: string
  description?: string
  index?: string
}

export function SectionHeading({ id, kicker, title, description, index }: SectionHeadingProps) {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Eyebrow index={index}>{kicker}</Eyebrow>
      <h2 id={id} className="text-title font-semibold text-foreground">
        {title}
      </h2>
      {description && (
        <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

/** Landing section shell: heading rail on the left (sticky on wide screens), content on the right. */
export function LandingSection({
  id,
  titleId,
  index,
  kicker,
  title,
  description,
  children,
}: {
  id: string
  titleId: string
  index: string
  kicker: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={titleId} className="scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="hairline" />
        <div className="grid gap-10 py-16 md:py-28 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <SectionHeading id={titleId} index={index} kicker={kicker} title={title} description={description} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">{children}</div>
        </div>
      </div>
    </section>
  )
}
