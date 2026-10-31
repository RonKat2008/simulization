import type { Condition, PowerStructure } from '@simulization/shared';
import { SectionHeading } from '../landing/section-heading';
import { COMPANY_VAR, pct } from './format';
import type { ReportData } from './types';

const CONDITIONS: Condition[] = ['LABELED', 'BLIND'];

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-2xl tabular-nums">{value}</dd>
      <dd className="mt-1 text-xs text-muted-foreground">{note}</dd>
    </div>
  );
}

function CompanyDot({ company }: { company: string }) {
  return <span className="inline-block size-2.5 rounded-sm" style={{ background: COMPANY_VAR[company] ?? 'currentColor' }} aria-hidden="true" />;
}

function RunCard({ p, runId }: { p: PowerStructure; runId: string }) {
  const c = p.largestCoalition;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">Run {runId}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Stat label="Wealth Gini" value={p.wealthGini.toFixed(2)} note="0 = equal scores, 1 = one agent owns it all" />
        <Stat label="Degree centralization" value={p.degreeCentralization.toFixed(2)} note="0 = flat network, 1 = single hub" />
        <Stat
          label="Largest coalition"
          value={c.size === 0 ? 'none' : `${c.size} agents`}
          note={c.size === 0 ? 'no coalition formed' : `${pct(c.share)} of all agents`}
        />
        <Stat
          label="Dominant company"
          value={c.size === 0 ? 'n/a' : `${pct(c.dominantCompanyShare)} ${c.dominantCompany}`}
          note="true company, shown even in BLIND"
        />
      </dl>
      <div>
        <h4 className="mb-2 text-xs text-muted-foreground">Top brokers (distinct pact, coalition and trade partners)</h4>
        {p.brokers.length === 0 ? (
          <p className="text-sm text-muted-foreground">no ties formed</p>
        ) : (
          <ol className="flex flex-col gap-1.5 text-sm">
            {p.brokers.map((b, i) => (
              <li key={b.agentId} className="flex items-center gap-2">
                <span className="w-4 text-muted-foreground tabular-nums">{i + 1}.</span>
                <CompanyDot company={b.company} />
                <span className="tabular-nums">{b.agentId}</span>
                <span className="text-muted-foreground">company {b.company}</span>
                <span className="ml-auto tabular-nums">{b.degree} partners</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function PowerSection({ data }: { data: ReportData }) {
  return (
    <section aria-labelledby="power-title" className="border-b">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeading
          id="power-title"
          kicker="Power structures"
          title="Do hierarchies form on their own?"
          description="Inequality of final scores, how concentrated the pact, coalition and trade network is, the biggest coalition, and the agents holding the most ties. Ground truth only; no one was told to organize."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {CONDITIONS.map((cond) => {
            const rep = data.conditions[cond];
            return (
              <article key={cond} aria-label={`${cond} power structure`} className="flex flex-col gap-4 rounded-lg border bg-surface p-5">
                <h3 className={`font-display text-lg ${cond === 'LABELED' ? 'text-primary' : 'text-accent'}`}>{cond}</h3>
                {rep && rep.power.length > 0 ? (
                  rep.power.map((p, i) => <RunCard key={rep.runIds[i]} p={p} runId={rep.runIds[i] ?? String(i + 1)} />)
                ) : (
                  <p className="text-sm text-muted-foreground">no run</p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
