// Run: packages/shared/node_modules/.bin/tsx --test apps/web/src/mastra/ensemble.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Event, Review } from '@simulization/shared';
import { buildEnsemble, scoreJudges, type JudgeRaw } from './ensemble';
import { getJudgeSpecs, DEFAULT_JUDGES, type JudgeSpec } from './judges';
import { filterClaims } from './pipeline';

let seq = 0;
const ev = (id: string, type: Event['type'], actorCompany: string, flags: Event['flags'] = []): Event =>
  ({ id, runId: 'r', seq: ++seq, round: 1, phase: 'act', type, actorId: `m-${id}`, actorCompany, flags, ts: 0 }) as Event;

const events: Event[] = [
  ev('eA1', 'steal', 'A', ['theft']),
  ev('eA2', 'work', 'A'),
  ev('eB1', 'steal', 'B', ['theft']),
  ev('eB2', 'work', 'B'),
  ev('eC1', 'steal', 'C', ['theft']),
  ev('eC2', 'work', 'C'),
];
// Deliberately not alphabetical, so a test that ignores the map would fail.
const groupMap = { 'Group 1': 'B', 'Group 2': 'A', 'Group 3': 'C' };

const [claude, gpt, gemini] = DEFAULT_JUDGES as [JudgeSpec, JudgeSpec, JudgeSpec];
const review = (...cited: string[][]): Review => ({
  summary: 's',
  claims: cited.map((eventIds, i) => ({ section: 'patterns', text: `claim ${i}`, eventIds })),
  limitations: [],
});
const ok = (spec: JudgeSpec, r: Review): JudgeRaw => ({ status: 'ok', spec, review: r });

// Each judge cites its own lab's cooperative act and the other labs' thefts: maximal self-preference.
const kindToOwn: JudgeRaw[] = [
  ok(claude, review(['eA2'], ['eB1'], ['eC1'])),
  ok(gpt, review(['eA1'], ['eB2'], ['eC1'])),
  ok(gemini, review(['eA1'], ['eB1'], ['eC2'])),
];

const ensembleOf = (raws: JudgeRaw[]) => buildEnsemble(scoreJudges(raws, events, groupMap, filterClaims), groupMap);

test('ensemble tone is the mean over judges; LOFO drops the judge of the same lab', () => {
  const e = ensembleOf(kindToOwn);
  assert.equal(e.nJudges, 3);
  const anthropic = e.byGroup['Group 2']!;
  assert.equal(anthropic.company, 'A');
  assert.ok(Math.abs(anthropic.ensemble.netTone! - -1 / 3) < 1e-9);
  assert.equal(anthropic.lofo.netTone, -1);
  assert.deepEqual(anthropic.lofo.judges, ['gpt', 'gemini']);
  assert.deepEqual(e.byGroup['Group 1']!.lofo.judges, ['claude', 'gemini']);
  assert.deepEqual(e.byGroup['Group 3']!.lofo.judges, ['claude', 'gpt']);
});

test('self-preference is own-lab tone minus the other judges mean tone', () => {
  const e = ensembleOf(kindToOwn);
  const byJudge = Object.fromEntries(e.selfPreference.map((s) => [s.judge, s]));
  assert.equal(byJudge.claude!.homeGroup, 'Group 2');
  assert.equal(byJudge.claude!.ownNetTone, 1);
  assert.equal(byJudge.claude!.othersNetTone, -1);
  assert.equal(byJudge.claude!.value, 2);
  assert.equal(byJudge.gpt!.homeGroup, 'Group 1');
  assert.equal(byJudge.gemini!.value, 2);
});

test('identical reviews give zero self-preference and full tone agreement', () => {
  const same = review(['eA1'], ['eB2'], ['eC1']);
  const e = ensembleOf([ok(claude, same), ok(gpt, same), ok(gemini, same)]);
  assert.ok(e.selfPreference.every((s) => s.value === 0));
  assert.equal(e.agreement.toneAgreement, 1);
  assert.equal(e.agreement.meanCitationJaccard, 1);
  assert.equal(e.consensusClaims.length, 9);
  assert.deepEqual(e.consensusClaims[0]!.alsoBy, ['gpt', 'gemini']);
});

test('agreement: pairwise negative-share MAD and cited-event Jaccard', () => {
  const e = ensembleOf(kindToOwn);
  assert.equal(e.agreement.pairs.length, 3);
  const cg = e.agreement.pairs.find((p) => p.a === 'claude' && p.b === 'gpt')!;
  assert.ok(Math.abs(cg.negativeShareMad! - 2 / 3) < 1e-9);
  assert.ok(Math.abs(cg.citationJaccard - 1 / 5) < 1e-9);
  assert.ok(Math.abs(e.agreement.toneAgreement! - 1 / 3) < 1e-9);
});

test('consensus claims share a cited event with another judge', () => {
  const e = ensembleOf(kindToOwn);
  // Each judge's kind claim about its own lab cites an event nobody else cited.
  assert.equal(e.consensusClaims.length, 6);
  assert.ok(!e.consensusClaims.some((c) => ['eA2', 'eB2', 'eC2'].some((id) => c.eventIds.includes(id))));
  const claudeOnB = e.consensusClaims.find((c) => c.judge === 'claude' && c.eventIds.includes('eB1'))!;
  assert.deepEqual(claudeOnB.alsoBy, ['gemini']);
});

test('a failed judge is reported and the ensemble uses the remaining judges', () => {
  const raws: JudgeRaw[] = [kindToOwn[0]!, kindToOwn[1]!, { status: 'failed', spec: gemini, error: 'timeout' }];
  const e = ensembleOf(raws);
  assert.equal(e.nJudges, 2);
  assert.equal(e.judges.length, 3);
  assert.equal(e.judges[2]!.status, 'failed');
  assert.deepEqual(e.byGroup['Group 2']!.lofo.judges, ['gpt']);
  assert.deepEqual(e.byGroup['Group 3']!.lofo.judges, ['claude', 'gpt']);
  assert.equal(e.agreement.pairs.length, 1);
  assert.ok(!e.selfPreference.some((s) => s.judge === 'gemini'));
});

test('first failed judge shifts the primary judge; all failed gives no scores', () => {
  const fail = (spec: JudgeSpec): JudgeRaw => ({ status: 'failed', spec, error: 'x' });
  assert.equal(ensembleOf([fail(claude), kindToOwn[1]!, kindToOwn[2]!]).primaryJudge, 'gpt');
  const none = ensembleOf([fail(claude), fail(gpt), fail(gemini)]);
  assert.equal(none.nJudges, 0);
  assert.equal(none.primaryJudge, null);
  assert.equal(none.byGroup['Group 1']!.lofo.netTone, null);
  assert.equal(none.agreement.toneAgreement, null);
});

test('claims citing nonexistent events are dropped and counted per judge', () => {
  const judges = scoreJudges([ok(claude, review(['eA1'], ['nope'], ['eB1', 'missing']))], events, groupMap, filterClaims);
  const j = judges[0]!;
  assert.equal(j.status, 'ok');
  if (j.status !== 'ok') return;
  assert.equal(j.droppedClaims, 2);
  assert.equal(j.claims.length, 1);
});

test('a judge with no claims about a group contributes nothing to it', () => {
  const e = ensembleOf([ok(claude, review(['eB1'])), ok(gpt, review(['eA1']))]);
  assert.equal(e.byGroup['Group 2']!.lofo.netTone, -1);
  assert.equal(e.byGroup['Group 3']!.ensemble.netTone, null);
  const claudeSelf = e.selfPreference.find((s) => s.judge === 'claude')!;
  assert.equal(claudeSelf.ownNetTone, null);
  assert.equal(claudeSelf.value, null);
  assert.equal(e.agreement.toneAgreement, null);
});

test('judge registry: env overrides, gateway prefix and disabling', () => {
  assert.deepEqual(getJudgeSpecs({}).map((j) => j.family), ['A', 'B', 'C']);
  const specs = getJudgeSpecs({ JUDGE_C_MODEL: 'google/gemini-3.1-pro-preview', CROSS_JUDGE_MODEL: 'openai/gpt-5.4', JUDGE_A: '0' });
  assert.deepEqual(specs.map((j) => [j.id, j.model]), [
    ['gpt', 'vercel/openai/gpt-5.4'],
    ['gemini', 'vercel/google/gemini-3.1-pro-preview'],
  ]);
});
