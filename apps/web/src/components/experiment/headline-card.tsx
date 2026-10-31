import { CARD_CLASS } from '../landing/ui'
import { fmtDiff } from './format'
import { metricByKey, verdictOf, type Interval } from './stats'

const KIND = metricByKey('favoritism').kind
const W = 480
const PAD = 24

/** Plain-language verdict that never claims more than the interval supports. */
export function verdictText(diff: Interval, n: number): { head: string; body: string } {
  const v = verdictOf(diff, n)
  if (v === 'insufficient') return { head: 'Not enough pairs yet', body: `n=${n}: at least 2 matched pairs are needed for an interval.` }
  if (v === 'no-effect') return { head: `No detectable effect yet`, body: `CI spans zero, n=${n}. The data cannot tell a small effect from none.` }
  const dir = v === 'higher' ? 'higher' : 'lower'
  return {
    head: `Favoritism ${dir} when labeled, tentatively`,
    body: `CI excludes zero, but n=${n} pairs is small. Treat it as a lead to replicate, not a result.`,
  }
}

export function HeadlineCard({ diff, n, positivePairs }: { diff: Interval; n: number; positivePairs: number }) {
  const { head, body } = verdictText(diff, n)
  const lo = diff.lo ?? 0
  const hi = diff.hi ?? 0
  const est = diff.est ?? 0
  const bound = Math.max(Math.abs(lo), Math.abs(hi), Math.abs(est), 0.05) * 1.15
  const x = (v: number) => PAD + ((v + bound) / (2 * bound)) * (W - 2 * PAD)
  return (
    <section aria-labelledby="headline" className={`${CARD_CLASS} flex flex-col gap-5`}>
      <div className="flex flex-col gap-1">
        <h2 id="headline" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Label effect on in-group favoritism (LABELED − BLIND)
        </h2>
        <p className="font-display text-5xl font-semibold tabular-nums sm:text-6xl">{fmtDiff(KIND, diff.est)}</p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {diff.lo === null ? 'CI n/a' : `95% CI ${fmtDiff(KIND, diff.lo)} to ${fmtDiff(KIND, diff.hi)}`} · n={n} matched pair{n === 1 ? '' : 's'}
        </p>
      </div>

      <svg viewBox={`0 0 ${W} 64`} role="img" className="h-16 w-full" aria-label={`Point estimate ${fmtDiff(KIND, diff.est)} with 95 percent interval from ${fmtDiff(KIND, diff.lo)} to ${fmtDiff(KIND, diff.hi)}. Zero marks no effect.`}>
        <line x1={PAD} x2={W - PAD} y1={34} y2={34} stroke="var(--border)" strokeWidth={2} />
        <line x1={x(0)} x2={x(0)} y1={14} y2={54} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="3 3" />
        <text x={x(0)} y={10} textAnchor="middle" className="fill-muted-foreground" fontSize={11}>0 = no effect</text>
        {diff.lo !== null && diff.hi !== null && (
          <>
            <line x1={x(lo)} x2={x(hi)} y1={34} y2={34} stroke="var(--primary)" strokeWidth={6} strokeLinecap="round" opacity={0.45} />
            <line x1={x(lo)} x2={x(lo)} y1={26} y2={42} stroke="var(--primary)" strokeWidth={2} />
            <line x1={x(hi)} x2={x(hi)} y1={26} y2={42} stroke="var(--primary)" strokeWidth={2} />
          </>
        )}
        <circle cx={x(est)} cy={34} r={7} fill="var(--primary)" stroke="var(--background)" strokeWidth={2} />
      </svg>

      <div className="rounded-md border border-dashed p-4">
        <p className="text-base font-medium text-foreground">{head}</p>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{body}</p>
        {n > 0 && <p className="mt-2 text-xs text-muted-foreground">{positivePairs} of {n} pairs show higher favoritism when labeled.</p>}
      </div>
    </section>
  )
}
