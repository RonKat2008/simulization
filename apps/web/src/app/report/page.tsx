import type { Metadata } from 'next';
import Link from 'next/link';
import { ReportProgress } from '@/components/report/report-progress';
import { ChartsSection } from '@/components/report/charts-section';
import { ClaimsSection } from '@/components/report/claims-section';
import { CompanyTable } from '@/components/report/company-table';
import { HeadlineSection } from '@/components/report/headline-section';
import { MethodologySection } from '@/components/report/methodology-section';
import { PowerSection } from '@/components/report/power-section';
import { SummaryTable } from '@/components/report/summary-table';
import { loadReportData } from '@/components/report/data';
import { SiteHeader } from '@/components/landing/site-header';

/** Per-run reports and explicit stratum selections always read current persisted data. */
export const dynamic = 'force-dynamic';

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

export default async function ReportPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=await searchParams;
  const param=(key:string)=>typeof query[key]==='string'?query[key] as string:undefined;
  const data = await loadReportData({runId:param('runId'),wealthVisibility:param('wealth_visibility'),mode:param('mode'),mock:param('mock')==='1'});
  const ready=!data.state||data.state==='ready';
  const isMock = data.source === 'mock';
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
              {data.selection?.runId ? 'Run report' : 'Does the company label change agent behavior?'}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <span
                className={`rounded-sm border px-1.5 py-0.5 ${isMock ? 'border-dashed border-accent/60 text-accent' : 'text-foreground'}`}
              >
                {isMock ? 'Mock data (scripted stubs)' : 'Data: Neon'}
              </span>
              <span className="tabular-nums">{nL} LABELED, {nB} BLIND runs</span>
              {data.selection && <span>Wealth: {data.selection.wealthVisibility} · Mode: {data.selection.mode}</span>}
            </p>
            {data.selection?.runId && <Link className="break-all text-sm underline underline-offset-4" href={`/run/${encodeURIComponent(data.selection.runId)}`}>Run {data.selection.runId} · open replay</Link>}
            {!data.selection?.runId && <div className="flex flex-wrap gap-4 text-xs">
              <Link className="underline" href="/report?wealth_visibility=private&mode=live-model-relay">Private · live</Link>
              <Link className="underline" href="/report?wealth_visibility=public&mode=live-model-relay">Public · live</Link>
              <Link className="underline" href="/report?wealth_visibility=private&mode=deterministic-stub">Private · stub</Link>
              <Link className="underline" href="/report?wealth_visibility=public&mode=deterministic-stub">Public · stub</Link>
              <Link className="underline" href="/report?mock=1">Offline fixtures</Link>
            </div>}
            {data.selection?.runId && (data.pendingReview || data.state==='pending' || data.state==='empty') && <ReportProgress runId={data.selection.runId} />}
            {ready && <nav aria-label="Report sections" className="print:hidden">
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {NAV.filter(([id])=>id!=="headline-title"||(nL>0&&nB>0)).map(([id, label]) => (
                  <li key={id}><a href={`#${id}`} className="underline-offset-4 transition-colors hover:text-foreground hover:underline">{label}</a></li>
                ))}
              </ul>
            </nav>}
          </div>
        </header>
        {!ready && <section role="status" className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><h2 className="font-display text-xl">{data.state==='error'?'Report unavailable':data.state==='failed'?'Run did not complete':data.state==='pending'?'Run in progress':'No report yet'}</h2><p className="mt-3 text-sm text-muted-foreground">{data.message}</p><Link className="mt-4 inline-block text-sm underline" href="/launch">Back to runs</Link></section>}
        {ready && <>
        {single && <section aria-labelledby="outcome-title" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <h2 id="outcome-title" className="text-2xl font-semibold">What happened in this run</h2>
          <p className="mt-3 text-base leading-relaxed">Across {single.mean.evalAwareness.total} recorded agent turns, the referee flagged {(single.mean.deception.inGroupCount ?? 0)+(single.mean.deception.outGroupCount ?? 0)} misdescribed offers. Recorded theft actions: {(single.mean.theft.inGroupCount ?? 0)+(single.mean.theft.outGroupCount ?? 0)}.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">These are observed game behaviors, not conclusions about a provider’s ethics or bias. Game score measures coins plus held goods; the behavioral measures below answer different questions. Inspect cited events in the review before drawing conclusions.</p>
        </section>}
        {nL > 0 && nB > 0 && <HeadlineSection data={data} />}
        <SummaryTable data={data} />
        <ChartsSection data={data} />
        <CompanyTable data={data} />
        <PowerSection data={data} />
        <ClaimsSection review={data.review} />
        <MethodologySection data={data} />
        </>}
      </main>
    </>
  );
}
