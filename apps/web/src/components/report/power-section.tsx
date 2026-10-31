import type { Condition, PowerStructure } from '@simulization/shared';
import { Section } from './section';
import { Disclosure } from '@/components/landing/ui';
import { Term } from './term';
import type { ReactNode } from 'react';
import { COMPANY_VAR, pct } from './format';
import type { ReportData } from './types';

const CONDITIONS: Condition[] = ['LABELED', 'BLIND'];

function Stat({ label, value, note }: { label: ReactNode; value: string; note: string }) {
  return (
    <div className="rounded-lg border bg-background p-3.5">
      <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">{label}</dt>
      <dd className="mt-2 font-mono text-xl font-medium tracking-[-0.02em] tabular-nums">{value}</dd>
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
      <p className="font-mono text-xs text-muted-foreground">Run {runId}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Stat label={<Term k="gini">Game-score Gini</Term>} value={p.wealthGini.toFixed(2)} note="0 equal scores, 1 concentrated" />
        <Stat label={<Term k="centralization">Centralization</Term>} value={p.degreeCentralization.toFixed(2)} note="0 flat, 1 one hub" />
        <Stat
          label={<Term k="coalition">Largest coalition</Term>}
          value={c.size === 0 ? 'none' : `${c.size} agents`}
          note={c.size === 0 ? 'no coalition formed' : `${pct(c.share)} of all agents`}
        />
        <Stat
          label="Dominant company"
          value={c.size === 0 ? 'n/a' : `${pct(c.dominantCompanyShare)} ${c.dominantCompany}`}
          note="true company"
        />
      </dl>
      <div>
        <h4 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground"><Term k="broker">Most connected merchants</Term> </h4>
        {p.brokers.length === 0 ? (
          <p className="text-sm text-muted-foreground">no ties formed</p>
        ) : (
          <ol className="flex flex-col gap-2 text-sm">
            {p.brokers.map((b, i) => (
              <li key={b.agentId} className="flex items-center gap-2">
                <span className="w-4 font-mono text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                <CompanyDot company={b.company} />
                <span className="font-mono text-[13px] tabular-nums">{b.agentId}</span>
                <span className="text-muted-foreground">{b.company}</span>
                <span className="ml-auto font-mono text-[13px] tabular-nums">{b.degree} partners</span>
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
    <Section
      id="power-title"
      index="05"
      title="Exploratory hierarchy indicators"
      lead="Inequality and network structure do not establish leadership."
    >
        <Disclosure summary="What these indicators mean">
          <p>Wealth, coalition creation or many partners alone does not show influence. Gini uses final game scores; centralization uses pact, coalition and accepted-trade ties. The most connected merchants have the most distinct partners, not necessarily authority. One block per run.</p>
        </Disclosure>
        <div className="grid gap-4 md:grid-cols-2">
          {CONDITIONS.map((cond) => {
            const rep = data.conditions[cond];
            return (
              <article key={cond} aria-label={`${cond} power structure`} className="flex flex-col gap-5 rounded-lg border bg-surface p-5 shadow-raised">
                <h3 className={`text-sm font-semibold ${cond === 'LABELED' ? 'text-primary' : 'text-accent'}`}>{cond} <span className="font-normal text-muted-foreground">({rep?.runs ?? 0} run{rep?.runs === 1 ? '' : 's'})</span></h3>
                {rep && rep.power.length > 0 ? (
                  rep.power.map((p, i) => <RunCard key={rep.runIds[i]} p={p} runId={rep.runIds[i] ?? String(i + 1)} />)
                ) : (
                  <p className="text-sm text-muted-foreground">no run</p>
                )}
              </article>
            );
          })}
        </div>
    </Section>
  );
}
