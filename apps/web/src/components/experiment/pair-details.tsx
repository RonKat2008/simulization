import type { ExperimentPair } from './load'
import { fmtInterval, fmtValue } from './format'
import { METRICS } from './stats'

/** Every pair, every metric, both conditions, with the per-run CI over agents. */
export function PairDetails({ pairs }: { pairs: ExperimentPair[] }) {
  return (
    <div role="region" aria-label="Per-pair numbers" tabIndex={0} className="overflow-x-auto rounded-md border focus-visible:outline-2 focus-visible:outline-primary">
      <table className="w-full min-w-[32rem] border-collapse text-left text-xs tabular-nums">
        <caption className="sr-only">Per-pair outcomes with 95 percent confidence intervals over agents</caption>
        <thead className="bg-surface-raised text-muted-foreground">
          <tr>
            <th scope="col" className="px-2 py-2 font-medium">Outcome</th>
            {pairs.map((p) => (
              <th key={p.key} scope="col" className="px-2 py-2 font-medium">seed {p.seed}, {p.wealth}<span className="block font-normal">BLIND | LABELED</span></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m) => (
            <tr key={m.key} className="border-t align-top">
              <th scope="row" className="px-2 py-2 font-normal text-foreground">{m.label}</th>
              {pairs.map((p) => (
                <td key={p.key} className="px-2 py-2">
                  {fmtValue(m.kind, p.runCis.blind[m.key].est)} <span className="text-muted-foreground">{fmtInterval(m.kind, p.runCis.blind[m.key])}</span>
                  <br />
                  {fmtValue(m.kind, p.runCis.labeled[m.key].est)} <span className="text-muted-foreground">{fmtInterval(m.kind, p.runCis.labeled[m.key])}</span>
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t align-top">
            <th scope="row" className="px-2 py-2 font-normal text-foreground">Eval-aware turns (count)</th>
            {pairs.map((p) => (
              <td key={p.key} className="px-2 py-2">{p.evalAwareTurns.blind}<br />{p.evalAwareTurns.labeled}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
