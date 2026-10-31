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
} from "./schemas";
import { startRun } from "./start-run";

const CONDITION_OPTIONS: readonly Option<Condition>[] = [
  { value: "LABELED", tone: "primary", title: "LABELED", detail: "Agents see each other's company." },
  { value: "BLIND", tone: "accent", title: "BLIND", detail: "Names only. The control." },
];

const WEALTH_OPTIONS: readonly Option<WealthVisibility>[] = [
  { value: "private", tone: "primary", title: "PRIVATE", detail: "Coins hidden." },
  { value: "public", tone: "accent", title: "PUBLIC", detail: "Everyone sees coins." },
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
  const seedCheck = parseSeed(seed);
  const seedError = seedTouched && !seedCheck.ok ? seedCheck.message : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsedSeed = parseSeed(seed);
    if (!parsedSeed.ok) {
      setSeedTouched(true);
      seedRef.current?.focus();
      return;
    }
    setPhase({ kind: "pending", what: "single" });
    const result = await startRun({ condition, seed: parsedSeed.value, wealth_visibility: wealth });
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
      seedRef.current?.focus();
      return;
    }
    setPhase({ kind: "pending", what: "pair" });
    const base = { seed: parsedSeed.value, wealth_visibility: wealth };
    const labeled = await startRun({ ...base, condition: "LABELED" });
    if (!labeled.ok) {
      setPhase({ kind: "error", message: `LABELED run failed, BLIND was not started. ${labeled.message}` });
      return;
    }
    onStarted?.();
    const blind = await startRun({ ...base, condition: "BLIND" });
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
      <OptionGroup legend="Condition" name="condition" options={CONDITION_OPTIONS} value={condition} onChange={setCondition} disabled={pending} />
      <OptionGroup legend="Wealth" name="wealth_visibility" options={WEALTH_OPTIONS} value={wealth} onChange={setWealth} disabled={pending} />

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
          <p className="font-semibold">Pair started.</p>
          <ul className="flex flex-col gap-2 sm:flex-row">
            {phase.labeled ? <li><Link href={`/run/${encodeURIComponent(phase.labeled)}`} className={buttonClass("secondary", "w-full break-all py-2 sm:w-auto")}>LABELED</Link></li> : null}
            {phase.blind ? <li><Link href={`/run/${encodeURIComponent(phase.blind)}`} className={buttonClass("secondary", "w-full break-all py-2 sm:w-auto")}>BLIND</Link></li> : null}
          </ul>
          {phase.message ? <p role="alert" className="text-violation">{phase.message}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 border-t pt-6">
        <details className="text-sm text-muted-foreground">
          <summary className="inline-flex min-h-10 cursor-pointer items-center gap-2 hover:text-foreground">
            Why a pair? <Badge tone="primary">recommended</Badge>
          </summary>
          <p className="text-pretty leading-relaxed">
            One LABELED and one BLIND run, same seed and wealth visibility. The difference between them is the label effect. A single run cannot separate label bias from style recognition.
          </p>
        </details>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={startPair}
            disabled={pending}
            className={`${buttonClass("primary")} active:scale-[0.97] disabled:cursor-wait`}
          >
            {phase.kind === "pending" && phase.what === "pair" ? (
              <>
                <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                Starting pair…
              </>
            ) : (
              "Start matched pair"
            )}
          </button>
          <button
            type="submit"
            disabled={pending}
            className={`${buttonClass("secondary")} active:scale-[0.97] disabled:cursor-wait`}
          >
            {phase.kind === "pending" && phase.what === "single" ? (
              <>
                <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
                Starting run…
              </>
            ) : (
              `${condition} only`
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {pending ? "Starting…" : ""}
        </p>
      </div>
    </form>
  );
}
