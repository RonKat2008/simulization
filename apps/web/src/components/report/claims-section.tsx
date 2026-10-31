'use client';

import { useCallback, useState } from 'react';
import { Section } from './section';
import { Disclosure } from '@/components/landing/ui';
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

const firstSentence = (t: string) => t.match(/^[\s\S]*?[.!?](\s|$)/)?.[0].trim() ?? t;

function ClaimRow({ c, onOpen }: { c: ReportClaim; onOpen: (key: string) => void }) {
  const n = c.evidence.length;
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-sm leading-relaxed text-pretty">{c.text}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {c.condition} · {n} {n === 1 ? 'event' : 'events'}
          {c.missingIds.length > 0 && <span className="text-violation"> ({c.missingIds.length} unresolved)</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onOpen(c.key)}
        className="shrink-0 self-start rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium transition-colors duration-150 hover:bg-surface-raised hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary print:hidden"
      >
        Evidence
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
      index="06"
      title={review.isSample ? 'Claims (placeholder, no review yet)' : 'Judge review'}
      lead="Every claim cites events."
    >
      <Disclosure summary="How to read the review">
        <p>This model-generated interpretation can be mistaken; computed measures and cited events are the evidence. Shown is the primary judge of the 3-lab judge ensemble (Claude Opus unless it failed); the Judge ensemble section compares all three and lists consensus claims. Judges read anonymized logs (Group 1/2/3) and explain simulator flags; they do not compute metrics. Open a claim to compare recorded statements, self-reported plans and ground truth.</p>
      </Disclosure>
      {review.isSample && (
        <p role="note" className="rounded-lg border border-dashed border-accent/60 px-4 py-3 text-xs leading-relaxed text-accent sm:text-sm">
          Placeholder claims from simulator flags, not model output.
        </p>
      )}
      {!review.isSample && review.summary && (
        <div className="flex max-w-3xl flex-col gap-2">
          <p className="text-lg leading-relaxed text-pretty">{firstSentence(review.summary)}</p>
          {review.summary.length > firstSentence(review.summary).length && (
            <Disclosure summary="Full summary"><p className="whitespace-pre-line">{review.summary}</p></Disclosure>
          )}
        </div>
      )}

      {groups.length === 0 && <p className="text-sm text-muted-foreground">No claims available.</p>}
      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <details key={g.s} className="group rounded-lg border bg-surface transition-colors open:border-border-strong open:shadow-raised">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 text-sm font-medium transition-colors duration-150 hover:bg-surface-raised group-open:rounded-b-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              <span>{SECTION_LABEL[g.s]} <span className="font-mono tabular-nums text-muted-foreground">· {g.claims.length}</span></span>
              <span aria-hidden="true" className="text-base leading-none text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-45">+</span>
            </summary>
            <ul className="divide-y border-t px-4">
              {g.claims.map((c) => (
                <ClaimRow key={c.key} c={c} onOpen={setOpenKey} />
              ))}
            </ul>
          </details>
        ))}
      </div>
      {open && <EvidenceDrawer claim={open} isSample={review.isSample} onClose={close} />}
    </Section>
  );
}
