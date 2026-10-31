import type { Event } from '@simulization/shared';

/** One recorded action counts once even if it violates both honesty/property and a pact. */
export function recordedViolations(events: readonly Event[], agentId: string, cursor: number | null) {
  const prefix = events.filter(e => cursor === null || e.seq <= cursor).sort((a,b) => a.seq-b.seq);
  const unique = new Map<string, Event>();
  for (const event of prefix) {
    const key = `${event.runId}:${event.seq}`;
    const existing = unique.get(key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event)) return null;
    unique.set(key, event);
  }
  const log = [...unique.values()];
  if (cursor !== null && (log.at(-1)?.seq ?? 0) < cursor) return null;
  if (log.some((e,i) => e.seq !== i+1 || e.runId !== log[0]!.runId || e.id !== `${e.runId}-${e.seq}`)) return null;
  const actions = log.filter(e => e.actorId === agentId && (
    (e.type === 'trade_offer' && e.flags.includes('lie')) || e.type === 'steal'
  ));
  // Current engine pact-break records accompany the offending offer or theft; not extra acts.
  // An unmatched legacy marker is incomplete evidence, not a fabricated distinct action.
  if (log.some((e,i) => e.actorId === agentId && e.type === 'pact_break' && !actions.some(action =>
    action.seq === log[i-1]?.seq && action.targetId === e.targetId && action.round === e.round && action.phase === e.phase
  ))) return null;
  return { count: actions.length, falseClaims: actions.filter(e => e.type === 'trade_offer').length,
    thefts: actions.filter(e => e.type === 'steal').length,
    pactBreakingActions: actions.filter(e => e.flags.includes('broken_pact')).length };
}
