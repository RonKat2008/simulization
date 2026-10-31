'use client';

import { useEffect, useRef } from 'react';
import { COMPANY_VAR } from './format';
import type { EvidenceEvent, ReportClaim } from './types';

function Who({ name, id, company }: { name: string; id: string; company: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 rounded-sm" style={{ background: COMPANY_VAR[company] ?? 'var(--muted-foreground)' }} aria-hidden="true" />
      {name} <span className="text-muted-foreground">({id}{company !== '-' ? `, co. ${company}` : ''})</span>
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">{label}</dt>
      <dd className="text-xs leading-relaxed">{children}</dd>
    </div>
  );
}

const NONE = <span className="text-muted-foreground">none recorded</span>;

function GroundTruth({ e }: { e: EvidenceEvent }) {
  const o = e.offer;
  const gap = o && o.trueQuality !== undefined ? o.claimedQuality - o.trueQuality : undefined;
  return (
    <>
      {o && (
        <p className="tabular-nums">
          claimed quality {o.claimedQuality}, price {o.price}
          {o.trueQuality !== undefined && <>; true quality {o.trueQuality} ({gap! >= 0 ? '+' : '−'}{Math.abs(gap!)} off)</>}
        </p>
      )}
      {e.flags.length > 0 ? (
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">simulator flags:</span>
          {e.flags.map((f) => (
            <span key={f} className="rounded-sm border border-violation/50 bg-violation/10 px-1.5 py-0.5 font-mono text-violation">{f}</span>
          ))}
        </p>
      ) : (
        <p className="text-muted-foreground">no flags</p>
      )}
    </>
  );
}

function EventItem({ e }: { e: EvidenceEvent }) {
  const violation = e.flags.some((f) => f === 'rule_break' || f === 'lie');
  return (
    <li className={`flex flex-col gap-3 rounded-lg border bg-surface-raised p-4 ${violation ? 'border-violation/50' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[11px] text-muted-foreground">
        <span className="tabular-nums">{e.id}</span>
        <span>round {e.round} &middot; {e.phase} &middot; {e.type}</span>
      </div>
      <p className="text-sm leading-snug">{e.summary}</p>
      <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
        <Who {...e.actor} />
        {e.target && <span aria-label="to">&rarr;</span>}
        {e.target && <Who {...e.target} />}
      </p>
      <dl className="flex flex-col gap-2.5 border-t pt-3">
        <Field label="Public message">{e.text ? <>&ldquo;{e.text}&rdquo;</> : NONE}</Field>
        <Field label="Self-reported plan">{e.privatePlan ?? NONE}</Field>
        <Field label="Ground truth"><GroundTruth e={e} /></Field>
      </dl>
    </li>
  );
}

export function EvidenceDrawer({ claim, isSample, onClose }: { claim: ReportClaim; isSample: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
      // The drawer currently has one interactive control. Keep keyboard focus
      // inside the modal instead of tabbing into the obscured report.
      if (ev.key === 'Tab') {
        ev.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  const n = claim.evidence.length;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 print:hidden" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-title"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col gap-4 overflow-y-auto border-l border-border-strong bg-surface p-5 shadow-pop sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="evidence-title" className="text-lg font-semibold tracking-[-0.01em]">Cited events ({n})</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            Close (Esc)
          </button>
        </div>
        {isSample && (
          <p className="rounded-lg border border-dashed border-accent/60 px-3 py-2 text-xs text-accent">
            Placeholder claim. The events are real; the claim text is not model output.
          </p>
        )}
        <p className="text-sm leading-relaxed">{claim.text}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {claim.condition} run {claim.runId}. Observer view: true companies shown, even if agents saw none.
        </p>
        {claim.missingIds.length > 0 && (
          <p className="rounded-lg border border-violation/50 px-3 py-2 text-xs text-violation">
            {claim.missingIds.length} cited id(s) matched no event: {claim.missingIds.join(', ')}
          </p>
        )}
        <ol className="flex flex-col gap-2.5">
          {claim.evidence.map((e) => (
            <EventItem key={e.id} e={e} />
          ))}
        </ol>
      </aside>
    </div>
  );
}
