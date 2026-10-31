// Owner: Person B. Concurrency cap, timeouts and retries (CLAUDE.md Part 3, risk 3).

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/** Epoch-ms deadline per signal we created, so stores can recover it from the signal they are handed. */
const deadlines = new WeakMap<AbortSignal, number>();

/** Deadline (epoch ms) of a signal made by withTimeout / signalFromDeadline; undefined for foreign signals. */
export function signalDeadline(signal: AbortSignal | undefined): number | undefined {
  return signal ? deadlines.get(signal) : undefined;
}

/**
 * Rebuilds an AbortSignal from an epoch-ms deadline. AbortSignal cannot cross Durable Object RPC / HTTP,
 * so remote actors receive the deadline and build their own signal. Undefined deadline -> no signal.
 */
export function signalFromDeadline(deadline: number | undefined): AbortSignal | undefined {
  if (deadline === undefined) return undefined;
  const signal = AbortSignal.timeout(Math.max(0, deadline - Date.now()));
  deadlines.set(signal, deadline);
  return signal;
}

/** True when the turn's budget is gone: its result must not be saved (the world already counted a pass). */
export function isTurnExpired(signal: AbortSignal | undefined, deadline?: number): boolean {
  const limit = deadline ?? signalDeadline(signal);
  return signal?.aborted === true || (limit !== undefined && Date.now() >= limit);
}

/** Runs fn with an AbortSignal that fires after `ms`; rejects with TimeoutError. */
export async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  deadlines.set(controller.signal, Date.now() + ms);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(ms));
    }, ms);
  });
  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Calls fn up to retries + 1 times; rethrows the last error. */
export async function withRetry<T>(retries: number, fn: (attempt: number) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/** Counting semaphore. */
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      // The releasing run hands its slot straight to us (active stays counted), so nobody can sneak past the cap.
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    } else {
      this.active++;
    }
    try {
      return await fn();
    } finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    }
  }
}

/** Maps items with at most `limit` in flight. Result order matches input order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const sem = new Semaphore(limit);
  return Promise.all(items.map((item) => sem.run(() => fn(item))));
}
