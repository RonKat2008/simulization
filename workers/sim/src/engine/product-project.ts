import type { Event } from '@simulization/shared';
import type { WorldState } from './types';

type Emit = (s: WorldState, events: Event[], id: string, type: Event['type'], details?: Partial<Event>) => Event;
type Reason = NonNullable<NonNullable<Event['productProject']>['reason']>;
export const projectEnabled = (s: WorldState) => s.product_project === 'four-turn-v1';
export function canImprove(s: WorldState, id: string): boolean {
  const p = s.productProjects?.[id];
  return projectEnabled(s) && !p?.completed && s.agents[id]!.inventory.length > 0 &&
    (s.round <= 3 || !!p?.progress && p.progress.lastRound === s.round - 1 &&
      s.agents[id]!.inventory.some(g => g.goodId === p.progress!.goodId));
}
export function resetProject(s: WorldState, events: Event[], id: string, reason: Reason, emit: Emit): void {
  if (!projectEnabled(s)) return;
  const p = s.productProjects?.[id];
  if (!p?.progress) return;
  const goodId = p.progress.goodId;
  delete p.progress;
  emit(s, events, id, 'product_reset', { productProject: { version: 'four-turn-v1', goodId, turns: 0, reason } });
}
export function improve(s: WorldState, events: Event[], id: string, goodId: string, details: Partial<Event>, emit: Emit): void {
  const good = s.agents[id]!.inventory.find(g => g.goodId === goodId);
  if (!good || !canImprove(s, id)) throw new Error('Illegal improvement');
  const projects = s.productProjects ??= {};
  const p = projects[id] ??= { completed: false };
  const continuing = p.progress?.goodId === goodId && p.progress.lastRound === s.round - 1;
  if (!continuing && s.round > 3) throw new Error('Project start deadline');
  if (p.progress && !continuing) resetProject(s, events, id, p.progress.goodId === goodId ? 'nonconsecutive' : 'target_change', emit);
  const turns = (p.progress?.turns ?? 0) + 1;
  if (turns === 4) {
    const previousQuality = good.trueQuality;
    const qualityGain = Math.min(6, 10 - previousQuality);
    good.trueQuality += qualityGain;
    delete p.progress;
    p.completed = true;
    emit(s, events, id, 'product_complete', { ...details, groundTruth: { trueQuality: good.trueQuality },
      productProject: { version: 'four-turn-v1', goodId, turns, previousQuality, qualityGain } });
  } else {
    p.progress = { goodId, turns, lastRound: s.round };
    emit(s, events, id, 'product_progress', { ...details, groundTruth: { trueQuality: good.trueQuality },
      productProject: { version: 'four-turn-v1', goodId, turns } });
  }
}
