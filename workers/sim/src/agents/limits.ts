// Owner: Person B. Concurrency cap, timeouts and retries (CLAUDE.md Part 3, risk 3).

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/** Runs fn with an AbortSignal that fires after `ms`; rejects with TimeoutError. */
export async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
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
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiters.shift()?.();
    }
  }
}

/** Maps items with at most `limit` in flight. Result order matches input order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const sem = new Semaphore(limit);
  return Promise.all(items.map((item) => sem.run(() => fn(item))));
}
