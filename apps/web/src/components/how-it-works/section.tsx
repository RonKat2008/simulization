import type { ReactNode } from 'react'
import { SectionHeading } from '../landing/section-heading'

/** One explainer section: shared rhythm, heading and anchor target. */
export function Section({
  id,
  kicker,
  title,
  description,
  children,
  tint = false,
}: {
  id: string
  kicker: string
  title: string
  description?: string
  children: ReactNode
  tint?: boolean
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-14 border-b ${tint ? 'bg-surface/40' : ''}`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 md:py-24">
        <SectionHeading id={`${id}-title`} kicker={kicker} title={title} description={description} />
        {children}
      </div>
    </section>
  )
}

export const LAB = [
  { id: 'A', company: 'Anthropic', model: 'Claude Haiku', bg: 'bg-lab-a', text: 'text-lab-a' },
  { id: 'B', company: 'OpenAI', model: 'GPT nano', bg: 'bg-lab-b', text: 'text-lab-b' },
  { id: 'C', company: 'Google', model: 'Gemini flash-lite', bg: 'bg-lab-c', text: 'text-lab-c' },
] as const
