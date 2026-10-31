import type { RunEntry, RunGroup, RunPair } from './types'

/**
 * Groups runs sharing seed + wealth visibility + recorded mode. A group holding at least one
 * LABELED and one BLIND run becomes a pair; everything else is a single card.
 * Pure: never mutates the input. Order follows first appearance.
 */
export function groupRuns(entries: readonly RunEntry[]): RunGroup[] {
  const buckets = new Map<string, RunEntry[]>()
  for (const entry of entries) {
    // Missing mode is not evidence that two experiments used the same runtime.
    const key = `${entry.seed}|${entry.wealth_visibility}|${entry.mode || `unrecorded:${entry.slug}`}`
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
