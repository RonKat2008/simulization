'use client';

import { useCallback, useState } from 'react';
import { EvidenceDrawer } from './evidence-drawer';
import { COMPANY_VAR, pct } from './format';
import { Term } from './term';
import type { EnsembleClaimView, JudgeCheckEnsemble, ReportClaim } from './types';

/** Shown before "show all"; the rest stay one click away. */
const CONSENSUS_SHOWN = 5;

const tone = (v: number | null) => (v === null ? 'n/a' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`);
const mono = 'font-mono tabular-nums';
const label = 'font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground';
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function Dot({ family }: { family: string | null }) {
  return <span aria-hidden="true" className="size-2 shrink-0 rounded-sm" style={{ background: (family && COMPANY_VAR[family]) || 'var(--muted-foreground)' }} />;
}

function EvidenceButton({ claim, onOpen }: { claim: ReportClaim; onOpen: (c: ReportClaim) => void }) {
  const n = claim.evidence.length;
  return (
    <button
      type="button"
      onClick={() => onOpen(claim)}
      className={`shrink-0 self-start rounded-md border border-border-strong px-2.5 py-1 text-xs font-medium transition-colors duration-150 hover:bg-surface-raised hover:text-primary print:hidden ${focus}`}
    >
      {n} {n === 1 ? 'event' : 'events'}
    </button>
  );
}

function JudgeChips({ c }: { c: JudgeCheckEnsemble }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Judges">
      {c.judges.map((j) => (
        <li
          key={j.id}
          className={`flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${j.status === 'failed' ? 'border-dashed border-accent/60' : 'bg-background'}`}
          title={j.error}
        >
          <Dot family={j.family} />
          <span className="font-medium">{j.lab}</span>
          <span className="min-w-0 break-words font-mono text-muted-foreground">{j.model}</span>
          <span className={`font-mono text-[11px] ${j.status === 'failed' ? 'text-accent' : 'text-subtle-foreground'}`}>
            {j.status === 'failed' ? 'failed' : `${j.claims} claims${j.isPrimary ? ' · narrative' : ''}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LofoTiles({ c }: { c: JudgeCheckEnsemble }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs leading-relaxed text-muted-foreground">
        <Term k="lofo">Leave-own-lab-out</Term> <Term k="netTone">net tone</Term>: each lab&apos;s merchants are judged only by the other two labs&apos; models.
      </p>
      <dl className="grid gap-2 sm:grid-cols-3">
        {c.rows.map((r) => (
          <div key={r.group} className="flex min-w-0 flex-col gap-1 rounded-lg border bg-background p-3.5">
            <dt className="flex items-center gap-1.5 text-xs">
              <Dot family={r.companyId} />
              <span className="font-medium">{r.company}</span>
              <span className="text-muted-foreground">({r.group})</span>
            </dt>
            <dd className={`${mono} text-2xl font-semibold tracking-[-0.02em]`}>{tone(r.lofo)}</dd>
            <dd className="text-[11px] text-muted-foreground">
              {r.lofoLabs.length > 0 ? `by ${r.lofoLabs.join(' + ')}` : 'no claims from other labs'}
              <span className="text-subtle-foreground"> · all judges {tone(r.ensemble)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function BiasRow({ c }: { c: JudgeCheckEnsemble }) {
  return (
    <div className="flex flex-col gap-2 font-mono text-xs leading-relaxed tabular-nums">
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={label}><Term k="selfPreference">Self-preference</Term></span>
        {c.selfPreference.map((s) => (
          <span key={s.judge} title={s.home ? `toward ${s.home}: own ${tone(s.own)} vs others ${tone(s.others)}` : 'no contestant shares this lab'}>
            {s.lab} judge <strong className="font-medium">{tone(s.value)}</strong>
          </span>
        ))}
        {c.selfPreference.length === 0 && <span className="text-muted-foreground">n/a</span>}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={label}>Agreement</span>
        <span><Term k="toneAgreement">Tone</Term> <strong className="font-medium">{c.toneAgreement === null ? 'n/a' : pct(c.toneAgreement)}</strong></span>
        <span><Term k="citationOverlap">Cited overlap</Term> <strong className="font-medium">{c.meanCitationJaccard === null ? 'n/a' : pct(c.meanCitationJaccard)}</strong></span>
        <span className="text-muted-foreground">n_judges {c.nJudges}/{c.judges.length}</span>
      </p>
    </div>
  );
}

function ConsensusRow({ v, onOpen }: { v: EnsembleClaimView; onOpen: (c: ReportClaim) => void }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm leading-relaxed text-pretty">{v.claim.text}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {v.lab} judge · also cited by {v.alsoBy.join(', ')}
        </p>
      </div>
      <EvidenceButton claim={v.claim} onOpen={onOpen} />
    </li>
  );
}

function Consensus({ c, onOpen }: { c: JudgeCheckEnsemble; onOpen: (cl: ReportClaim) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? c.consensus : c.consensus.slice(0, CONSENSUS_SHOWN);
  return (
    <div className="flex flex-col gap-1">
      <h4 className={label}>Consensus claims · {c.consensus.length}</h4>
      {c.consensus.length === 0 ? (
        <p className="text-xs text-muted-foreground">No claim shares a cited event with another judge.</p>
      ) : (
        <ul className="divide-y">{shown.map((v) => <ConsensusRow key={v.claim.key} v={v} onOpen={onOpen} />)}</ul>
      )}
      {c.consensus.length > CONSENSUS_SHOWN && (
        <button type="button" onClick={() => setAll(!all)} className={`self-start rounded-sm text-xs text-primary underline decoration-primary/40 underline-offset-4 ${focus}`}>
          {all ? 'Show fewer' : `Show all ${c.consensus.length}`}
        </button>
      )}
    </div>
  );
}

function Details({ c, onOpen }: { c: JudgeCheckEnsemble; onOpen: (cl: ReportClaim) => void }) {
  const ok = c.judges.filter((j) => j.status === 'ok');
  return (
    <details className="text-xs leading-relaxed text-muted-foreground">
      <summary className={`cursor-pointer rounded-sm transition-colors hover:text-foreground ${focus}`}>Per-judge details and full reviews</summary>
      <div className="mt-3 flex flex-col gap-4">
        <div className="relative overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[30rem] border-collapse text-left" aria-label={`Net tone by company and judge, run ${c.runId}`}>
            <thead className={`bg-background ${label}`}>
              <tr className="border-b">
                <th scope="col" className="px-3 py-2 font-normal">Company</th>
                {ok.map((j) => <th key={j.id} scope="col" className="px-3 py-2 font-normal">{j.lab} judge</th>)}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r) => (
                <tr key={r.group} className="border-t text-foreground">
                  <th scope="row" className="px-3 py-2 font-normal">{r.company} <span className="text-muted-foreground">({r.group})</span></th>
                  {ok.map((j) => {
                    const p = r.perJudge[j.id];
                    return (
                      <td key={j.id} className={`px-3 py-2 ${mono}`}>
                        {tone(p?.netTone ?? null)} <span className="text-muted-foreground">({p?.negative ?? 0}/{p?.claims ?? 0} neg.)</span>
                        {j.family === r.companyId && <span className="block text-[11px] text-subtle-foreground">own lab</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={mono}>
          {c.pairs.map((p) => `${p.a}–${p.b}: |Δ neg. share| ${p.negativeShareMad === null ? 'n/a' : pct(p.negativeShareMad)}, overlap ${pct(p.citationJaccard)}`).join(' · ')}
        </p>
        <p className={mono}>Dropped for bad citations: {ok.map((j) => `${j.lab} ${j.droppedClaims}`).join(', ')}</p>
        {c.judges.filter((j) => j.status === 'failed').map((j) => (
          <p key={j.id} className="break-words text-accent">{j.lab} judge ({j.model}) failed: {j.error}</p>
        ))}
        {c.reviews.map((r) => (
          <details key={r.judge} className="rounded-lg border bg-background px-3 py-2">
            <summary className={`cursor-pointer rounded-sm text-foreground ${focus}`}>
              {r.lab} judge review <span className="font-mono text-muted-foreground">· {r.model} · {r.claims.length} claims</span>
            </summary>
            <p className="mt-2 whitespace-pre-line text-pretty">{r.summary}</p>
            <ul className="mt-1 divide-y">
              {r.claims.map((cl) => (
                <li key={cl.key} className="flex flex-col gap-2 py-2 text-foreground sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <p className="min-w-0 text-pretty">{cl.text}</p>
                  <EvidenceButton claim={cl} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </details>
        ))}
        <p className="max-w-3xl text-pretty">{c.method}</p>
      </div>
    </details>
  );
}

/** One run's 3-lab judge ensemble. All numbers come from code over cited events (mastra/ensemble.ts). */
export function EnsembleCard({ c }: { c: JudgeCheckEnsemble }) {
  const [open, setOpen] = useState<ReportClaim | null>(null);
  const close = useCallback(() => setOpen(null), []);
  return (
    <article className="flex min-w-0 flex-col gap-5 rounded-lg border bg-surface p-4 shadow-raised sm:p-5" aria-label={`Judge ensemble for run ${c.runId}`}>
      <p className="font-mono text-xs text-muted-foreground">
        Run {c.runId} · {c.condition} · 3-lab judge ensemble
      </p>
      <JudgeChips c={c} />
      <LofoTiles c={c} />
      <BiasRow c={c} />
      <Consensus c={c} onOpen={setOpen} />
      <Details c={c} onOpen={setOpen} />
      {open && <EvidenceDrawer claim={open} isSample={false} onClose={close} />}
    </article>
  );
}
