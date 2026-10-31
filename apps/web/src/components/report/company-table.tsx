import { COMPANIES, type Condition, type RunMetrics } from '@simulization/shared';
import { SectionHeading } from '../landing/section-heading';
import { COMPANY_VAR, inText, outText, pct, times, withCount } from './format';
import type { ReportData } from './types';

const CONDITIONS: Condition[] = ['LABELED', 'BLIND'];
const HEADS = ['Alliance ratio', 'Deception in / out', 'Theft in / out (chance-adj.)', 'Pacts kept in / out', 'Eval-aware', 'Avg score'];

function cells(m: RunMetrics, score: number): string[] {
  const adj = m.theft.chanceAdjusted;
  const theft = `${inText(m.theft)} / ${outText(m.theft)}`;
  return [
    `${times(m.allianceRatio.ratio)} (${pct(m.allianceRatio.share)})`,
    `${inText(m.deception)} / ${outText(m.deception)}`,
    adj ? `${theft} (${times(adj.inGroup)} / ${times(adj.outGroup)})` : theft,
    `${inText(m.pactKeeping)} / ${outText(m.pactKeeping)}`,
    withCount(m.evalAwareness.rate, m.evalAwareness.count, m.evalAwareness.total),
    score.toFixed(1),
  ];
}

export function CompanyTable({ data }: { data: ReportData }) {
  return (
    <section aria-labelledby="company-title" className="border-b">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeading
          id="company-title"
          kicker="Per company"
          title="Each lab, both conditions."
          description="Metrics scoped to that company's agents; in-group means their own company. Values show rate (count/total) so a zero with no data reads as no data."
        />
        <div className="overflow-x-auto rounded-lg border bg-surface">
          <table className="w-full min-w-[56rem] border-collapse text-left text-xs">
            <caption className="sr-only">Behavior metrics per company and condition</caption>
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="px-4 py-3 font-normal">Company</th>
                <th scope="col" className="px-3 py-3 font-normal">Condition</th>
                {HEADS.map((h) => (
                  <th key={h} scope="col" className="px-3 py-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPANIES.map((co) =>
                CONDITIONS.map((cond, i) => {
                  const rep = data.conditions[cond];
                  const m = rep?.byCompany[co.id];
                  return (
                    <tr key={`${co.id}-${cond}`} className={`${i === 0 ? 'border-t' : ''} align-top`}>
                      {i === 0 && (
                        <th scope="rowgroup" rowSpan={2} className="px-4 py-3 text-left font-normal">
                          <span className="flex items-center gap-2 font-display text-base">
                            <span className="size-2.5 rounded-sm" style={{ background: COMPANY_VAR[co.id] }} aria-hidden="true" />
                            {co.name}
                          </span>
                          <span className="text-muted-foreground">agents {co.id}-01 to {co.id}-06</span>
                        </th>
                      )}
                      <td className="px-3 py-3">
                        <span className={cond === 'LABELED' ? 'text-primary' : 'text-accent'}>{cond}</span>
                      </td>
                      {m && rep ? (
                        cells(m, rep.meanScore[co.id] ?? 0).map((c, j) => (
                          <td key={HEADS[j]} className="px-3 py-3 tabular-nums">{c}</td>
                        ))
                      ) : (
                        <td colSpan={HEADS.length} className="px-3 py-3 text-muted-foreground">no run</td>
                      )}
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
