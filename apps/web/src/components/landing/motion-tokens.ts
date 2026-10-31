// Shared motion tokens and spring presets for the landing page (motion/react).
export const motionTokens = {
  duration: { instant: 0.08, fast: 0.18, normal: 0.35, slow: 0.6, crawl: 1.0 },
  easing: { smooth: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  distance: { xs: 4, sm: 8, md: 16, lg: 24 },
  scale: { subtle: 0.98, press: 0.97, pop: 1.03 },
  stagger: 0.08,
} as const

export const springs = {
  snappy: { type: 'spring', stiffness: 300, damping: 30 },
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
} as const
