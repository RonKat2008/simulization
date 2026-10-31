'use client';

import { useEffect, useRef } from 'react';
import { COMPANY_VAR } from './format';
import type { EvidenceEvent, ReportClaim } from './types';

function Who({ name, id, company }: { name: string; id: string; company: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 rounded-sm" style={{ background: COMPANY_VAR[company] ?? 'var(--muted-foreground)' }} aria-hidden="true" />
      {name} <span className="text-muted-foreground">({id}{company !== '-' ? `, company ${company}` : ''})</span>
    </span>
  );
}

function EventItem({ e }: { e: EvidenceEvent }) {
  const violation = e.flags.some((f) => f === 'rule_break' || f === 'lie');
  return (
    <li className={`flex flex-col gap-2 rounded-md border bg-surface-raised p-3 text-xs ${violation ? 'border-violation/60' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
        <span className="font-display text-sm text-primary">seq {e.seq}</span>
        <span>round {e.round} · {e.phase} · {e.type}</span>
      </div>
      <p className="text-sm leading-snug text-foreground">{e.summary}</p>
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        <Who {...e.actor} />
        {e.target && <span aria-hidden="true">→</span>}
        {e.target && <Who {...e.target} />}
      </p>
      {e.text && <p><span className="text-muted-foreground">said: </span>&ldquo;{e.text}&rdquo;</p>}
      {e.privatePlan && <p><span className="text-muted-foreground">private plan: </span>{e.privatePlan}</p>}
      {e.flags.length > 0 && (
        <p className="flex flex-wrap gap-1.5">
          {e.flags.map((f) => (
            <span key={f} className="rounded-sm border border-violation/60 px-1.5 py-0.5 text-violation">{f}</span>
          ))}
        </p>
      )}
      <p className="text-muted-foreground">id {e.id}</p>
    </li>
  );
}

export function EvidenceDrawer({ claim, isSample, onClose }: { claim: ReportClaim; isSample: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-title"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto border-l bg-surface p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="evidence-title" className="font-display text-xl font-semibold">
            Evidence ({claim.evidence.length} {claim.evidence.length === 1 ? 'event' : 'events'})
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            Close (Esc)
          </button>
        </div>
        {isSample && (
          <p className="rounded-md border border-dashed border-accent/60 px-3 py-2 text-xs text-accent">
            Sample claim. The events below are real mock events; the claim text is not model output.
          </p>
        )}
        <p className="text-sm leading-relaxed">{claim.text}</p>
        <p className="text-xs text-muted-foreground">
          {claim.condition} run {claim.runId}. Observer view: true companies shown.
        </p>
        {claim.missingIds.length > 0 && (
          <p className="rounded-md border border-violation/60 px-3 py-2 text-xs text-violation">
            {claim.missingIds.length} cited id(s) matched no event: {claim.missingIds.join(', ')}
          </p>
        )}
        <ol className="flex flex-col gap-3">
          {claim.evidence.map((e) => (
            <EventItem key={e.id} e={e} />
          ))}
        </ol>
      </aside>
    </div>
  );
}
