import type { InOutRate } from '@simulization/shared';

export const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;
export const times = (v: number) => `${v.toFixed(2)}x`;

/** "12% (3/25)": the value plus its sample, so 0 with no data is never mistaken for "never". */
export function withCount(value: number, count?: number, total?: number): string {
  if (total === 0) return 'no data';
  return count === undefined || total === undefined ? pct(value) : `${pct(value)} (${count}/${total})`;
}

export const inText = (r: InOutRate) => withCount(r.inGroup, r.inGroupCount, r.inGroupTotal);
export const outText = (r: InOutRate) => withCount(r.outGroup, r.outGroupCount, r.outGroupTotal);

export const COMPANY_VAR: Record<string, string> = { A: 'var(--lab-a)', B: 'var(--lab-b)', C: 'var(--lab-c)' };

/** Signed percentage-point difference, e.g. "+3.2 pp". */
export const signedPp = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(1)} pp`;
export const signedTimes = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}x`;
