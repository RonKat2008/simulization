import type { ExperimentPair } from './load'
import { fmtValue } from './format'
import { metricByKey } from './stats'

const KIND = metricByKey('favoritism').kind
const W = 480
const H = 240
const X_BLIND = 170
const X_LABELED = 350
const TOP = 30
const BOTTOM = H - 30

/** Each matched pair is one line from its BLIND run to its LABELED run; a rising line means more favoritism when labeled. */
export function SlopeChart({ pairs }: { pairs: ExperimentPair[] }) {
  const pts = pairs.flatMap((p) => [p.runCis.blind.favoritism, p.runCis.labeled.favoritism])
  const vals = pts.flatMap((i) => [i.est, i.lo, i.hi]).filter((v): v is number => v !== null)
  const lo = Math.min(-0.1, ...vals) - 0.03
  const hi = Math.max(0.1, ...vals) + 0.03
  const y = (v: number) => BOTTOM - ((v - lo) / (hi - lo)) * (BOTTOM - TOP)
  const labelY = new Map<string, number>()
  let prev = -Infinity
  for (const p of [...pairs].sort((a, b) => (b.runCis.blind.favoritism.est ?? 0) - (a.runCis.blind.favoritism.est ?? 0))) {
    const ly = Math.max(y(p.runCis.blind.favoritism.est ?? 0), prev + 13)
    labelY.set(p.key, ly)
    prev = ly
  }
  const ticks = [lo, 0, hi].map((t) => Math.round(t * 100) / 100)

  return (
    <figure className="flex flex-col gap-2 rounded-md border bg-surface p-3 sm:p-4">
      <figcaption className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium">In-group favoritism, each pair BLIND → LABELED</h3>
        <p className="text-[11px] text-muted-foreground">Dots: one run. Whiskers: 95% CI over agents. Dashed line: no favoritism.</p>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full max-w-xl" aria-hidden="true">
        <line x1={64} x2={W - 10} y1={y(0)} y2={y(0)} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
        {ticks.filter((t, i, a) => a.indexOf(t) === i).map((t) => (
          <text key={t} x={58} y={y(t) + 4} textAnchor="end" fontSize={10} className="fill-muted-foreground">{fmtValue(KIND, t)}</text>
        ))}
        <text x={X_BLIND} y={H - 8} textAnchor="middle" fontSize={11} className="fill-accent" fontWeight={600}>BLIND</text>
        <text x={X_LABELED} y={H - 8} textAnchor="middle" fontSize={11} className="fill-primary" fontWeight={600}>LABELED</text>
        {pairs.map((p) => {
          const b = p.runCis.blind.favoritism
          const l = p.runCis.labeled.favoritism
          if (b.est === null || l.est === null) return null
          return (
            <g key={p.key}>
              {[[b, X_BLIND, 'var(--accent)'], [l, X_LABELED, 'var(--primary)']].map(([ci, cx, color]) => {
                const i = ci as typeof b
                return i.lo !== null && i.hi !== null ? (
                  <line key={String(cx)} x1={cx as number} x2={cx as number} y1={y(i.lo)} y2={y(i.hi)} stroke={color as string} strokeWidth={2} opacity={0.35} />
                ) : null
              })}
              <line x1={X_BLIND} y1={y(b.est)} x2={X_LABELED} y2={y(l.est)} stroke="var(--foreground)" strokeWidth={1.5} opacity={0.7} />
              <circle cx={X_BLIND} cy={y(b.est)} r={5.5} fill="var(--accent)" stroke="var(--background)" strokeWidth={1.5} />
              <circle cx={X_LABELED} cy={y(l.est)} r={5.5} fill="var(--primary)" stroke="var(--background)" strokeWidth={1.5} />
              <text x={X_BLIND - 12} y={(labelY.get(p.key) ?? y(b.est)) + 4} textAnchor="end" fontSize={11} className="fill-foreground">seed {p.seed}</text>
            </g>
          )
        })}
      </svg>
      <div className="sr-only"><table>
        <caption>In-group favoritism per matched pair</caption>
        <thead><tr><th>Pair</th><th>BLIND</th><th>LABELED</th></tr></thead>
        <tbody>
          {pairs.map((p) => (
            <tr key={p.key}><td>seed {p.seed}, {p.wealth} wealth</td><td>{fmtValue(KIND, p.runCis.blind.favoritism.est)}</td><td>{fmtValue(KIND, p.runCis.labeled.favoritism.est)}</td></tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  )
}
