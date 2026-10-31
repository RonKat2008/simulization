import { COMPANIES, type Condition } from '@simulization/shared';
import type { StoredExtras } from './neon';
import type { JudgeCheck, JudgeGroupRow } from './types';

/** The primary reviewer's model is not stored on the review; it is the Opus reviewer (mastra/agents.ts OPUS). */
const PRIMARY_MODEL = 'anthropic/claude-opus-5-5';
/** Newest cross-judge comparisons shown; older ones add length without new information. */
const MAX_SHOWN = 6;

const companyName = (id: string | undefined) => COMPANIES.find((c) => c.id === id)?.name;

const homeLabel = (group: string | null, groupMap: Record<string, string>): string | null => {
  if (!group) return null;
  const name = companyName(groupMap[group]);
  return name ? `${name} (${group})` : group;
};

/** One entry per run that has a stored cross judge, mapped to real companies via that run's own groupMap. */
export function buildJudgeChecks(
  runs: { id: string; condition: Condition }[],
  extras: ReadonlyMap<string, StoredExtras>,
): JudgeCheck[] {
  const checks: JudgeCheck[] = [];
  for (const run of runs) {
    const ex = extras.get(run.id);
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
