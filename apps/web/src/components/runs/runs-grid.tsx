'use client'

import { MotionConfig, motion, type Variants } from 'motion/react'
import { motionTokens } from '@/components/landing/motion-tokens'
import { groupRuns } from './group-runs'
import { RunCard } from './run-card'
import type { RunEntry, RunPair } from './types'

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: motionTokens.stagger } },
}
const item: Variants = {
  hidden: { opacity: 0, y: motionTokens.distance.md },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth },
  },
}

function PairBlock({ pair }: { pair: RunPair }) {
  const cards = [pair.labeled, pair.blind].filter((e): e is RunEntry => e !== null)
  return (
    <motion.li
      variants={item}
      className="rounded-md border border-dashed p-3 sm:col-span-2 sm:p-4"
      aria-label={`Matched pair, seed ${pair.seed}, wealth ${pair.wealth}`}
    >
      <p className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="tracking-wider">
          MATCHED PAIR <span aria-hidden="true">·</span> seed {pair.seed} <span aria-hidden="true">·</span> wealth {pair.wealth}
        </span>
        <span>Compare: same seed, labeled vs blind</span>
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((entry) => (
          <li key={entry.slug}>
            <RunCard entry={entry} />
          </li>
        ))}
      </ul>
    </motion.li>
  )
}

export function RunsGrid({ runs }: { runs: RunEntry[] }) {
  const groups = groupRuns(runs)
  return (
    <MotionConfig reducedMotion="user">
      <motion.ul
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {groups.map((g) =>
          g.kind === 'pair' ? (
            <PairBlock key={g.pair.key} pair={g.pair} />
          ) : (
            <motion.li key={g.entry.slug} variants={item}>
              <RunCard entry={g.entry} />
            </motion.li>
          ),
        )}
      </motion.ul>
    </MotionConfig>
  )
}
