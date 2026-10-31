// Owner: Person B. Shared helpers for the spike scripts (Node 22 + tsx; no dotenv dependency).
// The workers tsconfig has no @types/node, so we declare the tiny slice of `process` we use.
declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit(code?: number): never;
  cwd(): string;
  loadEnvFile?(path: string): void;
};

/** Loads repo-root .env (never overrides variables already set in the shell). Safe if the file is missing. */
export function loadEnv(): void {
  for (const path of [`${process.cwd()}/../../.env`, `${process.cwd()}/.env`]) {
    try {
      process.loadEnvFile?.(path);
    } catch {
      // File missing or unreadable: fall through to process.env only.
    }
  }
}

/** Returns the env var, or prints a clear message and exits 1. */
export function requireEnv(name: string): string {
  loadEnv();
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}: set ${name} in .env (repo root) or export it in your shell.`);
    process.exit(1);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  loadEnv();
  return process.env[name] || undefined;
}

/** Value of `--flag value` from argv, if present. */
export function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function exit(code: number): never {
  return process.exit(code);
}
