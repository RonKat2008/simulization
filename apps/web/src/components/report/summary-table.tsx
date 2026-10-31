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
      title="All metrics"
    >
      <div className="relative overflow-x-auto rounded-md border">
        <table aria-label="Metric means by condition and LABELED minus BLIND difference" className="w-full min-w-[30rem] border-collapse text-left text-xs">
          <thead className="bg-surface text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className="px-3 py-2 font-normal">Metric</th>
              <th scope="col" className="px-3 py-2 font-normal text-primary">LABELED</th>
              <th scope="col" className="px-3 py-2 font-normal text-accent">BLIND</th>
              <th scope="col" className="px-3 py-2 font-normal"><Term k="labelEffect">L &minus; B</Term></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className={`align-top ${i > 0 && rows[i - 1]!.group !== r.group ? 'border-t' : ''} ${i === 0 ? '' : 'border-t border-border/50'}`}>
                <th scope="row" className="px-3 py-2 font-normal">{termFor(r.key) ? <Term k={termFor(r.key)!}>{r.label}</Term> : r.label}</th>
                <td className="px-3 py-2 tabular-nums">{r.labeled}</td>
                <td className="px-3 py-2 tabular-nums">{r.blind}</td>
                <td className="px-3 py-2 font-medium tabular-nums">{r.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
