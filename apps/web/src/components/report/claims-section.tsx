'use client';

import { useCallback, useState } from 'react';
import { SectionHeading } from '../landing/section-heading';
import { EvidenceDrawer } from './evidence-drawer';
import type { ReportReview } from './types';

const SECTION_LABEL: Record<string, string> = {
  timeline: 'Timeline',
  patterns: 'Pattern',
  intent_vs_action: 'Intent vs action',
  surprises: 'Surprise',
  limitations: 'Limitation',
};

export function ClaimsSection({ review }: { review: ReportReview }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const close = useCallback(() => setOpenKey(null), []);
  const open = review.claims.find((c) => c.key === openKey);

  return (
    <section aria-labelledby="claims-title">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeading
          id="claims-title"
          kicker="Opus review"
          title="Claims, each with its evidence."
          description="The reviewer sees anonymized logs (Group 1/2/3) and must cite event IDs. Open a claim to read the exact events behind it."
        />

        {review.isSample && (
          <p role="note" className="rounded-lg border border-dashed border-accent/60 bg-surface p-4 text-sm text-accent">
            Sample — run analysis to generate. {review.summary}
          </p>
        )}
        {!review.isSample && <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{review.summary}</p>}

        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {review.claims.map((c) => (
            <li key={c.key} className="flex flex-col justify-between gap-5 rounded-lg border bg-surface p-5">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-sm border px-2 py-0.5 text-muted-foreground">{SECTION_LABEL[c.section]}</span>
                  <span className={`rounded-sm border px-2 py-0.5 ${c.condition === 'LABELED' ? 'text-primary' : 'text-accent'}`}>{c.condition}</span>
                  {review.isSample && <span className="rounded-sm border border-dashed border-accent/60 px-2 py-0.5 text-accent">sample</span>}
                </div>
                <p className="text-sm leading-relaxed text-pretty">{c.text}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenKey(c.key)}
                className="self-start rounded-md border border-primary/50 px-3 py-1.5 text-xs text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                Show {c.evidence.length} cited {c.evidence.length === 1 ? 'event' : 'events'}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <h3 className="font-display text-base text-foreground">Limitations</h3>
          <ul className="list-disc pl-5">
            {review.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
      {open && <EvidenceDrawer claim={open} isSample={review.isSample} onClose={close} />}
    </section>
  );
}
