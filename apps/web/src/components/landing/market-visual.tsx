/** Kenney Tiny Dungeon (CC0), frame 85: the shared villager body. Lab = lantern colour. */
const SPRITE_SHEET = '/assets/tiny-dungeon/tilemap_packed.png'
const SPRITE_VIEWBOX = '16 112 16 16'

const CX = 300
const CY = 245
const CLUSTER_RADIUS = 150
const NODE_RADIUS = 50

const LABS = [
  { id: 'A', color: 'var(--lab-a)', angle: -90 },
  { id: 'B', color: 'var(--lab-b)', angle: 30 },
  { id: 'C', color: 'var(--lab-c)', angle: 150 },
] as const

const round = (n: number) => Math.round(n * 10) / 10
const rad = (deg: number) => (deg * Math.PI) / 180

const clusters = LABS.map((lab) => ({
  ...lab,
  x: round(CX + CLUSTER_RADIUS * Math.cos(rad(lab.angle))),
  y: round(CY + CLUSTER_RADIUS * Math.sin(rad(lab.angle))),
}))

const nodes = clusters.flatMap((c, labIndex) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = rad(k * 60 + c.angle + 30)
    return {
      id: labIndex * 6 + k,
      lab: labIndex,
      color: c.color,
      x: round(c.x + NODE_RADIUS * Math.cos(a)),
      y: round(c.y + NODE_RADIUS * Math.sin(a)),
    }
  }),
)

const EDGES: [number, number][] = [
  [0, 2],
  [1, 4],
  [7, 9],
  [13, 16],
  [3, 8],
  [5, 14],
  [10, 15],
  [2, 12],
  [6, 17],
  [4, 11],
  [9, 13],
  [0, 16],
  [8, 15],
  [1, 10],
]

const VIOLATIONS = [
  { edge: [3, 8] as const, delay: 1 },
  { edge: [10, 15] as const, delay: 4.5 },
  { edge: [0, 16] as const, delay: 7.5 },
]

export function MarketVisual() {
  return (
    <figure className="relative overflow-hidden rounded-lg border bg-surface">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-2.5 text-xs text-muted-foreground">
        <span className="truncate">
          <span className="text-primary">run://</span>preview · night market
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="mv-flicker size-1.5 rounded-full bg-primary" aria-hidden="true" />
          LABELED
        </span>
      </div>

      <div className="pixel-grid relative">
        <svg
          viewBox="0 0 600 430"
          className="block h-auto w-full"
          role="img"
          aria-labelledby="mv-title mv-desc"
        >
          <title id="mv-title">Eighteen agents trading in the night market</title>
          <desc id="mv-desc">
            Three clusters of six pixel agents, colored blue, amber, and teal by AI lab, send glowing
            messages to one another. Occasionally a red exclamation mark flags a detected violation.
          </desc>

          <defs>
            <filter id="mv-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
            <filter id="mv-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>

          <circle
            cx={CX}
            cy={CY}
            r={64}
            fill="none"
            stroke="var(--border)"
            strokeDasharray="2 6"
          />
          <g className="mv-flicker">
            <rect x={CX - 8} y={CY - 14} width={16} height={22} fill="var(--accent)" opacity={0.35} filter="url(#mv-glow)" />
            <g shapeRendering="crispEdges">
              <rect x={CX - 2} y={CY - 18} width={4} height={4} fill="var(--muted-foreground)" />
              <rect x={CX - 6} y={CY - 14} width={12} height={2} fill="var(--muted-foreground)" />
              <rect x={CX - 6} y={CY - 12} width={12} height={16} fill="var(--accent)" opacity={0.85} />
              <rect x={CX - 2} y={CY - 8} width={4} height={8} fill="var(--foreground)" opacity={0.8} />
              <rect x={CX - 6} y={CY + 4} width={12} height={2} fill="var(--muted-foreground)" />
            </g>
          </g>
          <text
            x={CX}
            y={CY + 26}
            textAnchor="middle"
            fontSize="9"
            letterSpacing="2"
            fill="var(--muted-foreground)"
            className="font-mono"
          >
            MARKET
          </text>

          <g>
            {EDGES.map(([from, to]) => {
              const a = nodes[from]
              const b = nodes[to]
              return (
                <line
                  key={`base-${from}-${to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--primary)"
                  strokeOpacity={0.14}
                  strokeWidth={1}
                />
              )
            })}
          </g>

          {VIOLATIONS.map(({ edge: [from, to], delay }) => {
            const a = nodes[from]
            const b = nodes[to]
            return (
              <line
                key={`alert-edge-${from}-${to}`}
                className="mv-edge-alert"
                style={{ animationDelay: `${delay}s` }}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--violation)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            )
          })}

          <g strokeLinecap="round">
            {EDGES.map(([from, to], i) => {
              const a = nodes[from]
              const b = nodes[to]
              const timing = {
                animationDelay: `${(i * 0.73) % 5}s`,
                animationDuration: `${3.2 + (i % 3) * 0.7}s`,
              }
              return (
                <g key={`packet-${from}-${to}`}>
                  <line
                    className="mv-packet"
                    style={timing}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    pathLength={100}
                    stroke={a.color}
                    strokeWidth={6}
                    opacity={0.5}
                    filter="url(#mv-soft)"
                  />
                  <line
                    className="mv-packet"
                    style={timing}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    pathLength={100}
                    stroke={a.color}
                    strokeWidth={2}
                  />
                </g>
              )
            })}
          </g>

          {nodes.map((n) => (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
              <rect x={-9} y={-9} width={18} height={18} fill={n.color} opacity={0.28} filter="url(#mv-glow)" />
              <g
                className="mv-bob"
                style={{ animationDelay: `${(n.id * 0.37) % 2.4}s` }}
                shapeRendering="crispEdges"
              >
                <rect x={-12} y={12} width={24} height={3} fill={n.color} opacity={0.85} />
                <svg x={-16} y={-17} width={32} height={32} viewBox={SPRITE_VIEWBOX}>
                  <image href={SPRITE_SHEET} width={192} height={176} className="mv-sprite" />
                </svg>
                <rect x={12} y={0} width={6} height={6} fill={n.color} />
                <rect x={14} y={-4} width={2} height={4} fill="var(--muted-foreground)" />
              </g>
            </g>
          ))}

          {VIOLATIONS.map(({ edge: [from], delay }, i) => {
            // The red "!" marks the speaker whose claim was caught.
            const n = nodes[from]
            const style = { animationDelay: `${delay}s` }
            return (
              <g key={`alert-${from}`} transform={`translate(${n.x} ${n.y})`}>
                <rect
                  className="mv-ring"
                  style={style}
                  x={-10}
                  y={-10}
                  width={20}
                  height={20}
                  fill="none"
                  stroke="var(--violation)"
                  strokeWidth={1.5}
                  shapeRendering="crispEdges"
                />
                <g
                  className={`mv-alert${i === 0 ? ' mv-static-alert' : ''}`}
                  style={style}
                  shapeRendering="crispEdges"
                >
                  <rect x={-6} y={-34} width={12} height={18} fill="var(--violation)" />
                  <rect x={-1.5} y={-31} width={3} height={8} fill="var(--background)" />
                  <rect x={-1.5} y={-21} width={3} height={3} fill="var(--background)" />
                  <rect x={-2} y={-16} width={4} height={3} fill="var(--violation)" />
                </g>
              </g>
            )
          })}

          {clusters.map((c) => {
            const labelY = c.angle === -90 ? c.y - NODE_RADIUS - 24 : c.y + NODE_RADIUS + 34
            return (
              <text
                key={c.id}
                x={c.x}
                y={labelY}
                textAnchor="middle"
                fontSize="11"
                letterSpacing="3"
                fill={c.color}
                className="font-mono"
              >
                {`LAB ${c.id}`}
              </text>
            )
          })}
        </svg>
      </div>

      <figcaption className="flex flex-col gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Legend">
          <li className="flex items-center gap-2">
            <span className="size-2.5 bg-lab-a" aria-hidden="true" />
            Lab A
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 bg-lab-b" aria-hidden="true" />
            Lab B
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 bg-lab-c" aria-hidden="true" />
            Lab C
          </li>
          <li className="flex items-center gap-2 text-violation">
            <span
              className="flex size-3.5 items-center justify-center bg-violation text-[10px] font-bold leading-none text-background"
              aria-hidden="true"
            >
              !
            </span>
            Violation
          </li>
        </ul>
        <div className="overflow-x-auto">
          <p className="whitespace-nowrap font-mono">
            <span className="text-primary">evt_0412</span>
            {'  trade_offer  seller=Wren  claimed=8  truth=4  '}
            <span className="text-violation">{'→ LIE'}</span>
            <span className="ml-3 opacity-60">{'// example event format'}</span>
          </p>
        </div>
      </figcaption>
    </figure>
  )
}
