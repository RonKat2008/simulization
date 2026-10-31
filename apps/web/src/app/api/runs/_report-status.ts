// A persisted review is authoritative. A busy/unreachable reviewer is unknown, not pending forever.
export async function reportDeliveryStatus(
  status: unknown, mode: unknown, hasReview: boolean,
  lookup: () => Promise<unknown>, timeoutMs = 750,
): Promise<string> {
  if (hasReview) return 'done';
  if (status !== 'done' || mode === 'deterministic-stub' || mode === 'stalled-stub-test') return 'not-requested';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const job = await Promise.race([
      lookup(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Reviewer busy')), timeoutMs); }),
    ]) as {state?: string; attempts?: number};
    if (job.state === 'failed') return (job.attempts ?? 0) >= 3 ? 'failed' : 'retrying';
    if (job.state === 'pending') return 'pending';
    return 'unknown'; // A job acknowledgement without a persisted review is not proof of a report.
  } catch { return 'unknown'; }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
