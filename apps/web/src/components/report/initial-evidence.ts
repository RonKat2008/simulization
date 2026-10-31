import archive from '../../data/initial-inventories.json';
import type { StartingLuckInput } from '../../../../../packages/shared/src/starting-luck';

/** Server-side evidence adapter. Never derive an allocation from final holdings or a seed. */
export function initialEvidenceForRun(runId: string, config: unknown): StartingLuckInput['initial'] {
  if (config && typeof config === 'object') {
    const raw = (config as Record<string, unknown>).initialInventory;
    if (raw && typeof raw === 'object') {
      const evidence = raw as Record<string, unknown>;
      if (evidence.version === 'initial-inventory-v1' && evidence.valuation === 'quality-as-value-v1'
        && evidence.runId === runId && evidence.phase === 'initial') {
        // startingLuck validates completeness, roster, unique goods and finite values.
        return raw as NonNullable<StartingLuckInput['initial']>;
      }
    }
  }
  const recorded = archive.runs.find(r => r.initial.runId === runId);
  if (!recorded || recorded.provenance.checkpointSeq !== 0 || recorded.provenance.eventCount !== 0
    || recorded.provenance.committedKeyCount !== 0) return undefined;
  return { ...recorded.initial, phase: 'initial' };
}
