import type { Metadata } from 'next';
import { ChartsSection } from '@/components/report/charts-section';
import { ClaimsSection } from '@/components/report/claims-section';
import { CompanyTable } from '@/components/report/company-table';
import { PowerSection } from '@/components/report/power-section';
import { loadReportData } from '@/components/report/data';
import { SiteHeader } from '@/components/landing/site-header';

export const metadata: Metadata = { title: 'Report card | Simulization' };

export default async function ReportPage() {
  const data = await loadReportData();
  const isMock = data.source === 'mock';
  const runs = Object.values(data.conditions).reduce((s, c) => s + (c?.runs ?? 0), 0);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section aria-labelledby="report-title" className="pixel-grid border-b">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-14 sm:px-6 lg:px-8">
            <p className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-primary">
              <span className="h-px w-6 bg-primary" aria-hidden="true" />
              Report card
            </p>
            <h1 id="report-title" className="font-display text-4xl font-semibold leading-tight text-balance sm:text-5xl">
              LABELED vs BLIND
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {runs} run{runs === 1 ? '' : 's'} loaded. Every number is computed by code from ground-truth event flags; the reviewer only explains them.
            </p>
            {isMock && (
              <p role="note" className="max-w-3xl rounded-lg border border-dashed border-accent/60 bg-surface p-4 text-sm text-accent">
                Mock data. These are scripted stub runs (1 per condition), shown to demo the report. Not a result.
              </p>
            )}
          </div>
        </section>
        <ChartsSection data={data} />
        <CompanyTable data={data} />
        <PowerSection data={data} />
        <ClaimsSection review={data.review} />
      </main>
    </>
  );
}
