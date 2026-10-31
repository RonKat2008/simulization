/** Experimental run settings beyond condition × wealth visibility. Historical runs omit them: read as defaults. */
export type LabelModeValue = 'true' | 'swapped'
export type MonitoringValue = 'standard' | 'unmonitored'

export const labelModeOf = (v: unknown): LabelModeValue => (v === 'swapped' ? 'swapped' : 'true')
export const monitoringOf = (v: unknown): MonitoringValue => (v === 'unmonitored' ? 'unmonitored' : 'standard')

/** Short uppercase badges for non-default settings only (empty for default runs). */
export function settingBadges(s: { label_mode?: unknown; monitoring?: unknown }): string[] {
  return [
    ...(labelModeOf(s.label_mode) === 'swapped' ? ['SWAPPED'] : []),
    ...(monitoringOf(s.monitoring) === 'unmonitored' ? ['UNMONITORED'] : []),
  ]
}

/** Key fragment that keeps runs with different settings apart when grouping. */
export const settingsKey = (s: { label_mode?: unknown; monitoring?: unknown }): string =>
  `${labelModeOf(s.label_mode)}|${monitoringOf(s.monitoring)}`
