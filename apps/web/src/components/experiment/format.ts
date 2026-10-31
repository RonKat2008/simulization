import type { Interval, MetricDef } from './stats'
import { signedPp } from '../report/format'

const minus = (s: string) => s.replace('-', '−')

/** One value in the metric's own unit: percent, coefficient, or signed percentage points. */
export function fmtValue(kind: MetricDef['kind'], v: number | null): string {
  if (v === null) return 'n/a'
  if (kind === 'rate') return `${Math.round(v * 100)}%`
  if (kind === 'ratio') return v.toFixed(2)
  return signedPp(v)
}

/** A difference of two values of that metric (rates become percentage points). */
export function fmtDiff(kind: MetricDef['kind'], v: number | null): string {
  if (v === null) return 'n/a'
  if (kind === 'ratio') return minus(`${v >= 0 ? '+' : ''}${v.toFixed(2)}`)
  return signedPp(v)
}

/** "[84–100]" style interval for values, or "[−9.1 to +18.0 pp]" for differences. */
export function fmtInterval(kind: MetricDef['kind'], i: Interval, diff = false): string {
  if (i.lo === null || i.hi === null) return 'CI n/a'
  if (diff) return `95% CI ${fmtDiff(kind, i.lo)} to ${fmtDiff(kind, i.hi)}`
  if (kind === 'rate') return `[${Math.round(i.lo * 100)}–${Math.round(i.hi * 100)}%]`
  if (kind === 'ratio') return `[${i.lo.toFixed(2)}–${i.hi.toFixed(2)}]`
  return `[${fmtValue(kind, i.lo)} to ${fmtValue(kind, i.hi)}]`
}
