'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { MotionConfig, motion, type Variants } from 'motion/react'
import { motionTokens, springs } from './motion-tokens'

/** Honors prefers-reduced-motion for every motion component below (transforms off, opacity kept). */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

const VIEWPORT = { once: true, margin: '-80px' } as const

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: motionTokens.stagger, delayChildren: 0.05 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: motionTokens.distance.md },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth },
  },
}

type StaggerTag = 'div' | 'ul' | 'dl' | 'tbody'
type ItemTag = 'div' | 'li' | 'tr'

const staggerTags = { div: motion.div, ul: motion.ul, dl: motion.dl, tbody: motion.tbody }
const itemTags = { div: motion.div, li: motion.li, tr: motion.tr }

/** Container that reveals its StaggerItem children in sequence when scrolled into view. */
export function Stagger({
  as = 'div',
  className,
  children,
}: {
  as?: StaggerTag
  className?: string
  children: ReactNode
}) {
  const Tag = staggerTags[as] as typeof motion.div
  return (
    <Tag
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
    >
      {children}
    </Tag>
  )
}

export function StaggerItem({
  as = 'div',
  className,
  lift = false,
  children,
}: {
  as?: ItemTag
  className?: string
  /** Subtle hover lift for card-like items (transform only). */
  lift?: boolean
  children: ReactNode
}) {
  const Tag = itemTags[as] as typeof motion.div
  return (
    <Tag
      className={className}
      variants={itemVariants}
      whileHover={lift ? { y: -motionTokens.distance.xs / 2 } : undefined}
      transition={lift ? springs.snappy : undefined}
    >
      {children}
    </Tag>
  )
}

/** Single element fade/rise on scroll into view. */
export function Reveal({
  className,
  delay = 0,
  children,
}: {
  className?: string
  delay?: number
  children: ReactNode
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: motionTokens.distance.md }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth, delay }}
    >
      {children}
    </motion.div>
  )
}

const MotionLink = motion.create(Link)

/** Next Link with hover lift and press feedback. */
export function PressLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  return (
    <MotionLink
      href={href}
      className={className}
      whileHover={{ scale: motionTokens.scale.pop }}
      whileTap={{ scale: motionTokens.scale.press }}
      transition={springs.snappy}
    >
      {children}
    </MotionLink>
  )
}
