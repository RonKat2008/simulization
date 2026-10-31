import type { Metadata } from 'next';
import Link from 'next/link';
import { ReportProgress } from '@/components/report/report-progress';
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

/** Per-run reports and explicit stratum selections always read current persisted data. */
export const dynamic = 'force-dynamic';

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

export default async function ReportPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=await searchParams;
  const param=(key:string)=>typeof query[key]==='string'?query[key] as string:undefined;
  const data = await loadReportData({runId:param('runId'),wealthVisibility:param('wealth_visibility'),mode:param('mode'),mock:param('mock')==='1',group:param('group')});
  const ready=!data.state||data.state==='ready';
  const isMock = data.source === 'mock';
  const isStub = !isMock && data.group.isStub;
  const nL = data.conditions.LABELED?.runs ?? 0;
  const nB = data.conditions.BLIND?.runs ?? 0;
  const single = data.selection?.runId ? (data.conditions.LABELED ?? data.conditions.BLIND) : undefined;

  return (
    <>
      <div className="print:hidden"><SiteHeader /></div>
      <main className="flex-1">
        <header className="border-b">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 print:py-4">
            <h1 className="font-display text-2xl font-semibold leading-tight text-balance sm:text-3xl">
              {data.selection?.runId ? 'Run report' : 'Does the company label change behavior?'}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <span
                className={`rounded-sm border px-1.5 py-0.5 ${isMock || isStub ? 'border-dashed border-accent/60 text-accent' : 'text-foreground'}`}
              >
                {isMock ? 'Mock data (scripted stubs)' : isStub ? 'Scripted agents · Neon' : ready ? 'Completed · Neon' : 'Data: Neon'}
              </span>
              <span className="tabular-nums">{nL} LABELED, {nB} BLIND runs</span>
              {data.selection && <span>Wealth: {data.selection.wealthVisibility} · Mode: {data.selection.mode}</span>}
            </p>
            {data.selection?.runId && <Link className="break-all text-sm underline underline-offset-4" href={`/run/${encodeURIComponent(data.selection.runId)}`}>Run {data.selection.runId} · open replay</Link>}
            {!data.selection?.runId && <><GroupSelector data={data} /><Link className="text-xs underline" href="/report?mock=1">Offline fixtures (scripted)</Link></>}
            {data.selection?.runId && (data.pendingReview || data.state==='pending' || data.state==='empty') && <ReportProgress runId={data.selection.runId} />}
          </div>
        </header>
        {ready && <SectionNav items={single ? [{id:'outcome-title',label:'This run',stage:'Answer'}, ...NAV.filter(item=>item.id!=='headline-title')] : NAV} />}
        {!ready && <section role="status" className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><h2 className="font-display text-xl">{data.state==='error'?'Report unavailable':data.state==='failed'?'Run did not complete':data.state==='pending'?'Run in progress':'No report yet'}</h2><p className="mt-3 text-sm text-muted-foreground">{data.message}</p><Link className="mt-4 inline-block text-sm underline" href="/launch">Back to runs</Link></section>}
        {ready && <>
        {single && <section aria-labelledby="outcome-title" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <h2 id="outcome-title" className="text-2xl font-semibold">What happened in this run</h2>
          <p className="mt-3 text-base leading-relaxed">Across {single.mean.evalAwareness.total} recorded agent turns, the referee flagged {(single.mean.deception.inGroupCount ?? 0)+(single.mean.deception.outGroupCount ?? 0)} misdescribed offers. Recorded theft actions: {(single.mean.theft.inGroupCount ?? 0)+(single.mean.theft.outGroupCount ?? 0)}.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">These are observed game behaviors, not conclusions about a provider’s ethics or bias. Game score measures coins plus held goods; the behavioral measures below answer different questions. Inspect cited events in the review before drawing conclusions.</p>
        </section>}
        {!single && <HeadlineSection data={data} />}

        <SummaryTable data={data} />
        <ChartsSection data={data} />
        <CompanyTable data={data} />
        <PowerSection data={data} />
        <ClaimsSection review={data.review} />
        <JudgeSection checks={data.judgeChecks} />
        <MethodologySection data={data} />
        </>}
      </main>
    </>
  );
}
