'use client'

import { useLayoutEffect, useRef } from 'react'
import { animate, useInView, useReducedMotion } from 'motion/react'
import { motionTokens } from './motion-tokens'

/**
 * Number that counts from 0 to `value` once scrolled into view. The server renders the
 * final value (no layout shift, no hydration mismatch); reduced motion keeps it static.
 */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduce = useReducedMotion()
  const fmt = (n: number) => n.toFixed(decimals)

  useLayoutEffect(() => {
    if (!reduce && ref.current) ref.current.textContent = fmt(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce])

  useLayoutEffect(() => {
    if (reduce || !inView) return
    const controls = animate(0, value, {
      duration: motionTokens.duration.crawl * 1.2,
      ease: motionTokens.easing.smooth,
      onUpdate: (n) => {
        if (ref.current) ref.current.textContent = fmt(n)
      },
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, value])

  return (
    <span ref={ref} className="tabular-nums">
      {fmt(value)}
    </span>
  )
}
