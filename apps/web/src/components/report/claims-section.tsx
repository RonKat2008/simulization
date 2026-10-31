'use client';

import { useCallback, useState } from 'react';
import { Section } from './section';
import { EvidenceDrawer } from './evidence-drawer';
import type { ClaimSection, ReportClaim, ReportReview } from './types';

const ORDER: ClaimSection[] = ['timeline', 'patterns', 'intent_vs_action', 'surprises', 'limitations'];
const SECTION_LABEL: Record<ClaimSection, string> = {
  timeline: 'Timeline',
  patterns: 'Patterns',
  intent_vs_action: 'Intent vs action',
  surprises: 'Surprises',
  limitations: 'Limitations',
};

function ClaimRow({ c, onOpen }: { c: ReportClaim; onOpen: (key: string) => void }) {
  const n = c.evidence.length;
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-sm leading-relaxed text-pretty">{c.text}</p>
        <p className="text-[11px] text-muted-foreground">
          {c.condition} run, {n} cited {n === 1 ? 'event' : 'events'}
          {c.missingIds.length > 0 && <span className="text-violation"> ({c.missingIds.length} unresolved)</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onOpen(c.key)}
        className="shrink-0 self-start rounded-md border px-3 py-1.5 text-xs transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary print:hidden"
      >
        View evidence
      </button>
    </li>
  );
}

export function ClaimsSection({ review }: { review: ReportReview }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const close = useCallback(() => setOpenKey(null), []);
  const open = review.claims.find((c) => c.key === openKey);
  const groups = ORDER.map((s) => ({ s, claims: review.claims.filter((c) => c.section === s) })).filter((g) => g.claims.length > 0);

  return (
    <Section
      id="claims-title"
      title={review.isSample ? 'Claims (placeholder, no Opus review yet)' : 'Opus review'}
      lead="This model-generated interpretation can be mistaken; computed measures and cited events are the evidence. Each claim cites event IDs. The reviewer reads anonymized logs (Group 1/2/3) and explains simulator flags; it does not compute metrics. Open a claim to compare what was said publicly, the self-reported plan, and ground truth."
    >
      {review.isSample && (
        <p role="note" className="rounded-md border border-dashed border-accent/60 px-3 py-2.5 text-xs leading-relaxed text-accent sm:text-sm">
          Placeholder claims built from simulator flags over real events, not model output. {review.summary}
        </p>
      )}
      {!review.isSample && review.summary && (
        <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-pretty">{review.summary}</p>
      )}

      {groups.length === 0 && <p className="text-sm text-muted-foreground">No claims available.</p>}
      <div className="flex flex-col gap-5">
        {groups.map((g) => (
          <div key={g.s}>
            <h3 className="border-b pb-1.5 text-xs uppercase tracking-wider text-muted-foreground">{SECTION_LABEL[g.s]}</h3>
            <ul className="divide-y divide-border/50">
              {g.claims.map((c) => (
                <ClaimRow key={c.key} c={c} onOpen={setOpenKey} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      {open && <EvidenceDrawer claim={open} isSample={review.isSample} onClose={close} />}
    </Section>
  );
}
