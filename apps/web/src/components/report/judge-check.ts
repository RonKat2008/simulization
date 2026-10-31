import { COMPANIES, type Event, type ReviewClaim } from '@simulization/shared';
import { relabelForDisplay } from '../../mastra/anonymize';
import type { Ensemble } from '../../mastra/ensemble';
import type { LoadedRun } from './data';
import type { StoredExtras } from './neon';
import { toEvidence, type AgentLookup } from './summarize';
import type { JudgeCheck, JudgeCheckEnsemble, JudgeGroupRow, ReportClaim } from './types';

/** Legacy cross-judge reviews did not store the primary model; it was the Opus reviewer. */
const PRIMARY_MODEL = 'anthropic/claude-opus-5-5';
/** Newest cross-judge comparisons shown; older ones add length without new information. */
const MAX_SHOWN = 6;

const companyName = (id: string | undefined) => COMPANIES.find((c) => c.id === id)?.name;

const homeLabel = (group: string | null, groupMap: Record<string, string>): string | null => {
  if (!group) return null;
  const name = companyName(groupMap[group]);
  return name ? `${name} (${group})` : group;
};

type JudgeRun = Pick<LoadedRun, 'id' | 'condition' | 'agents' | 'events'>;

/** Judge claims resolved to evidence events, with group labels mapped back to company names. */
function claimViews(run: JudgeRun, groupMap: Record<string, string>, prefix: string, claims: ReviewClaim[]): ReportClaim[] {
  const agents: AgentLookup = new Map(run.agents.map((a) => [a.id, a]));
  const byId = new Map(run.events.map((e) => [e.id, e]));
  return claims.map((c, i) => ({
    key: `${run.id}-${prefix}${i}`,
    section: c.section,
    text: relabelForDisplay(c.text, groupMap),
    condition: run.condition,
    runId: run.id,
    evidence: c.eventIds.map((id) => byId.get(id)).filter((e): e is Event => e !== undefined).map((e) => toEvidence(e, agents)),
    missingIds: c.eventIds.filter((id) => !byId.has(id)),
  }));
}

function ensembleCheck(run: JudgeRun, groupMap: Record<string, string>, en: Ensemble): JudgeCheckEnsemble {
  const lab = (family: string) => companyName(family) ?? family;
  const labOf = new Map(en.judges.map((j) => [j.id, lab(j.family)]));
  const ok = en.judges.filter((j) => j.status === 'ok');
  const show = (t: string) => relabelForDisplay(t, groupMap);
  return {
    status: 'ensemble',
    runId: run.id,
    condition: run.condition,
    nJudges: en.nJudges,
    judges: en.judges.map((j) => ({
      id: j.id,
      lab: lab(j.family),
      family: j.family,
      model: j.model,
      status: j.status,
      ...(j.status === 'failed' && { error: j.error }),
      claims: j.status === 'ok' ? j.claims.length : 0,
      droppedClaims: j.status === 'ok' ? j.droppedClaims : 0,
      isPrimary: j.id === en.primaryJudge,
    })),
    rows: Object.entries(en.byGroup)
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([group, g]) => ({
        group,
        company: companyName(g.company) ?? group,
        companyId: g.company,
        lofo: g.lofo.netTone,
        lofoLabs: g.lofo.judges.map((id) => labOf.get(id) ?? id),
        ensemble: g.ensemble.netTone,
        perJudge: Object.fromEntries(
          ok.map((j) => {
            const t = j.tone[group];
            return [j.id, { netTone: t && t.claims > 0 ? t.positiveShare - t.negativeShare : null, negative: t?.negative ?? 0, claims: t?.claims ?? 0 }];
          }),
        ),
      })),
    selfPreference: en.selfPreference.map((s) => ({
      judge: s.judge,
      lab: lab(s.family),
      home: homeLabel(s.homeGroup, groupMap),
      value: s.value,
      own: s.ownNetTone,
      others: s.othersNetTone,
    })),
    toneAgreement: en.agreement.toneAgreement,
    meanCitationJaccard: en.agreement.meanCitationJaccard,
    pairs: en.agreement.pairs.map((p) => ({ ...p, a: labOf.get(p.a) ?? p.a, b: labOf.get(p.b) ?? p.b })),
    consensus: claimViews(run, groupMap, 'c', en.consensusClaims).map((claim, i) => ({
      claim,
      lab: labOf.get(en.consensusClaims[i]!.judge) ?? en.consensusClaims[i]!.judge,
      alsoBy: en.consensusClaims[i]!.alsoBy.map((id) => labOf.get(id) ?? id),
    })),
    reviews: ok.map((j) => ({
      judge: j.id,
      lab: lab(j.family),
      model: j.model,
      summary: show(j.summary),
      claims: claimViews(run, groupMap, `${j.id}-`, j.claims),
      limitations: j.limitations.map(show),
    })),
    method: en.method,
  };
}

/** One entry per run with a stored judge ensemble (or, for older runs, a cross judge), mapped to real companies via that run's own groupMap. */
export function buildJudgeChecks(runs: JudgeRun[], extras: ReadonlyMap<string, StoredExtras>): JudgeCheck[] {
  const checks: JudgeCheck[] = [];
  for (const run of runs) {
    const ex = extras.get(run.id);
    if (ex?.ensemble) {
      checks.push(ensembleCheck(run, ex.groupMap, ex.ensemble));
      continue;
    }
    const cj = ex?.crossJudge;
    if (!ex || !cj) continue;
    if (cj.status === 'failed') {
      checks.push({ status: 'failed', runId: run.id, condition: run.condition, crossModel: cj.model, error: cj.error });
      continue;
    }
    const a = cj.agreement;
    const rows: JudgeGroupRow[] = Object.entries(a.byGroup)
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([group, g]) => ({
        group,
        company: companyName(ex.groupMap[group]) ?? group,
        companyId: ex.groupMap[group] ?? null,
        primaryClaims: g.primary.claims,
        primaryNegative: g.primary.negative,
        primaryShare: g.primary.negativeShare,
        crossClaims: g.cross.claims,
        crossNegative: g.cross.negative,
        crossShare: g.cross.negativeShare,
        diff: g.diff.negativeShare,
      }));
    checks.push({
      status: 'ok',
      runId: run.id,
      condition: run.condition,
      primaryModel: PRIMARY_MODEL,
      crossModel: cj.model,
      primaryHome: homeLabel(a.homeGroups.primary, ex.groupMap),
      crossHome: homeLabel(a.homeGroups.cross, ex.groupMap),
      rows,
      citations: a.citations,
      crossClaimCount: cj.claims.length,
      droppedClaims: cj.droppedClaims,
      method: a.method,
    });
  }
  return checks.slice(-MAX_SHOWN);
}
