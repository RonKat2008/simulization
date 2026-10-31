'use client'

import { motion } from 'motion/react'
import { motionTokens } from './motion-tokens'

/** Token-by-token reveal of a formula line when scrolled into view. */
export function FormulaReveal({ tokens }: { tokens: { text: string; strong?: boolean }[] }) {
  return (
    <motion.p
      className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
    >
      {tokens.map((t, i) => (
        <motion.span
          key={`${t.text}-${i}`}
          className={t.strong ? 'text-foreground' : undefined}
          variants={{
            hidden: { opacity: 0, y: motionTokens.distance.sm },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth },
            },
          }}
        >
          {t.text}
        </motion.span>
      ))}
    </motion.p>
  )
}
