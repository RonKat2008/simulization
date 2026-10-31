import { effectRows } from './effect';
import { Section } from './section';
import type { ReportData } from './types';

/** All metrics in one compact table, before any chart. Rates print as value (count/total). */
export function SummaryTable({ data }: { data: ReportData }) {
  const rows = effectRows(data);
  return (
    <Section
      id="summary-title"
      title="Summary table"
      lead="Means across runs, all 18 agents. In-group always means true company, including in BLIND. Rates show (count/total) so zero with no data reads as no data."
    >
      <div className="relative overflow-x-auto rounded-md border">
        <table aria-label="Metric means by condition and LABELED minus BLIND difference" className="w-full min-w-[30rem] border-collapse text-left text-xs">
          <thead className="bg-surface text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className="px-3 py-2 font-normal">Metric</th>
              <th scope="col" className="hidden px-3 py-2 font-normal md:table-cell">Definition</th>
              <th scope="col" className="px-3 py-2 font-normal text-primary">LABELED</th>
              <th scope="col" className="px-3 py-2 font-normal text-accent">BLIND</th>
              <th scope="col" className="px-3 py-2 font-normal">L &minus; B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className={`align-top ${i > 0 && rows[i - 1]!.group !== r.group ? 'border-t' : ''} ${i === 0 ? '' : 'border-t border-border/50'}`}>
                <th scope="row" className="px-3 py-2 font-normal">{r.label}</th>
                <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">{r.unit}</td>
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
