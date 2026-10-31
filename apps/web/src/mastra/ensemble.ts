// 3-lab judge ensemble scoring (CLAUDE.md "Judge caveat"). Pure and free of Mastra imports so it runs
// offline and in the report. Judges see only the anonymized log; this file alone knows, through the
// GroupMap, which group is which lab, so it can score each lab's group only with the other labs'
// judges (leave-own-family-out, LOFO) and estimate each judge's self-preference.
import { z } from 'zod';
import { ReviewSchema, type Event, type Review } from '@simulization/shared';
import type { GroupMap } from './anonymize';
import { GroupToneSchema, citedIds, toneByGroup, type GroupTone } from './crossJudge';
import { displayModel, type JudgeSpec } from './judges';

const FamilySchema = z.enum(['A', 'B', 'C']);

export const EnsembleJudgeSchema = z.discriminatedUnion('status', [
  ReviewSchema.extend({
    status: z.literal('ok'),
    id: z.string(),
    family: FamilySchema,
    model: z.string(),
    droppedClaims: z.number().int(),
    /** Keyed by anonymized group label, same labels as the stored groupMap. */
    tone: z.record(z.string(), GroupToneSchema),
  }),
  z.object({ status: z.literal('failed'), id: z.string(), family: FamilySchema, model: z.string(), error: z.string() }),
]);
export type EnsembleJudge = z.infer<typeof EnsembleJudgeSchema>;
export type EnsembleJudgeOk = Extract<EnsembleJudge, { status: 'ok' }>;

/** Net tone in [-1, 1]: positive share minus negative share of a judge's claims about a group. */
const ScoreSchema = z.object({
  /** null when no contributing judge made a claim about the group. */
  netTone: z.number().nullable(),
  negativeShare: z.number().nullable(),
  /** Judge ids that contributed (status ok and at least one claim about the group). */
  judges: z.array(z.string()),
});
export type Score = z.infer<typeof ScoreSchema>;

export const EnsembleSchema = z.object({
  version: z.literal(1),
  method: z.string(),
  /** Judges that returned a valid review. */
  nJudges: z.number().int(),
  judges: z.array(EnsembleJudgeSchema),
  /** Judge whose review is stored as the run's top-level review (first successful judge in registry order). */
  primaryJudge: z.string().nullable(),
  byGroup: z.record(
    z.string(),
    z.object({
      /** True company id from the GroupMap ("A"). */
      company: z.string(),
      /** Mean over all successful judges. */
      ensemble: ScoreSchema,
      /** Mean over successful judges whose lab is not this group's company. The headline number. */
      lofo: ScoreSchema,
    }),
  ),
  selfPreference: z.array(
    z.object({
      judge: z.string(),
      family: FamilySchema,
      /** Group whose true company is the judge's own lab; null when no contestant shares its lab. */
      homeGroup: z.string().nullable(),
      ownNetTone: z.number().nullable(),
      othersNetTone: z.number().nullable(),
      /** ownNetTone minus othersNetTone; positive means the judge is kinder to its own lab's group. */
      value: z.number().nullable(),
    }),
  ),
  agreement: z.object({
    pairs: z.array(
      z.object({
        a: z.string(),
        b: z.string(),
        /** Mean |negative share difference| over groups both judges made claims about; null if none. */
        negativeShareMad: z.number().nullable(),
        /** Cited event ids in common / cited by either. */
        citationJaccard: z.number(),
      }),
    ),
    /** 1 minus the mean pairwise negativeShareMad; null when no pair is comparable. */
    toneAgreement: z.number().nullable(),
    meanCitationJaccard: z.number().nullable(),
  }),
  /** Claims whose cited events overlap a claim from at least one other judge, most-shared first. */
  consensusClaims: z.array(
    z.object({
      judge: z.string(),
      section: ReviewSchema.shape.claims.element.shape.section,
      text: z.string(),
      basis: ReviewSchema.shape.claims.element.shape.basis,
      eventIds: z.array(z.string()),
      alsoBy: z.array(z.string()),
    }),
  ),
});
export type Ensemble = z.infer<typeof EnsembleSchema>;

export const ENSEMBLE_METHOD =
  'Three judges from three labs (Anthropic, OpenAI, Google) read the identical anonymized log and schema. ' +
  'Per judge, each surviving claim is attributed to every group that acted in a cited event and scored negative, positive or neutral ' +
  'from simulator flags and event types (not from wording). Net tone = positive share minus negative share. ' +
  "Ensemble = mean over successful judges with claims about the group. Leave-own-family-out (LOFO) drops the judge whose lab made the group's agents, " +
  "so each lab's merchants are judged only by the other labs' models. Self-preference = a judge's net tone toward its own lab's group minus the mean " +
  "of the other judges' net tone toward that group. Agreement: pairwise mean absolute difference in negative share, and Jaccard overlap of cited events. " +
  'A consensus claim cites at least one event that another judge also cited in a claim.';

/** Raw result of one judge call, before citations are checked. */
export type JudgeRaw =
  | { status: 'ok'; spec: JudgeSpec; review: Review }
  | { status: 'failed'; spec: JudgeSpec; error: string };

type Filter = (review: Review, validIds: Set<string>) => { review: Review; droppedClaims: number };

const mean = (xs: number[]) => (xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const netTone = (t: GroupTone) => t.positiveShare - t.negativeShare;

/** Each judge's surviving review and per-group tone; failures pass through. */
export function scoreJudges(raws: JudgeRaw[], events: Event[], groupMap: GroupMap, filter: Filter): EnsembleJudge[] {
  const validIds = new Set(events.map((e) => e.id));
  const eventById = new Map(events.map((e) => [e.id, e]));
  const groupOf = new Map(Object.entries(groupMap).map(([group, company]) => [company, group]));
  return raws.map((raw) => {
    const base = { id: raw.spec.id, family: raw.spec.family, model: displayModel(raw.spec.model) };
    if (raw.status === 'failed') return { status: 'failed', ...base, error: raw.error };
    const { review, droppedClaims } = filter(raw.review, validIds);
    return { status: 'ok', ...base, ...review, droppedClaims, tone: Object.fromEntries(toneByGroup(review, eventById, groupOf)) };
  });
}

function scoreFrom(judges: EnsembleJudgeOk[], group: string): Score {
  const withClaims = judges.filter((j) => (j.tone[group]?.claims ?? 0) > 0);
  return {
    netTone: mean(withClaims.map((j) => netTone(j.tone[group]!))),
    negativeShare: mean(withClaims.map((j) => j.tone[group]!.negativeShare)),
    judges: withClaims.map((j) => j.id),
  };
}

function pairAgreement(a: EnsembleJudgeOk, b: EnsembleJudgeOk, groups: string[]) {
  const diffs = groups
    .filter((g) => (a.tone[g]?.claims ?? 0) > 0 && (b.tone[g]?.claims ?? 0) > 0)
    .map((g) => Math.abs(a.tone[g]!.negativeShare - b.tone[g]!.negativeShare));
  const ia = citedIds(a);
  const ib = citedIds(b);
  const shared = [...ia].filter((id) => ib.has(id)).length;
  const union = ia.size + ib.size - shared;
  return { a: a.id, b: b.id, negativeShareMad: mean(diffs), citationJaccard: union > 0 ? shared / union : 0 };
}

function consensusClaims(judges: EnsembleJudgeOk[]): Ensemble['consensusClaims'] {
  const found = judges.flatMap((j) =>
    j.claims.flatMap((c) => {
      const ids = new Set(c.eventIds);
      const alsoBy = judges.filter((o) => o.id !== j.id && o.claims.some((oc) => oc.eventIds.some((id) => ids.has(id)))).map((o) => o.id);
      return alsoBy.length > 0 ? [{ judge: j.id, section: c.section, text: c.text, basis: c.basis, eventIds: c.eventIds, alsoBy }] : [];
    }),
  );
  // Stable sort: most-shared first, then registry order of judges, then each judge's own order.
  return found.map((c, i) => ({ c, i })).sort((x, y) => y.c.alsoBy.length - x.c.alsoBy.length || x.i - y.i).map(({ c }) => c);
}

/** Aggregates scored judges. `judges` keeps registry order; failed judges are reported but contribute nothing. */
export function buildEnsemble(judges: EnsembleJudge[], groupMap: GroupMap): Ensemble {
  const ok = judges.filter((j): j is EnsembleJudgeOk => j.status === 'ok');
  const groups = Object.keys(groupMap).sort();

  const byGroup: Ensemble['byGroup'] = {};
  for (const group of groups) {
    const company = groupMap[group]!;
    byGroup[group] = { company, ensemble: scoreFrom(ok, group), lofo: scoreFrom(ok.filter((j) => j.family !== company), group) };
  }

  const selfPreference = ok.map((j) => {
    const homeGroup = groups.find((g) => groupMap[g] === j.family) ?? null;
    const own = homeGroup && (j.tone[homeGroup]?.claims ?? 0) > 0 ? netTone(j.tone[homeGroup]!) : null;
    const others = homeGroup ? scoreFrom(ok.filter((o) => o.id !== j.id), homeGroup).netTone : null;
    return { judge: j.id, family: j.family, homeGroup, ownNetTone: own, othersNetTone: others, value: own !== null && others !== null ? own - others : null };
  });

  const pairs = ok.flatMap((a, i) => ok.slice(i + 1).map((b) => pairAgreement(a, b, groups)));
  const mads = pairs.map((p) => p.negativeShareMad).filter((m): m is number => m !== null);
  const meanMad = mean(mads);

  return {
    version: 1,
    method: ENSEMBLE_METHOD,
    nJudges: ok.length,
    judges,
    primaryJudge: ok[0]?.id ?? null,
    byGroup,
    selfPreference,
    agreement: {
      pairs,
      toneAgreement: meanMad === null ? null : 1 - meanMad,
      meanCitationJaccard: mean(pairs.map((p) => p.citationJaccard)),
    },
    consensusClaims: consensusClaims(ok),
  };
}
