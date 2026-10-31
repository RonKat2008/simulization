import type { Metadata } from 'next';
import { ChartsSection } from '@/components/report/charts-section';
import { ClaimsSection } from '@/components/report/claims-section';
import { CompanyTable } from '@/components/report/company-table';
import { GroupSelector } from '@/components/report/group-selector';
import { HeadlineSection } from '@/components/report/headline-section';
import { JudgeSection } from '@/components/report/judge-section';
import { SectionNav, type NavItem } from '@/components/report/section-nav';
import { MethodologySection } from '@/components/report/methodology-section';
import { PowerSection } from '@/components/report/power-section';
import { SummaryTable } from '@/components/report/summary-table';
import { loadReportData } from '@/components/report/data';
import { SiteHeader } from '@/components/landing/site-header';

/** Refresh from Neon at most every 30s. The ?group= selector makes the page render per request. */
export const revalidate = 30;

export const metadata: Metadata = { title: 'Report | Simulization' };

const NAV: NavItem[] = [
  { id: 'headline-title', label: 'Effect', stage: 'Answer' },
  { id: 'summary-title', label: 'Summary', stage: 'Evidence' },
  { id: 'charts-title', label: 'Charts', stage: 'Evidence' },
  { id: 'company-title', label: 'Per company', stage: 'Evidence' },
  { id: 'power-title', label: 'Power', stage: 'Evidence' },
  { id: 'claims-title', label: 'Review', stage: 'Evidence' },
  { id: 'judge-title', label: 'Judge check', stage: 'Evidence' },
  { id: 'method-title', label: 'Method', stage: 'Method' },
];

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ group?: string | string[] }> }) {
  const { group } = await searchParams;
  const data = await loadReportData(typeof group === 'string' ? group : undefined);
  const isMock = data.source === 'mock';
  const isStub = !isMock && data.group.isStub;
  const nL = data.conditions.LABELED?.runs ?? 0;
  const nB = data.conditions.BLIND?.runs ?? 0;

  return (
    <>
      <div className="print:hidden"><SiteHeader /></div>
      <main className="flex-1">
        <header className="border-b">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 print:py-4">
            <h1 className="font-display text-2xl font-semibold leading-tight text-balance sm:text-3xl">
              Does the company label change behavior?
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <span
                className={`rounded-sm border px-1.5 py-0.5 ${isMock || isStub ? 'border-dashed border-accent/60 text-accent' : 'text-foreground'}`}
              >
                {isMock ? 'Mock data' : isStub ? 'Stub agents' : 'Live data'}
              </span>
              <span className="tabular-nums">{nL} LABELED, {nB} BLIND runs</span>
                          </p>
            <GroupSelector data={data} />
          </div>
        </header>
        <SectionNav items={NAV} />
        <HeadlineSection data={data} />
        <SummaryTable data={data} />
        <ChartsSection data={data} />
        <CompanyTable data={data} />
        <PowerSection data={data} />
        <ClaimsSection review={data.review} />
        <JudgeSection checks={data.judgeChecks} />
        <MethodologySection data={data} />
      </main>
    </>
  );
}
