"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, buttonClass, CARD_CLASS } from "@/components/landing/ui";
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
  { value: "LABELED", tone: "primary", title: "Yes — show company names", detail: "Agents see the company behind each merchant (LABELED)." },
  { value: "BLIND", tone: "accent", title: "No — hide company names", detail: "Agents see merchant names but no company labels (BLIND). They may still infer identity from behavior." },
];

const WEALTH_OPTIONS: readonly Option<WealthVisibility>[] = [
  { value: "private", tone: "primary", title: "No — keep balances private", detail: "Agents know their own coins; other merchants’ balances are omitted." },
  { value: "public", tone: "accent", title: "Yes — show coin balances", detail: "Agents see others’ current coins, but never their true inventory quality or value." },
];

type Phase =
  | { kind: "idle" }
  | { kind: "pending"; what: "single" | "pair" }
  | { kind: "error"; message: string }
  | { kind: "pair"; labeled: string | null; blind: string | null; message?: string };

export function LaunchForm({ onStarted }: { onStarted?: () => void }) {
  const router = useRouter();
  const seedId = useId();
  const seedRef = useRef<HTMLInputElement>(null);
  const seedHelpId = useId();
  const errorId = useId();
  const seedErrorId = useId();
  const [seedTouched, setSeedTouched] = useState(false);
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
  const seedCheck = parseSeed(seed);
  const seedError = seedTouched && !seedCheck.ok ? seedCheck.message : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsedSeed = parseSeed(seed);
    if (!parsedSeed.ok) {
      setSeedTouched(true);
      seedRef.current?.closest("details")?.setAttribute("open", "");
      seedRef.current?.focus();
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
      setSeedTouched(true);
      seedRef.current?.closest("details")?.setAttribute("open", "");
      seedRef.current?.focus();
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
    <form onSubmit={submit} className={`flex flex-col gap-6 ${CARD_CLASS}`} noValidate aria-label="Run options">
      <OptionGroup legend="Show agents’ company names" name="condition" options={CONDITION_OPTIONS} value={condition} onChange={setCondition} disabled={pending} />
      <OptionGroup legend="Show other agents’ coin balances" name="wealth_visibility" options={WEALTH_OPTIONS} value={wealth} onChange={setWealth} disabled={pending} />

      <details className="rounded-md border px-4 py-3">
        <summary className="cursor-pointer py-1 text-sm font-medium">Advanced: seed and paired comparison</summary>
      <div className="flex flex-col gap-2">
        <label htmlFor={seedId} className="text-xs uppercase tracking-widest text-muted-foreground">
          Seed
        </label>
        <input
          ref={seedRef}
          id={seedId}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          onBlur={() => setSeedTouched(true)}
          disabled={pending}
          aria-describedby={`${seedHelpId} ${seedError ? seedErrorId : ""}`.trim()}
          aria-invalid={seedError ? true : undefined}
          className="h-11 w-full max-w-xs rounded-md border bg-background px-3 text-base tabular-nums transition-colors hover:border-muted-foreground/60 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60 aria-[invalid=true]:border-violation"
        />
        {seedError ? (
          <p id={seedErrorId} role="alert" className="text-sm text-violation">
            {seedError}
          </p>
        ) : null}
        <details id={seedHelpId} className="max-w-prose text-xs text-muted-foreground">
          <summary className="inline-flex min-h-8 cursor-pointer items-center underline decoration-border underline-offset-4 hover:text-foreground">About seeds</summary>
          <p className="mt-1 leading-relaxed text-pretty">
            Signed 32-bit integer (default {DEFAULT_SEED}). The seed fixes the world: names, goods and their hidden quality. Model outputs are not deterministic, so the same seed gives a comparable world, not identical behavior.
          </p>
        </details>
      </div>

        <details className="my-4 text-sm leading-relaxed text-muted-foreground">
          <summary className="cursor-pointer">Why a pair? <Badge tone="primary">for comparisons</Badge></summary>
          <p className="mt-2">Compare LABELED and BLIND runs with the same seed and coin visibility to explore a possible label effect. Model outputs still vary; one pair cannot establish bias or distinguish all causes of behavior.</p>
        </details>
        <button
          type="button"
          onClick={startPair}
          disabled={pending}
          className={buttonClass("secondary")}
        >
          {phase.kind === "pending" && phase.what === "pair" ? "Starting pair…" : "Start matched pair"}
        </button><p className="mt-2 text-xs text-muted-foreground">A matched pair starts two paid runs with the same seed and coin visibility, one with company names and one without.</p>
      </details>

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
        <div role="status" className="flex flex-col gap-3 rounded-md border border-primary/60 bg-primary/10 px-4 py-3 text-sm leading-relaxed">
          <p className="font-semibold">{phase.blind ? "Pair started." : "LABELED started; BLIND needs retry."}</p>
          <ul className="flex flex-col gap-2 sm:flex-row">
            {phase.labeled ? <li><Link href={`/run/${encodeURIComponent(phase.labeled)}`} className={buttonClass("secondary", "w-full break-all py-2 sm:w-auto")}>LABELED</Link></li> : null}
            {phase.blind ? <li><Link href={`/run/${encodeURIComponent(phase.blind)}`} className={buttonClass("secondary", "w-full break-all py-2 sm:w-auto")}>BLIND</Link></li> : null}
          </ul>
          {phase.message ? <p role="alert" className="text-violation">{phase.message}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary")}
        >
          {phase.kind === "pending" && phase.what === "single" ? (
            <>
              <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              Starting run…
            </>
          ) : (
            "Start run"
          )}
        </button>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {pending ? "Registering with the run service." : "The viewer will show whether this run uses live models or scripted agents."}
        </p>
      </div>
    </form>
  );
}
