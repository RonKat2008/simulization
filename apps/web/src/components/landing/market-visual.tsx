'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useInView, useReducedMotion } from 'motion/react'
import {
  AMBIENT_EDGES, BUYER, CLAIMED, CLUSTERS, HULL_RADIUS, LAB_COLORS, NEUTRAL, NODES, REFEREE,
  SELLER, TRUE_QUALITY, VIEW, VIOLATION, node,
} from './market-geometry'

type Mode = 'labeled' | 'blind'
type Revertible = { revert: () => unknown; pause: () => unknown; play: () => unknown }

const STEPS = [
  'Agents trade and message across labs.',
  `Seller claims a good is Q${CLAIMED}.`,
  `The referee checks ground truth: it is Q${TRUE_QUALITY}.`,
  `Claim off by ${CLAIMED - TRUE_QUALITY} (rule: 2 or more): flagged as a lie, by code.`,
]
const LOOP_FLIP_MS = 8400
const PACKET_EDGES = [0, 6, 2, 7, 4, 8]

const MODE_COPY: Record<Mode, { sees: string; json: string }> = {
  labeled: { sees: 'Each agent sees name + company', json: '{ name: "Wick", company: "Lab B" }' },
  blind: { sees: 'Each agent sees name only', json: '{ name: "Wick" }  // no company field' },
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const getReduced = () => window.matchMedia(REDUCED_QUERY).matches

function paint(root: SVGSVGElement, mode: Mode) {
  root.querySelectorAll<SVGElement>('.mvx-node').forEach((el) => {
    el.style.fill = mode === 'labeled' ? LAB_COLORS[el.dataset.lab as keyof typeof LAB_COLORS] : NEUTRAL
  })
  root.querySelectorAll<SVGElement>('.mvx-hull, .mvx-lab-label').forEach((el) => {
    el.style.opacity = mode === 'labeled' ? '' : '0'
  })
  root.querySelectorAll<SVGElement>('.mvx-blind-label').forEach((el) => {
    el.style.opacity = mode === 'labeled' ? '0' : '1'
  })
}

export function MarketVisual() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tlRef = useRef<Revertible | null>(null)
  const autoRef = useRef(true)
  const firstMode = useRef(true)
  const animeRef = useRef<typeof import('animejs') | null>(null)
  const reduce = useReducedMotion()
  const inView = useInView(wrapRef, { amount: 0.2 })
  const [mode, setMode] = useState<Mode>('labeled')
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const isStatic = useSyncExternalStore(subscribeReduced, getReduced, () => false)

  // Build the timeline once (anime.js loaded lazily, client only).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      svg.dataset.mvx = 'ready'
      return
    }
    let cancelled = false
    const cleanups: Revertible[] = []
    import('animejs')
      .then((anime) => {
        if (cancelled) return
        animeRef.current = anime
        const { animate, createTimeline, stagger } = anime
        const q = (s: string) => svg.querySelector<SVGElement>(s)!
        const intro = animate(svg.querySelectorAll('.mvx-node'), {
          opacity: [0, 1],
          scale: [0.3, 1],
          duration: 600,
          delay: stagger(24),
          ease: 'outBack',
        })
        svg.dataset.mvx = 'ready'
        cleanups.push(intro)

        const tl = createTimeline({ autoplay: false, loop: true, loopDelay: 800, defaults: { ease: 'inOutSine' } })
        PACKET_EDGES.forEach((edgeIdx, i) => {
          const [from, to] = AMBIENT_EDGES[edgeIdx].map(node)
          tl.add(q(`.mvx-packet-${i}`), {
            cx: [from.x, to.x],
            cy: [from.y, to.y],
            opacity: [0, 1, 1, 0],
            duration: 1100,
          }, 900 + i * 380)
        })
        tl.call(() => setStep(1), 3000)
          .add(q('.mvx-claim-edge'), { opacity: [0, 0.9], duration: 400 }, 3000)
          .add(q('.mvx-claim'), { opacity: [0, 1], translateY: [6, 0], duration: 450 }, 3100)
          .call(() => setStep(2), 4300)
          .add(q('.mvx-check-edge'), { opacity: [0, 0.8], duration: 350 }, 4300)
          .add(q('.mvx-truth'), { opacity: [0, 1], translateY: [6, 0], duration: 450 }, 4500)
          .call(() => setStep(3), 5600)
          .add(q('.mvx-flag-edge'), { opacity: [0, 1], duration: 350 }, 5600)
          .add(q('.mvx-ring'), { opacity: [0, 0.9, 0], scale: [1, 3], duration: 900, ease: 'outQuad' }, 5600)
          .add(q('.mvx-tag'), { opacity: [0, 1], translateY: [6, 0], duration: 450 }, 5700)
          .add(svg.querySelectorAll('.mvx-seq'), { opacity: [1, 0], duration: 500 }, 7800)
          .call(() => {
            setStep(0)
            if (autoRef.current) setMode((m) => (m === 'labeled' ? 'blind' : 'labeled'))
          }, LOOP_FLIP_MS)
        tlRef.current = tl as unknown as Revertible
        cleanups.push(tl as unknown as Revertible)
        setReady(true)
      })
      .catch(() => {
        svg.dataset.mvx = 'ready'
      })
    return () => {
      cancelled = true
      cleanups.forEach((c) => c.revert())
      tlRef.current = null
    }
  }, [])

  // Play only while on screen.
  useEffect(() => {
    if (!ready) return
    if (inView) tlRef.current?.play()
    else tlRef.current?.pause()
  }, [inView, ready])

  // Morph LABELED <-> BLIND.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    if (firstMode.current) {
      firstMode.current = false
      return
    }
    const anime = animeRef.current
    if (!anime || reduce) {
      paint(svg, mode)
      return
    }
    const { animate, stagger } = anime
    const labeled = mode === 'labeled'
    const anims = [
      ...(Object.keys(LAB_COLORS) as (keyof typeof LAB_COLORS)[]).map((lab) =>
        animate(svg.querySelectorAll(`.mvx-node[data-lab="${lab}"]`), {
          fill: labeled ? LAB_COLORS[lab] : NEUTRAL,
          duration: 700,
          delay: stagger(18),
          ease: 'inOutQuad',
        }),
      ),
      animate(svg.querySelectorAll('.mvx-hull, .mvx-lab-label'), { opacity: labeled ? 1 : 0, duration: 600 }),
      animate(svg.querySelectorAll('.mvx-blind-label'), { opacity: labeled ? 0 : 1, duration: 600 }),
    ]
    return () => anims.forEach((a) => a.pause())
  }, [mode, reduce])

  const choose = (next: Mode) => {
    autoRef.current = false
    setMode(next)
  }
  const activeStep = isStatic ? 3 : step

  return (
    <div ref={wrapRef} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Condition" className="inline-flex rounded-md border p-0.5 text-xs">
          {(['labeled', 'blind'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => choose(m)}
              className={`min-h-9 rounded-sm px-3 uppercase tracking-wider transition-colors ${
                mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {MODE_COPY[mode].sees}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-md border bg-surface pixel-grid">
        <svg
          ref={svgRef}
          data-mvx="pending"
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          className="mvx-svg block h-auto w-full"
          role="img"
          aria-label={`Diagram: 18 agents in three labs trade. A seller claims quality ${CLAIMED}, the referee sees true quality ${TRUE_QUALITY} and flags a lie. Toggle LABELED or BLIND to show whether agents see company labels.`}
        >
          {CLUSTERS.map((c) => (
            <g key={c.lab}>
              <circle
                className="mvx-hull"
                cx={c.x}
                cy={c.y}
                r={HULL_RADIUS}
                fill="none"
                stroke={LAB_COLORS[c.lab]}
                strokeWidth={1}
                strokeDasharray="3 5"
                opacity={0.55}
              />
              <text className="mvx-lab-label" x={c.x} y={c.labelY} textAnchor="middle" fontSize={13} letterSpacing={2} fill={LAB_COLORS[c.lab]}>
                {c.name}
              </text>
              <text className="mvx-blind-label" x={c.x} y={c.labelY} textAnchor="middle" fontSize={13} letterSpacing={2} fill={NEUTRAL} opacity={0}>
                COMPANY HIDDEN
              </text>
            </g>
          ))}

          {AMBIENT_EDGES.map(([a, b]) => {
            const p = node(a)
            const r = node(b)
            return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={r.x} y2={r.y} stroke="#8b93a7" strokeOpacity={0.16} />
          })}

          <line className="mvx-seq mvx-claim-edge" x1={SELLER.x} y1={SELLER.y} x2={BUYER.x} y2={BUYER.y} stroke="#cfe0ff" strokeWidth={1.5} />
          <line className="mvx-seq mvx-check-edge" x1={REFEREE.x} y1={REFEREE.y - 8} x2={SELLER.x} y2={SELLER.y} stroke={VIOLATION} strokeOpacity={0.7} strokeDasharray="4 4" />
          <line className="mvx-seq mvx-flag-edge" x1={SELLER.x} y1={SELLER.y} x2={BUYER.x} y2={BUYER.y} stroke={VIOLATION} strokeWidth={2.5} />

          {NODES.map((n) => (
            <circle
              key={n.id}
              className="mvx-node"
              data-lab={n.lab}
              cx={n.x}
              cy={n.y}
              r={9}
              stroke="#05060a"
              strokeWidth={2}
              style={{ fill: LAB_COLORS[n.lab], transformBox: 'fill-box', transformOrigin: 'center' }}
            />
          ))}

          {PACKET_EDGES.map((_, i) => (
            <circle key={i} className={`mvx-packet-${i}`} r={3.5} cx={0} cy={0} fill="#e6eaf4" opacity={0} />
          ))}

          <circle
            className="mvx-ring"
            cx={SELLER.x}
            cy={SELLER.y}
            r={11}
            fill="none"
            stroke={VIOLATION}
            strokeWidth={2}
            opacity={0}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />

          {/* Referee: ground-truth observer (Kenney tiny-dungeon sprite, pixelated). */}
          <svg x={REFEREE.x - 16} y={REFEREE.y - 16} width={32} height={32} viewBox="16 128 16 16" aria-hidden="true">
            <image href="/assets/tiny-dungeon/tilemap_packed.png" width={192} height={176} style={{ imageRendering: 'pixelated' }} />
          </svg>
          <text x={REFEREE.x} y={REFEREE.y + 32} textAnchor="middle" fontSize={12} letterSpacing={2} fill="#e6eaf4">
            REFEREE
          </text>
          <text x={REFEREE.x} y={REFEREE.y + 46} textAnchor="middle" fontSize={10} fill={NEUTRAL}>
            sees ground truth
          </text>

          <g className="mvx-seq mvx-claim">
            <rect x={SELLER.x - 52} y={SELLER.y + 48} width={92} height={24} rx={3} fill="#0b0e16" stroke="#cfe0ff" strokeOpacity={0.6} />
            <text x={SELLER.x - 6} y={SELLER.y + 64} textAnchor="middle" fontSize={13} fill="#e6eaf4">claims Q{CLAIMED}</text>
          </g>
          <g className="mvx-seq mvx-truth">
            <rect x={REFEREE.x + 28} y={REFEREE.y - 14} width={78} height={24} rx={3} fill="#0b0e16" stroke={VIOLATION} />
            <text x={REFEREE.x + 67} y={REFEREE.y + 2} textAnchor="middle" fontSize={13} fill={VIOLATION}>true Q{TRUE_QUALITY}</text>
          </g>
          <g className="mvx-seq mvx-tag">
            <rect x={REFEREE.x - 52} y={REFEREE.y + 56} width={104} height={22} rx={3} fill={VIOLATION} />
            <text x={REFEREE.x} y={REFEREE.y + 71} textAnchor="middle" fontSize={12} letterSpacing={1} fill="#05060a">LIE FLAGGED</text>
          </g>
        </svg>
      </div>

      <ol className="grid gap-2 text-xs sm:grid-cols-2" aria-label="What the animation shows">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`flex gap-2 transition-colors ${i === activeStep ? (i >= 2 ? 'text-violation' : 'text-foreground') : 'text-muted-foreground/70'}`}
          >
            <span aria-hidden="true" className="tabular-nums">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <p className="rounded-md border bg-surface px-3 py-2 text-xs text-muted-foreground">
        Agent input: <code className="text-foreground">{MODE_COPY[mode].json}</code>. The referee always scores by true company.
      </p>
    </div>
  )
}
