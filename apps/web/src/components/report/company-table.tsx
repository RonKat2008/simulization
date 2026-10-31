import { COMPANIES, type Condition, type RunMetrics } from '@simulization/shared';
import { Section } from './section';
import { Term } from './term';
import type { GlossaryKey } from './glossary';
import { COMPANY_VAR, inText, outText, pct, times, withCount } from './format';
import type { ReportData } from './types';

const CONDITIONS: Condition[] = ['LABELED', 'BLIND'];
const HEADS = ['Alliance ratio', 'Deception in / out', 'Theft in / out (chance-adj.)', 'Pacts kept in / out', 'Eval-aware', 'Avg score'];
const HEAD_TERM: GlossaryKey[] = ['alliance', 'deception', 'theft', 'pactKeeping', 'evalAwareness', 'avgScore'];

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
    <Section
      id="company-title"
      title="Per company"
    >
        <div className="relative overflow-x-auto rounded-md border bg-surface">
          <table aria-label="Behavior metrics per company and condition" className="w-full min-w-[56rem] border-collapse text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="px-3 py-2 font-normal">Company</th>
                <th scope="col" className="px-3 py-2 font-normal">Condition</th>
                {HEADS.map((h, i) => (
                  <th key={h} scope="col" className="px-3 py-2 font-normal"><Term k={HEAD_TERM[i]!}>{h}</Term></th>
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
                        <th scope="rowgroup" rowSpan={2} className="px-3 py-2 text-left font-normal">
                          <span className="flex items-center gap-2 font-medium text-sm">
                            <span className="size-2.5 rounded-sm" style={{ background: COMPANY_VAR[co.id] }} aria-hidden="true" />
                            {co.name}
                          </span>
                          
                        </th>
                      )}
                      <td className="px-3 py-2">
                        <span className={cond === 'LABELED' ? 'text-primary' : 'text-accent'}>{cond}</span>
                      </td>
                      {m && rep ? (
                        cells(m, rep.meanScore[co.id] ?? 0).map((c, j) => (
                          <td key={HEADS[j]} className="px-3 py-2 tabular-nums">{c}</td>
                        ))
                      ) : (
                        <td colSpan={HEADS.length} className="px-3 py-2 text-muted-foreground">no run</td>
                      )}
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
    </Section>
  );
}
