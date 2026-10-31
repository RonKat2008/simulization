// Static geometry for the hero market visual (viewBox 0 0 640 400).
export type LabId = 'a' | 'b' | 'c'

export const VIEW = { w: 640, h: 400 } as const

export const LAB_COLORS: Record<LabId, string> = { a: '#5aa8ff', b: '#f5b13d', c: '#2fd4bd' }
export const NEUTRAL = '#7f8496'
export const VIOLATION = '#f2555a'

const CENTERS: Record<LabId, { x: number; y: number }> = {
  a: { x: 130, y: 115 },
  b: { x: 510, y: 115 },
  c: { x: 320, y: 300 },
}
const HEX_RADIUS = 46
export const HULL_RADIUS = 66

export type NodePos = { id: string; lab: LabId; x: number; y: number }

const round1 = (n: number) => Math.round(n * 10) / 10

export const NODES: NodePos[] = (Object.keys(CENTERS) as LabId[]).flatMap((lab) =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = ((-90 + 60 * i) * Math.PI) / 180
    return {
      id: `${lab}${i}`,
      lab,
      x: round1(CENTERS[lab].x + HEX_RADIUS * Math.cos(angle)),
      y: round1(CENTERS[lab].y + HEX_RADIUS * Math.sin(angle)),
    }
  }),
)

export const CLUSTERS = (Object.keys(CENTERS) as LabId[]).map((lab) => ({
  lab,
  ...CENTERS[lab],
  name: `LAB ${lab.toUpperCase()}`,
  labelY: lab === 'c' ? CENTERS[lab].y + HULL_RADIUS + 18 : CENTERS[lab].y - HULL_RADIUS - 8,
}))

export const node = (id: string): NodePos => {
  const found = NODES.find((n) => n.id === id)
  if (!found) throw new Error(`unknown node ${id}`)
  return found
}

export const AMBIENT_EDGES: [string, string][] = [
  ['a0', 'a1'], ['a2', 'a4'], ['b1', 'b3'], ['b5', 'b0'], ['c0', 'c2'], ['c3', 'c5'],
  ['a1', 'b5'], ['b3', 'c1'], ['a3', 'c5'],
]

/** The traded claim: Lab A seller offers a good to a Lab C buyer. */
export const SELLER = node('a2')
export const BUYER = node('c5')
export const REFEREE = { x: 320, y: 176 }
export const CLAIMED = 9
export const TRUE_QUALITY = 6
