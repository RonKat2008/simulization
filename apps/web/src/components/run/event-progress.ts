import type { Event } from '@simulization/shared';

/** The store is sorted; a gap must be fetched before advancing its replay cursor. */
export function contiguousCursor(events: readonly Pick<Event, 'seq'>[]): number {
  let cursor = 0;
  for (const event of events) {
    if (event.seq === cursor + 1) cursor = event.seq;
    else if (event.seq > cursor + 1) break;
  }
  return cursor;
}

export function terminalDrained(status: {status?: string; stopped?: boolean; seq?: number}, events: readonly Pick<Event, 'seq'>[]): boolean {
  const terminal = status.status === 'done' || status.status === 'failed' || status.stopped === true;
  return terminal && Number.isSafeInteger(status.seq) && status.seq! >= 0 && contiguousCursor(events) >= status.seq!;
}
