"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CONDITIONS,
  CreateRunResponseSchema,
  DEFAULT_SEED,
  parseSeed,
  readErrorMessage,
  type Condition,
} from "./schemas";

const CONDITION_COPY: Record<Condition, { title: string; detail: string }> = {
  LABELED: { title: "Labeled", detail: "Each agent sees which lab built every other agent." },
  BLIND: { title: "Blind", detail: "Agents see names only. Lab identity is withheld." },
};

type Phase = { kind: "idle" } | { kind: "pending" } | { kind: "error"; message: string };

export function LaunchForm({ onStarted }: { onStarted?: () => void }) {
  const router = useRouter();
  const seedId = useId();
  const seedHelpId = useId();
  const errorId = useId();
  const [condition, setCondition] = useState<Condition>("LABELED");
  const [seed, setSeed] = useState(String(DEFAULT_SEED));
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const pending = phase.kind === "pending";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsedSeed = parseSeed(seed);
    if (!parsedSeed.ok) {
      setPhase({ kind: "error", message: parsedSeed.message });
      return;
    }
    setPhase({ kind: "pending" });
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ condition, seed: parsedSeed.value }),
      });
      if (!res.ok) {
        setPhase({ kind: "error", message: await readErrorMessage(res) });
        return;
      }
      const parsed = CreateRunResponseSchema.safeParse(await res.json());
      if (!parsed.success) {
        setPhase({ kind: "error", message: "The server returned an unexpected response." });
        return;
      }
      onStarted?.();
      router.push(`/run/${encodeURIComponent(parsed.data.runId)}`);
    } catch {
      setPhase({ kind: "error", message: "Could not reach the server. Check that the app and simulation runtime are running." });
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 rounded-lg border bg-surface p-5 sm:p-6" noValidate>
      <fieldset className="flex flex-col gap-3" disabled={pending}>
        <legend className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Condition</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {CONDITIONS.map((c) => {
            const selected = condition === c;
            const tone = c === "BLIND" ? "accent" : "primary";
            return (
              <label
                key={c}
                className={`group relative flex cursor-pointer flex-col gap-1.5 rounded-md border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${
                  selected
                    ? tone === "accent"
                      ? "border-accent bg-accent/10"
                      : "border-primary bg-primary/10"
                    : "bg-surface-raised hover:border-muted-foreground/60 active:bg-background"
                }`}
              >
                <input
                  type="radio"
                  name="condition"
                  value={c}
                  checked={selected}
                  onChange={() => setCondition(c)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between gap-2">
                  <span className={`font-display text-xl font-semibold tracking-widest ${tone === "accent" ? "text-accent" : "text-primary"}`}>
                    {c}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`size-3 rounded-full border ${selected ? (tone === "accent" ? "border-accent bg-accent" : "border-primary bg-primary") : "border-muted-foreground/60"}`}
                  />
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">{CONDITION_COPY[c].detail}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={seedId} className="text-xs uppercase tracking-widest text-muted-foreground">
          Seed
        </label>
        <input
          id={seedId}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          disabled={pending}
          aria-describedby={`${seedHelpId} ${phase.kind === "error" ? errorId : ""}`.trim()}
          aria-invalid={phase.kind === "error" && !parseSeed(seed).ok ? true : undefined}
          className="h-11 w-full max-w-xs rounded-md border bg-background px-3 text-base tabular-nums transition-colors hover:border-muted-foreground/60 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60 aria-[invalid=true]:border-violation"
        />
        <p id={seedHelpId} className="text-xs leading-relaxed text-muted-foreground">
          Signed 32-bit integer. Use the same seed in both conditions for a paired comparison. The world is deterministic given the seed; model outputs are not.
        </p>
      </div>

      {phase.kind === "error" ? (
        <p
          id={errorId}
          role="alert"
          className="rounded-md border border-violation/60 bg-violation/10 px-3 py-2.5 text-sm leading-relaxed text-foreground"
        >
          <span className="mr-2 font-semibold text-violation">Could not start run.</span>
          {phase.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary/85 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? (
            <>
              <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              Starting run…
            </>
          ) : (
            `Start ${condition} run`
          )}
        </button>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {pending ? "Registering the run. You will be taken to the viewer." : "Agent count and run mode are set by the server."}
        </p>
      </div>
    </form>
  );
}
