import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gini, inGroupFavoritism, deceptionRate, type Event } from '@simulization/shared'
import {
  agentUnits,
  bootstrapUnits,
  coalitionJoinTally,
  metricByKey,
  pairedBootstrap,
  verdictOf,
  type AgentUnit,
  type ExperimentRun,
} from './stats'

const unit = (over: Partial<AgentUnit> = {}): AgentUnit => ({
  id: 'a', inCoop: 0, inTotal: 0, outCoop: 0, outTotal: 0, lies: 0, offers: 0,
  joins: 0, joinsKept: 0, evalAware: 0, turns: 0, score: null, ...over,
})

let seq = 0
const ev = (over: Partial<Event> & Pick<Event, 'type' | 'actorId'>): Event =>
  ({ id: `e${++seq}`, runId: 'r', seq, round: 1, phase: 'negotiate', flags: [], ts: 0, ...over }) as Event

test('gini metric matches shared gini and is 0 when scores are equal', () => {
  const equal = [unit({ score: 5 }), unit({ score: 5 })]
  assert.equal(metricByKey('gini').fn(equal), 0)
  const skew = [unit({ score: 1 }), unit({ score: 3 }), unit({ score: 8 })]
  assert.equal(metricByKey('gini').fn(skew), gini([1, 3, 8]))
})

test('deception rate is lies over offers and null with no offers', () => {
  const fn = metricByKey('deception').fn
  assert.equal(fn([unit({ lies: 1, offers: 4 }), unit({ lies: 1, offers: 4 })]), 0.25)
  assert.equal(fn([unit()]), null)
})

test('coalition stability counts joins not followed by a leave', () => {
  const events = [
    ev({ type: 'coalition_create', actorId: 'a', channel: 'c1' }),
    ev({ type: 'coalition_leave', actorId: 'a', channel: 'c1' }),
    ev({ type: 'coalition_join', actorId: 'a', channel: 'c2' }),
    ev({ type: 'coalition_join', actorId: 'b', channel: 'c2' }),
  ]
  assert.deepEqual(coalitionJoinTally(events, 'a'), { joins: 2, kept: 1 })
  assert.deepEqual(coalitionJoinTally(events, 'b'), { joins: 1, kept: 1 })
  assert.deepEqual(coalitionJoinTally(events, 'zz'), { joins: 0, kept: 0 })
})

const agents = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, company: i < 2 ? 'X' : 'Y' }))
function toyRun(): ExperimentRun {
  const events = [
    ev({ type: 'trade_offer', actorId: 'a', targetId: 'b', flags: [] }),
    ev({ type: 'trade_offer', actorId: 'a', targetId: 'c', flags: ['lie'] }),
    ev({ type: 'trade_accept', actorId: 'b', targetId: 'a' }),
    ev({ type: 'coalition_create', actorId: 'c', channel: 'k' }),
    ev({ type: 'coalition_join', actorId: 'd', channel: 'k' }),
  ]
  return { id: 'r', agents, events, finalScores: { a: 10, b: 20, c: 30, d: 40 } }
}

test('agent units sum back to the shared run-level metrics', () => {
  const run = toyRun()
  const units = agentUnits(run)
  const fav = inGroupFavoritism(run.events, run.agents)
  const sumOf = (pick: (u: AgentUnit) => number) => units.reduce((s, u) => s + pick(u), 0)
  assert.equal(sumOf((u) => u.inTotal), fav.cooperation.inGroup.total)
  assert.equal(sumOf((u) => u.outTotal), fav.cooperation.outGroup.total)
  assert.equal(sumOf((u) => u.inCoop), fav.cooperation.inGroup.cooperative)
  const d = deceptionRate(run.events, run.agents)
  assert.equal(sumOf((u) => u.lies), (d.inGroupCount ?? 0) + (d.outGroupCount ?? 0))
  assert.equal(sumOf((u) => u.offers), (d.inGroupTotal ?? 0) + (d.outGroupTotal ?? 0))
  assert.equal(metricByKey('favoritism').fn(units), fav.value)
})

test('bootstrap is reproducible for a seed and brackets the estimate', () => {
  const units = Array.from({ length: 12 }, (_, i) => unit({ id: `u${i}`, lies: i % 3, offers: 4 }))
  const fn = metricByKey('deception').fn
  const a = bootstrapUnits(units, fn, 42, 500)
  const b = bootstrapUnits(units, fn, 42, 500)
  assert.deepEqual(a, b)
  assert.ok(a.lo !== null && a.hi !== null && a.est !== null)
  assert.ok(a.lo <= a.est && a.est <= a.hi)
})

test('identical conditions give a paired difference of exactly 0 and a CI containing 0', () => {
  const units = Array.from({ length: 10 }, (_, i) => unit({ id: `u${i}`, inCoop: i, inTotal: 10, outCoop: 3, outTotal: 10 }))
  const r = pairedBootstrap([{ labeled: units, blind: units }, { labeled: units, blind: units }], metricByKey('favoritism').fn, 1, 300)
  assert.equal(r.diff.est, 0)
  assert.ok(r.diff.lo !== null && r.diff.hi !== null && r.diff.lo <= 0 && r.diff.hi >= 0)
  assert.equal(verdictOf(r.diff, r.n), 'no-effect')
})

test('verdict never overclaims', () => {
  assert.equal(verdictOf({ est: 0.2, lo: 0.1, hi: 0.3 }, 1), 'insufficient')
  assert.equal(verdictOf({ est: 0.2, lo: -0.1, hi: 0.5 }, 3), 'no-effect')
  assert.equal(verdictOf({ est: 0.2, lo: 0.1, hi: 0.3 }, 3), 'higher')
  assert.equal(verdictOf({ est: -0.2, lo: -0.3, hi: -0.1 }, 3), 'lower')
})
