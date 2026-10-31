import type { Event } from '@simulization/shared';

/** Privileged observer fold; rebuild at the cursor, never count deliveries as turns. */
export function productProjectHistory(events: readonly Event[], agentId: string, cursor: number | null) {
  let completed = false;
  let progress: { goodId: string; turns: number } | null = null;
  let qualityGain: number | undefined;
  let observed = false;
  const seen = new Set<string>();
  for (const event of [...events].sort((a, b) => a.seq - b.seq)) {
    if (event.actorId !== agentId || (cursor !== null && event.seq > cursor)) continue;
    const key = `${event.runId}:${event.seq}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = event.productProject;
    if (!p || p.version !== 'four-turn-v1') continue;
    if (event.type === 'product_progress' && !completed) {
      observed = true;
      progress = { goodId: p.goodId, turns: p.turns };
    } else if (event.type === 'product_reset') {
      observed = true;
      progress = null;
    } else if (event.type === 'product_complete') {
      observed = true;
      progress = null;
      completed = true;
      qualityGain = p.qualityGain;
    }
  }
  return { observed, completed, progress, qualityGain };
}
