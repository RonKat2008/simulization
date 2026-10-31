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
import { Badge, Eyebrow, buttonClass } from '@/components/landing/ui';

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
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-10 pt-14 sm:px-6 sm:pt-20 lg:px-8 print:py-4">
            <Eyebrow>Report</Eyebrow>
            <h1 className="max-w-3xl text-title font-semibold text-balance">
              {data.selection?.runId ? 'Run report' : 'Does the company label change behavior?'}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs text-muted-foreground">
              <Badge tone={isMock || isStub ? 'accent' : 'neutral'}>
                {isMock ? 'Mock data (scripted stubs)' : isStub ? 'Scripted agents · Neon' : ready ? 'Completed · Neon' : 'Data: Neon'}
              </Badge>
              <span className="tabular-nums">{nL} LABELED, {nB} BLIND runs</span>
              {data.selection && <span>Wealth: {data.selection.wealthVisibility} · Mode: {data.selection.mode}</span>}
            </p>
            {data.selection?.runId && <Link className="break-all font-mono text-sm text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary" href={`/run/${encodeURIComponent(data.selection.runId)}`}>Run {data.selection.runId} · open replay</Link>}
            {!data.selection?.runId && <><GroupSelector data={data} /><Link className="font-mono text-xs text-muted-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:text-foreground" href="/report?mock=1">Offline fixtures (scripted)</Link></>}
            {data.selection?.runId && (data.pendingReview || data.state==='pending' || data.state==='empty') && <ReportProgress runId={data.selection.runId} />}
          </div>
        </header>
        {ready && <SectionNav items={single ? [{id:'outcome-title',label:'This run',stage:'Answer'}, ...NAV.filter(item=>item.id!=='headline-title')] : NAV} />}
        {!ready && <section role="status" className="mx-auto max-w-6xl px-4 py-16 sm:px-6"><h2 className="text-2xl font-semibold tracking-[-0.02em]">{data.state==='error'?'Report unavailable':data.state==='failed'?'Run did not complete':data.state==='pending'?'Run in progress':'No report yet'}</h2><p className="mt-3 text-sm text-muted-foreground">{data.message}</p><Link className={buttonClass('secondary', 'mt-6')} href="/launch">Back to runs</Link></section>}
        {ready && <>
        {single && <section aria-labelledby="outcome-title" className="mx-auto max-w-6xl border-b px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <h2 id="outcome-title" className="text-title font-semibold text-balance">What happened in this run</h2>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-pretty">Across {single.mean.evalAwareness.total} recorded agent turns, the referee flagged {(single.mean.deception.inGroupCount ?? 0)+(single.mean.deception.outGroupCount ?? 0)} misdescribed offers. Recorded theft actions: {(single.mean.theft.inGroupCount ?? 0)+(single.mean.theft.outGroupCount ?? 0)}.</p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground text-pretty">These are observed game behaviors, not conclusions about a provider’s ethics or bias. Game score measures coins plus held goods; the behavioral measures below answer different questions. Inspect cited events in the review before drawing conclusions.</p>
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
