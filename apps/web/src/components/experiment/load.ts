import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { EventSchema, evalAwarenessRate } from '@simulization/shared'
import { groupRuns } from '../runs/group-runs'
import { loadRuns } from '../runs/load-manifest'
import { settingsKey } from '../runs/settings'
import type { RunEntry } from '../runs/types'
import {
  METRICS,
  agentUnits,
  bootstrapUnits,
  pairedBootstrap,
  type ExperimentRun,
  type Interval,
  type MetricKey,
  type PairUnits,
  type PairedResult,
} from './stats'

const RUNS_DIR = path.join(process.cwd(), 'public', 'runs')
const SEED_BASE = 20260
export type MetricResults = Record<MetricKey, PairedResult>

export interface ExperimentPair {
  key: string
  seed: number
  wealth: string
  labeled: RunEntry
  blind: RunEntry
  /** Per-run, per-metric estimate with a bootstrap CI over agents. */
  runCis: { labeled: Record<MetricKey, Interval>; blind: Record<MetricKey, Interval> }
  /** Eval-aware turn counts straight from the metric function (shown as counts, not rates). */
  evalAwareTurns: { labeled: number; blind: number }
}

export interface ExperimentData {
  pairs: ExperimentPair[]
  pooled: MetricResults
  roster: { agents: number; companies: number } | null
}

async function readRun(slug: string): Promise<ExperimentRun | null> {
  try {
    const raw = JSON.parse(await readFile(path.join(RUNS_DIR, `${slug}.json`), 'utf8')) as {
      run?: { id?: string; agents?: { id: string; company: string }[]; finalScores?: Record<string, number> }
      events?: unknown[]
    }
    const events = (raw.events ?? []).flatMap((e) => {
      const parsed = EventSchema.safeParse(e)
      return parsed.success ? [parsed.data] : []
    })
    const agents = raw.run?.agents ?? []
    if (events.length === 0 || agents.length === 0) return null
    return {
      id: raw.run?.id ?? slug,
      agents: agents.map((a) => ({ id: a.id, company: a.company })),
      events,
      finalScores: raw.run?.finalScores ?? {},
    }
  } catch {
    return null
  }
}

function intervals(units: PairUnits['labeled'], seed: number): Record<MetricKey, Interval> {
  return Object.fromEntries(
    METRICS.map((m, i) => [m.key, bootstrapUnits(units, m.fn, seed + i)]),
  ) as Record<MetricKey, Interval>
}

/** Discovers matched pairs from index.json at build time. New pairs appear with no code change. */
export async function loadExperiment(): Promise<ExperimentData> {
  const groups = groupRuns(await loadRuns())
  const found: { entry: ExperimentPair; units: PairUnits }[] = []
  let roster: ExperimentData['roster'] = null
  for (const g of groups) {
    if (g.kind !== 'pair' || !g.pair.labeled || !g.pair.blind) continue
    // The headline comparison pools only default-setting pairs (true labels, standard monitoring).
    if (settingsKey(g.pair.labeled) !== 'true|standard' || settingsKey(g.pair.blind) !== 'true|standard') continue
    const [l, b] = await Promise.all([readRun(g.pair.labeled.slug), readRun(g.pair.blind.slug)])
    if (!l || !b) continue
    const units = { labeled: agentUnits(l), blind: agentUnits(b) }
    const seed = SEED_BASE + found.length * 100
    roster ??= { agents: l.agents.length, companies: new Set(l.agents.map((a) => a.company)).size }
    found.push({
      units,
      entry: {
        key: g.pair.key,
        seed: g.pair.seed,
        wealth: g.pair.wealth,
        labeled: g.pair.labeled,
        blind: g.pair.blind,
        runCis: { labeled: intervals(units.labeled, seed), blind: intervals(units.blind, seed + 50) },
        evalAwareTurns: {
          labeled: evalAwarenessRate(l.events, l.agents).count ?? 0,
          blind: evalAwarenessRate(b.events, b.agents).count ?? 0,
        },
      },
    })
  }
  const pooled = Object.fromEntries(
    METRICS.map((m, i) => [m.key, pairedBootstrap(found.map((f) => f.units), m.fn, SEED_BASE + 9000 + i)]),
  ) as MetricResults
  return { pairs: found.map((f) => f.entry), pooled, roster }
}
