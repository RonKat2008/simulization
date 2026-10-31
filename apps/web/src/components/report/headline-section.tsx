import { effectRows, evidenceLevel } from './effect';
import { Section } from './section';
import type { ReportData } from './types';

const HEADLINE_KEYS = ['alliance', 'dm', 'deception-outGroup', 'theft-outGroup'];

const CAVEAT_STYLE = {
  mock: 'border-dashed border-accent/60 text-accent',
  thin: 'border-border text-foreground',
  ok: 'border-border text-muted-foreground',
} as const;

/** The answer first: LABELED minus BLIND for the four metrics that carry the in-group-bias question. */
export function HeadlineSection({ data }: { data: ReportData }) {
  const rows = effectRows(data);
  const ev = evidenceLevel(data);
  const cards = HEADLINE_KEYS.map((k) => rows.find((r) => r.key === k)).filter((r) => r !== undefined);

  return (
    <Section
      id="headline-title"
      title="Label effect: LABELED minus BLIND"
      lead="Positive means the behavior is more frequent when agents can see each other's company. BLIND is the control: same world, no company field."
    >
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border lg:grid-cols-4">
        {cards.map((r) => (
          <div key={r.key} className="flex flex-col gap-1.5 bg-surface p-3 sm:p-4">
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="font-display text-2xl tabular-nums leading-none sm:text-3xl">{r.delta}</dd>
            <dd className="flex flex-col gap-0.5 text-[11px] leading-snug text-muted-foreground tabular-nums">
              <span><span className="text-primary">L</span> {r.labeled}</span>
              <span><span className="text-accent">B</span> {r.blind}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p
        role={ev.level === 'ok' ? undefined : 'note'}
        className={`rounded-md border px-3 py-2.5 text-xs leading-relaxed sm:text-sm ${CAVEAT_STYLE[ev.level]}`}
      >
        <strong className="font-medium">n = {ev.labeledRuns} LABELED, {ev.blindRuns} BLIND.</strong> {ev.caveat}
      </p>
    </Section>
  );
}
