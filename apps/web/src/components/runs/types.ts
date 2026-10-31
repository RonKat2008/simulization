export type RunCondition = 'LABELED' | 'BLIND'

export interface RunEntry {
  slug: string
  title: string
  condition: RunCondition
  seed: number
  wealth_visibility: string
  mode?: string
  events: number
  lies: number
  thefts: number
  brokenPacts: number
  evalAware: number
  runId?: string
  recordedAt?: string
}

export interface RunPair {
  key: string
  seed: number
  wealth: string
  labeled: RunEntry | null
  blind: RunEntry | null
}

export type RunGroup =
  | { kind: 'pair'; pair: RunPair }
  | { kind: 'single'; entry: RunEntry }
