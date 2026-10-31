import { Section } from './section';
import { Disclosure } from '@/components/landing/ui';
import { Term } from './term';
import { pct, signedPp } from './format';
import type { JudgeCheck, JudgeCheckOk } from './types';

const shortModel = (m: string) => m.replace(/^vercel\//, '');

function Share({ claims, negative, share }: { claims: number; negative: number; share: number }) {
  if (claims === 0) return <span className="text-muted-foreground">no claims</span>;
  return (
    <span className="tabular-nums">
      {pct(share)} <span className="text-muted-foreground">({negative}/{claims})</span>
    </span>
  );
}

function JudgeHead({ role, model, home }: { role: string; model: string; home: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border bg-background p-3">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{role}</dt>
      <dd className="break-all font-mono text-xs">{shortModel(model)}</dd>
      <dd className="text-xs text-muted-foreground">
        <Term k="homeFamily">Home</Term>: {home ?? 'none'}
      </dd>
    </div>
  );
}

function OkCard({ c }: { c: JudgeCheckOk }) {
  const cit = c.citations;
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-md border bg-surface p-3 sm:p-4" aria-label={`Judge check for run ${c.runId}`}>
      <p className="text-xs text-muted-foreground">
        Run <span className="font-mono">{c.runId}</span> · {c.condition}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <JudgeHead role="Primary" model={c.primaryModel} home={c.primaryHome} />
        <JudgeHead role="Cross-family" model={c.crossModel} home={c.crossHome} />
      </dl>

      <div className="relative overflow-x-auto rounded-md border">
        <table className="w-full min-w-[28rem] border-collapse text-left text-xs" aria-label={`Negative share of claims by company, per judge, run ${c.runId}`}>
          <thead className="bg-background text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className="px-3 py-2 font-normal">Company</th>
              <th scope="col" className="px-3 py-2 font-normal">Primary</th>
              <th scope="col" className="px-3 py-2 font-normal">Cross</th>
              <th scope="col" className="px-3 py-2 font-normal"><Term k="difference">Difference</Term></th>
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r) => {
              const noData = r.primaryClaims === 0 || r.crossClaims === 0;
              const homeOf = [c.primaryHome?.endsWith(`(${r.group})`) ? 'primary' : null, c.crossHome?.endsWith(`(${r.group})`) ? 'cross' : null].filter(Boolean);
              return (
                <tr key={r.group} className="border-t border-border/50 align-top">
                  <th scope="row" className="px-3 py-2 font-normal">
                    <span className="font-medium">{r.company}</span>{' '}
                    <span className="text-muted-foreground">({r.group})</span>
                    {homeOf.length > 0 && <span className="block text-[11px] text-accent">home of the {homeOf.join(' and ')} judge</span>}
                  </th>
                  <td className="px-3 py-2"><Share claims={r.primaryClaims} negative={r.primaryNegative} share={r.primaryShare} /></td>
                  <td className="px-3 py-2"><Share claims={r.crossClaims} negative={r.crossNegative} share={r.crossShare} /></td>
                  <td className="px-3 py-2 font-medium tabular-nums">{noData ? <span className="font-normal text-muted-foreground">n/a</span> : signedPp(r.diff)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed tabular-nums">
        <Term k="citationOverlap">Cited overlap</Term>: <strong className="font-medium">{pct(cit.jaccard)}</strong>
        <span className="text-muted-foreground"> · dropped {c.droppedClaims}</span>
      </p>
      <details className="text-[11px] leading-relaxed text-muted-foreground">
        <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">How computed</summary>
        <p className="mt-1.5 max-w-3xl text-pretty">Cells show each judge&apos;s negative share of claims about that company, (negative/claims). Difference is cross minus primary. Overlap: {cit.shared} shared, {cit.onlyPrimary} only primary, {cit.onlyCross} only cross; cross judge kept {c.crossClaimCount} claim{c.crossClaimCount === 1 ? '' : 's'}.</p>
        <p className="mt-1.5 max-w-3xl text-pretty">{c.method}</p>
      </details>
    </article>
  );
}

function FailedCard({ c }: { c: Extract<JudgeCheck, { status: 'failed' }> }) {
  return (
    <article className="min-w-0 rounded-md border border-dashed border-accent/60 p-3 text-xs leading-relaxed sm:p-4">
      <p className="text-accent">
        Cross judge <span className="font-mono">{shortModel(c.crossModel)}</span> failed for run <span className="font-mono">{c.runId}</span> ({c.condition}); no comparison exists.
      </p>
      <p className="mt-1 break-words text-muted-foreground">{c.error}</p>
    </article>
  );
}

/** Second reviewer from another model family on the same anonymized log (CLAUDE.md "Judge caveat"). */
export function JudgeSection({ checks }: { checks: JudgeCheck[] }) {
  return (
    <Section
      id="judge-title"
      title="Judge check"
      lead="Does the judge change who looks bad?"
    >
      <Disclosure summary="Robustness check, not a neutral verdict">
        <p>
          A second reviewer from a different model family read the identical anonymized log; the two are compared in code. Every judge&apos;s model family is also a
          contestant, so no judge here is neutral. This compares two judges with opposite home groups; if they agree, the finding does not hinge on one
          family&apos;s taste, and if they disagree, treat the review text as one reading. All numbers come from code over the cited events, not from judge wording.
        </p>
      </Disclosure>
      {checks.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
          No judge data yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {checks.map((c) => (c.status === 'ok' ? <OkCard key={c.runId} c={c} /> : <FailedCard key={c.runId} c={c} />))}
        </div>
      )}
    </Section>
  );
}
