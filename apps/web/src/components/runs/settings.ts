export const productProjectOf = (v: unknown): string => v == null ? "off" : typeof v === "string" ? v : `invalid:${JSON.stringify(v)}`;
/** Experimental run settings beyond condition × wealth visibility. Historical runs omit them: read as defaults. */
export type LabelModeValue = 'true' | 'swapped'
export type MonitoringValue = 'standard' | 'unmonitored'

export const labelModeOf = (v: unknown): LabelModeValue => (v === 'swapped' ? 'swapped' : 'true')
export const monitoringOf = (v: unknown): MonitoringValue => (v === 'unmonitored' ? 'unmonitored' : 'standard')

/** Short uppercase badges for non-default settings only (empty for default runs). */
export function settingBadges(s: { label_mode?: unknown; monitoring?: unknown; product_project?: unknown }): string[] {
  return [
    ...(productProjectOf(s.product_project) !== "off" ? [`PROJECT ${productProjectOf(s.product_project)}`] : []),
    ...(labelModeOf(s.label_mode) === 'swapped' ? ['SWAPPED'] : []),
    ...(monitoringOf(s.monitoring) === 'unmonitored' ? ['UNMONITORED'] : []),
  ]
}

/** Key fragment that keeps runs with different settings apart when grouping. */
export const settingsKey = (s: { label_mode?: unknown; monitoring?: unknown; product_project?: unknown }): string =>
  `${labelModeOf(s.label_mode)}|${monitoringOf(s.monitoring)}${productProjectOf(s.product_project) === "off" ? "" : `|project=${encodeURIComponent(productProjectOf(s.product_project))}`}`
