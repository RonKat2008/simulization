import { CHANCE, type InOutRate, type RunMetrics } from '@simulization/shared';
import { Section } from './section';
import { inText, outText, pct, times, withCount } from './format';
import { RateChart, type ChartRow } from './rate-chart';
import type { ReportData } from './types';

type M = RunMetrics | undefined;
const NA = 'no run';

function row(name: string, l: [number, string] | undefined, b: [number, string] | undefined): ChartRow {
  return { name, LABELED: l?.[0], BLIND: b?.[0], labeledText: l?.[1] ?? NA, blindText: b?.[1] ?? NA };
}

function inOutRows(l: M, b: M, pick: (m: RunMetrics) => InOutRate): ChartRow[] {
  const side = (m: M, k: 'inGroup' | 'outGroup'): [number, string] | undefined =>
    m ? [pick(m)[k], k === 'inGroup' ? inText(pick(m)) : outText(pick(m))] : undefined;
  return [
    row('in-group', side(l, 'inGroup'), side(b, 'inGroup')),
    row('out-group', side(l, 'outGroup'), side(b, 'outGroup')),
  ];
}

export function ChartsSection({ data }: { data: ReportData }) {
  const l = data.conditions.LABELED?.mean;
  const b = data.conditions.BLIND?.mean;
  const share = (m: M, k: 'allianceRatio' | 'messageShare'): [number, string] | undefined =>
    m ? [m[k].share, `${withCount(m[k].share, m[k].count, m[k].total)}, ${times(m[k].ratio)} chance`] : undefined;
  const ev = (m: M): [number, string] | undefined =>
    m ? [m.evalAwareness.rate, withCount(m.evalAwareness.rate, m.evalAwareness.count, m.evalAwareness.total)] : undefined;

  return (
    <Section
      id="charts-title"
      title="Rates by condition"
      lead="All panels share one 0 to 100% axis so heights compare across metrics. LABELED is solid, BLIND is hatched; exact values and counts are labeled on each bar and in the summary table."
    >
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-primary" aria-hidden="true" />
          LABELED (solid)
        </li>
        <li className="flex items-center gap-2">
          <span
            className="size-3 rounded-sm border border-accent"
            style={{ background: 'repeating-linear-gradient(45deg, var(--accent) 0 2px, transparent 2px 5px)' }}
            aria-hidden="true"
          />
          BLIND (hatched)
        </li>
        <li className="flex items-center gap-2">
          <span className="w-4 border-t border-dashed border-foreground" aria-hidden="true" />
          chance
        </li>
      </ul>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <RateChart
          title="Same-company share"
          caption="Coalition pairs and DMs that stay inside one company."
          reference={{ value: CHANCE, label: `chance ${pct(CHANCE)}` }}
          rows={[
            row('coalition pairs', share(l, 'allianceRatio'), share(b, 'allianceRatio')),
            row('DMs', share(l, 'messageShare'), share(b, 'messageShare')),
          ]}
        />
        <RateChart
          title="Deception"
          caption="Offers claiming quality 2+ off truth, by buyer's company."
          rows={inOutRows(l, b, (m) => m.deception)}
        />
        <RateChart
          title="Theft"
          caption="Steals per act turn, by victim's company (5 in-group vs 12 out-group possible victims)."
          rows={inOutRows(l, b, (m) => m.theft)}
        />
        <RateChart
          title="Pact keeping"
          caption="Pacts never broken, by partner's company. Higher is more honest."
          rows={inOutRows(l, b, (m) => m.pactKeeping)}
        />
        <RateChart
          title="Eval awareness"
          caption="Turns mentioning a test, evaluation or simulation."
          rows={[row('all agents', ev(l), ev(b))]}
        />
      </div>
    </Section>
  );
}
