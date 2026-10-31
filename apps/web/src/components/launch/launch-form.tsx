"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OptionGroup, type Option } from "./option-group";
import {
  DEFAULT_SEED,
  DEFAULT_WEALTH_VISIBILITY,
  parseSeed,
  type Condition,
  type WealthVisibility,
  type CreateRunBody,
} from "./schemas";
import { startRun } from "./start-run";

const CONDITION_OPTIONS: readonly Option<Condition>[] = [
  { value: "LABELED", tone: "primary", title: "LABELED", detail: "Each agent sees which lab built every other agent. Tests in-group bias when identity is salient." },
  { value: "BLIND", tone: "accent", title: "BLIND", detail: "Agents see names only; lab identity is withheld. The control: any bias must come from behavior, not labels." },
];

const WEALTH_OPTIONS: readonly Option<WealthVisibility>[] = [
  { value: "private", tone: "primary", title: "PRIVATE", detail: "Private wealth: agents cannot see others' coins. Hierarchy has to be inferred from behavior." },
  { value: "public", tone: "accent", title: "PUBLIC", detail: "Public wealth: every agent sees everyone's coins. Makes status and inequality directly observable." },
];

type Phase =
  | { kind: "idle" }
  | { kind: "pending"; what: "single" | "pair" }
  | { kind: "error"; message: string }
  | { kind: "pair"; labeled: string | null; blind: string | null; message?: string };

export function LaunchForm({ onStarted }: { onStarted?: () => void }) {
  const router = useRouter();
  const seedId = useId();
  const seedHelpId = useId();
  const errorId = useId();
  const [condition, setCondition] = useState<Condition>("LABELED");
  const [wealth, setWealth] = useState<WealthVisibility>(DEFAULT_WEALTH_VISIBILITY);
  const [seed, setSeed] = useState(String(DEFAULT_SEED));
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const pending = phase.kind === "pending";
  // Preserve identity after an uncertain response so retry cannot buy a second live run.
  const pendingRequests = useRef(new Map<string, string>());
  async function startOnce(body: CreateRunBody) {
    const key = JSON.stringify(body);
    const requestId = pendingRequests.current.get(key) ?? crypto.randomUUID();
    pendingRequests.current.set(key, requestId);
    const result = await startRun(body, requestId);
    // Retain successful halves too: retrying a partially failed pair must reuse its first run.
    return result;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsedSeed = parseSeed(seed);
    if (!parsedSeed.ok) {
      setPhase({ kind: "error", message: parsedSeed.message });
      return;
    }
    setPhase({ kind: "pending", what: "single" });
    const result = await startOnce({ condition, seed: parsedSeed.value, wealth_visibility: wealth });
    if (!result.ok) {
      setPhase({ kind: "error", message: result.message });
      return;
    }
    onStarted?.();
    router.push(`/run/${encodeURIComponent(result.runId)}`);
  }

  async function startPair() {
    if (pending) return;
    const parsedSeed = parseSeed(seed);
    if (!parsedSeed.ok) {
      setPhase({ kind: "error", message: parsedSeed.message });
      return;
    }
    setPhase({ kind: "pending", what: "pair" });
    const base = { seed: parsedSeed.value, wealth_visibility: wealth };
    const labeled = await startOnce({ ...base, condition: "LABELED" });
    if (!labeled.ok) {
      setPhase({ kind: "error", message: `LABELED run failed, BLIND was not started. ${labeled.message}` });
      return;
    }
    onStarted?.();
    const blind = await startOnce({ ...base, condition: "BLIND" });
    onStarted?.();
    setPhase({
      kind: "pair",
      labeled: labeled.runId,
      blind: blind.ok ? blind.runId : null,
      message: blind.ok ? undefined : `BLIND run failed; the LABELED run is already running. ${blind.message}`,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 rounded-lg border bg-surface p-5 sm:p-6" noValidate>
      <OptionGroup legend="Condition" name="condition" options={CONDITION_OPTIONS} value={condition} onChange={setCondition} disabled={pending} />
      <OptionGroup legend="Wealth visibility" name="wealth_visibility" options={WEALTH_OPTIONS} value={wealth} onChange={setWealth} disabled={pending} />

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

      {phase.kind === "pair" ? (
        <div role="status" className="flex flex-col gap-2 rounded-md border border-primary/60 bg-primary/10 px-3 py-2.5 text-sm leading-relaxed">
          <p className="font-semibold">Matched pair started (same seed and wealth visibility).</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {phase.labeled ? <li><Link href={`/run/${encodeURIComponent(phase.labeled)}`} className="underline underline-offset-4 hover:text-accent">LABELED run: {phase.labeled}</Link></li> : null}
            {phase.blind ? <li><Link href={`/run/${encodeURIComponent(phase.blind)}`} className="underline underline-offset-4 hover:text-accent">BLIND run: {phase.blind}</Link></li> : null}
          </ul>
          {phase.message ? <p role="alert" className="text-violation">{phase.message}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary/85 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        >
          {phase.kind === "pending" && phase.what === "single" ? (
            <>
              <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              Starting run…
            </>
          ) : (
            `Start ${condition} run`
          )}
        </button>
        <button
          type="button"
          onClick={startPair}
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border px-5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary active:bg-surface-raised disabled:cursor-wait disabled:opacity-60"
        >
          {phase.kind === "pending" && phase.what === "pair" ? "Starting pair…" : "Start matched pair"}
        </button>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {pending ? "Registering with the run service." : "Matched pair = LABELED + BLIND, same seed and wealth visibility. Run mode and agent count are set by the server."}
        </p>
      </div>
    </form>
  );
}
