import type { ReactNode } from 'react'
import { LandingSection } from '../landing/section-heading'

/** One explainer section: heading rail on the left, content on the right (same layout as home). */
export function Section({
  id,
  index,
  kicker,
  title,
  description,
  children,
}: {
  id: string
  index: string
  kicker: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <LandingSection id={id} titleId={`${id}-title`} index={index} kicker={kicker} title={title} description={description}>
      {children}
    </LandingSection>
  )
}

export const LAB = [
  { id: 'A', company: 'Anthropic', model: 'Claude Haiku', bg: 'bg-lab-a', text: 'text-lab-a' },
  { id: 'B', company: 'OpenAI', model: 'GPT nano', bg: 'bg-lab-b', text: 'text-lab-b' },
  { id: 'C', company: 'Google', model: 'Gemini flash-lite', bg: 'bg-lab-c', text: 'text-lab-c' },
] as const
