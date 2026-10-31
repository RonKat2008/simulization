import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { labelModeOf, monitoringOf, productProjectOf } from './settings'
import type { RunEntry } from './types'

const RUNS_DIR = path.join(process.cwd(), 'public', 'runs')

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function normalize(raw: unknown): RunEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.slug !== 'string' || !/^[A-Za-z0-9_-]+$/.test(r.slug)) return null
  const condition = String(r.condition).toUpperCase() === 'BLIND' ? 'BLIND' : 'LABELED'
  return {
    slug: r.slug,
    title: typeof r.title === 'string' && r.title ? r.title : r.slug,
    condition,
    seed: num(r.seed),
    wealth_visibility: typeof r.wealth_visibility === 'string' ? r.wealth_visibility : 'private',
    label_mode: labelModeOf(r.label_mode),
    monitoring: monitoringOf(r.monitoring),
    product_project: productProjectOf(r.product_project),
    mode: typeof r.mode === 'string' ? r.mode : undefined,
    events: num(r.events),
    lies: num(r.lies),
    thefts: num(r.thefts),
    brokenPacts: num(r.brokenPacts),
    evalAware: num(r.evalAware),
    runId: typeof r.runId === 'string' ? r.runId : undefined,
    recordedAt: typeof r.recordedAt === 'string' ? r.recordedAt : undefined,
  }
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(RUNS_DIR, file), 'utf8'))
}

function countFlag(events: unknown[], flag: string): number {
  return events.filter((e) => {
    const flags = (e as { flags?: unknown })?.flags
    return Array.isArray(flags) && flags.includes(flag)
  }).length
}

async function featuredEntry(): Promise<RunEntry[]> {
  try {
    const data = (await readJson('featured.json')) as { run?: Record<string, unknown>; events?: unknown[] }
    const run = data.run ?? {}
    const events = Array.isArray(data.events) ? data.events : []
    const entry = normalize({
      slug: 'featured',
      title: 'Featured run',
      condition: run.condition,
      seed: run.seed,
      wealth_visibility: run.wealth_visibility,
      label_mode: run.label_mode,
      monitoring: run.monitoring,
      product_project: run.product_project,
      mode: run.mode,
      events: events.length,
      lies: countFlag(events, 'lie'),
      thefts: countFlag(events, 'theft'),
      brokenPacts: countFlag(events, 'broken_pact'),
      evalAware: countFlag(events, 'eval_aware'),
      runId: run.id,
    })
    return entry ? [entry] : []
  } catch {
    return []
  }
}

/** Reads public/runs/index.json; falls back to the featured run. Never throws. */
export async function loadRuns(): Promise<RunEntry[]> {
  try {
    const raw = await readJson('index.json')
    const list = Array.isArray(raw) ? raw : (raw as { runs?: unknown })?.runs
    if (Array.isArray(list)) {
      const entries = list.map(normalize).filter((e): e is RunEntry => e !== null)
      if (entries.length > 0) return entries
    }
  } catch {
    // manifest missing or malformed: fall through
  }
  return featuredEntry()
}
