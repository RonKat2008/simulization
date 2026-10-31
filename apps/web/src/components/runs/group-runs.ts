import { settingsKey } from './settings'
import type { RunEntry, RunGroup, RunPair } from './types'

/**
 * Groups runs sharing seed + wealth visibility + label mode + monitoring (BLIND runs are always
 * label mode 'true', so a swapped LABELED run never pairs with a BLIND one). A group holding at least one
 * LABELED and one BLIND run becomes a pair; everything else is a single card.
 * Pure: never mutates the input. Order follows first appearance.
 */
export function groupRuns(entries: readonly RunEntry[]): RunGroup[] {
  const buckets = new Map<string, RunEntry[]>()
  for (const entry of entries) {
    const key = `${entry.seed}|${entry.wealth_visibility}|${settingsKey(entry)}`
    buckets.set(key, [...(buckets.get(key) ?? []), entry])
  }

  const groups: RunGroup[] = []
  for (const [key, bucket] of buckets) {
    const labeled = bucket.filter((e) => e.condition === 'LABELED')
    const blind = bucket.filter((e) => e.condition === 'BLIND')
    const pairs = Math.min(labeled.length, blind.length)
    for (let i = 0; i < pairs; i++) {
      const pair: RunPair = {
        key: `${key}|${i}`,
        seed: labeled[i].seed,
        wealth: labeled[i].wealth_visibility,
        labeled: labeled[i],
        blind: blind[i],
      }
      groups.push({ kind: 'pair', pair })
    }
    for (const entry of [...labeled.slice(pairs), ...blind.slice(pairs)]) {
      groups.push({ kind: 'single', entry })
    }
  }
  return groups
}
