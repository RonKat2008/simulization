import type { MetricResults } from './load'
import { fmtDiff, fmtInterval, fmtValue } from './format'
import { METRICS, verdictOf } from './stats'

/** Pooled outcome per condition with 95% CIs, and the paired difference. "*" marks a CI that excludes zero at tiny n. */
export function OutcomesTable({ pooled, n }: { pooled: MetricResults; n: number }) {
  return (
    <div role="region" aria-label="Outcomes by condition" tabIndex={0} className="overflow-x-auto rounded-md border focus-visible:outline-2 focus-visible:outline-primary">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm tabular-nums">
        <caption className="sr-only">Pooled outcomes across matched pairs with 95 percent confidence intervals</caption>
        <thead className="bg-surface-raised text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Outcome</th>
            <th scope="col" className="px-3 py-2 font-medium text-accent">BLIND</th>
            <th scope="col" className="px-3 py-2 font-medium text-primary">LABELED</th>
            <th scope="col" className="px-3 py-2 font-medium">LABELED − BLIND</th>
          </tr>
        </thead>
        <tbody>
          {METRICS.filter((m) => m.key !== 'favoritism').map((m) => {
            const r = pooled[m.key]
            const flagged = verdictOf(r.diff, n) === 'higher' || verdictOf(r.diff, n) === 'lower'
            return (
              <tr key={m.key} className="border-t align-top">
                <th scope="row" className="px-3 py-2.5 font-normal text-foreground">{m.label}</th>
                <td className="px-3 py-2.5">{fmtValue(m.kind, r.blind.est)}<span className="block text-[11px] text-muted-foreground">{fmtInterval(m.kind, r.blind)}</span></td>
                <td className="px-3 py-2.5">{fmtValue(m.kind, r.labeled.est)}<span className="block text-[11px] text-muted-foreground">{fmtInterval(m.kind, r.labeled)}</span></td>
                <td className="px-3 py-2.5">{fmtDiff(m.kind, r.diff.est)}{flagged && <span aria-label="interval excludes zero at small n"> *</span>}<span className="block text-[11px] text-muted-foreground">{fmtInterval(m.kind, r.diff, true)}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
