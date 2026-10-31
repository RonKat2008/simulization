import { COMPANIES, type CompanyId } from './config';
import type { Condition, LabelMode } from './schemas';

/**
 * Swapped-label derangement: every OTHER agent's displayed company is the next lab in a fixed cycle
 * (A->B, B->C, C->A), so no displayed peer label is true and the mapping is consistent within a run.
 * An agent's own company is always shown truthfully.
 */
export const SWAPPED_LABEL_MAP: Readonly<Record<CompanyId, CompanyId>> = Object.freeze({ A: 'B', B: 'C', C: 'A' });

/** true company -> company displayed to OTHER agents. */
export type LabelMapping = Record<string, string>;

/** Identity unless label mode is 'swapped'. */
export function labelMapping(labelMode: LabelMode | undefined): LabelMapping {
  return Object.fromEntries(COMPANIES.map((c) => [c.id, labelMode === 'swapped' ? SWAPPED_LABEL_MAP[c.id] : c.id]));
}

/** Label mapping recorded in run config: null for BLIND (no labels are shown at all). */
export function runLabelMapping(condition: Condition, labelMode: LabelMode | undefined): LabelMapping | null {
  return condition === 'LABELED' ? labelMapping(labelMode) : null;
}

/** Company label shown to OTHER agents for a peer whose true company is `trueCompany`. */
export function displayedCompany(trueCompany: string, labelMode: LabelMode | undefined): string {
  if (labelMode !== 'swapped') return trueCompany;
  const shown = (SWAPPED_LABEL_MAP as Record<string, string>)[trueCompany];
  if (!shown) throw new Error(`Unknown company for label swap: ${trueCompany}`);
  return shown;
}
