import { effectRows } from './effect';
import { Section } from './section';
import { Term } from './term';
import type { GlossaryKey } from './glossary';
import type { ReportData } from './types';

function termFor(key: string): GlossaryKey | null {
  if (key.startsWith('alliance')) return 'alliance';
  if (key.startsWith('dm')) return 'dm';
  if (key.startsWith('deception')) return 'deception';
  if (key.startsWith('theft')) return 'theft';
  if (key.startsWith('pact')) return 'pactKeeping';
  if (key.startsWith('eval')) return 'evalAwareness';
  if (key.startsWith('fav')) return 'favoritism';
  if (key.startsWith('eth')) return 'ethicality';
  if (key.startsWith('coop')) return 'cooperationRate';
  return null;
}

/** All metrics in one compact table, before any chart. Rates print as value (count/total). */
export function SummaryTable({ data }: { data: ReportData }) {
  const rows = effectRows(data);
  return (
    <Section
      id="summary-title"
      index="02"
      title="All metrics"
    >
      <div className="relative overflow-x-auto rounded-lg border bg-surface shadow-raised">
        <table aria-label="Metric means by condition and LABELED minus BLIND difference" className="w-full min-w-[30rem] border-collapse text-left text-sm">
          <thead className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">
            <tr className="border-b">
              <th scope="col" className="px-4 py-3 font-normal">Metric</th>
              <th scope="col" className="px-4 py-3 text-right font-normal text-primary">LABELED</th>
              <th scope="col" className="px-4 py-3 text-right font-normal text-accent">BLIND</th>
              <th scope="col" className="px-4 py-3 text-right font-normal"><Term k="labelEffect">L &minus; B</Term></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className={`align-top transition-colors duration-150 hover:bg-surface-raised ${i > 0 && rows[i - 1]!.group !== r.group ? 'border-t border-border-strong' : ''} ${i === 0 ? '' : 'border-t'}`}>
                <th scope="row" className="px-4 py-2.5 font-normal">{termFor(r.key) ? <Term k={termFor(r.key)!}>{r.label}</Term> : r.label}</th>
                <td className="px-4 py-2.5 text-right font-mono text-[13px] tabular-nums">{r.labeled}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[13px] tabular-nums">{r.blind}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[13px] font-medium tabular-nums">{r.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
