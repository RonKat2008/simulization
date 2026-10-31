import type { Metadata } from 'next';
import { ChartsSection } from '@/components/report/charts-section';
import { ClaimsSection } from '@/components/report/claims-section';
import { CompanyTable } from '@/components/report/company-table';
import { HeadlineSection } from '@/components/report/headline-section';
import { MethodologySection } from '@/components/report/methodology-section';
import { PowerSection } from '@/components/report/power-section';
import { SummaryTable } from '@/components/report/summary-table';
import { loadReportData } from '@/components/report/data';
import { SiteHeader } from '@/components/landing/site-header';

/** ISR: serve a cached render and refresh from Neon at most every 30s. */
export const revalidate = 30;

export const metadata: Metadata = { title: 'Report | Simulization' };

const NAV = [
  ['headline-title', 'Label effect'],
  ['summary-title', 'Summary'],
  ['charts-title', 'Charts'],
  ['company-title', 'Per company'],
  ['power-title', 'Power'],
  ['claims-title', 'Review'],
  ['method-title', 'Method'],
] as const;

export default async function ReportPage() {
  const data = await loadReportData();
  const isMock = data.source === 'mock';
  const nL = data.conditions.LABELED?.runs ?? 0;
  const nB = data.conditions.BLIND?.runs ?? 0;

  return (
    <>
      <div className="print:hidden"><SiteHeader /></div>
      <main className="flex-1">
        <header className="border-b">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 print:py-4">
            <h1 className="font-display text-2xl font-semibold leading-tight text-balance sm:text-3xl">
              Does the company label change agent behavior?
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <span
                className={`rounded-sm border px-1.5 py-0.5 ${isMock ? 'border-dashed border-accent/60 text-accent' : 'text-foreground'}`}
              >
                {isMock ? 'Mock data (scripted stubs)' : 'Data: Neon, completed runs'}
              </span>
              <span className="tabular-nums">{nL} LABELED, {nB} BLIND runs</span>
              <span>18 agents, 3 companies, 6 rounds</span>
            </p>
            <nav aria-label="Report sections" className="print:hidden">
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {NAV.map(([id, label]) => (
                  <li key={id}><a href={`#${id}`} className="underline-offset-4 transition-colors hover:text-foreground hover:underline">{label}</a></li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <HeadlineSection data={data} />
        <SummaryTable data={data} />
        <ChartsSection data={data} />
        <CompanyTable data={data} />
        <PowerSection data={data} />
        <ClaimsSection review={data.review} />
        <MethodologySection data={data} />
      </main>
    </>
  );
}
