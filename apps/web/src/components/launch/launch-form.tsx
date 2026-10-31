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
      <OptionGroup legend="Wealth visibility" name="wealth_visibility" options={WEALTH_OPTIONS} value={wealth} onChange={setWealth} disabled={pending} />

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
        <p id={seedHelpId} className="max-w-prose text-xs leading-relaxed text-muted-foreground text-pretty">
          Signed 32-bit integer (default {DEFAULT_SEED}). The seed fixes the world: names, goods and their hidden quality. Model outputs are not deterministic, so the same seed gives a comparable world, not identical behavior.
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
        <div role="status" className="flex flex-col gap-3 rounded-md border border-primary/60 bg-primary/10 px-4 py-3 text-sm leading-relaxed">
          <p className="font-semibold">Matched pair started (same seed and wealth visibility).</p>
          <p className="text-muted-foreground">Open each run to watch it live. Compare them on the report once both finish.</p>
          <ul className="flex flex-col gap-2 sm:flex-row">
            {phase.labeled ? <li><Link href={`/run/${encodeURIComponent(phase.labeled)}`} className={buttonClass("secondary", "w-full break-all py-2 sm:w-auto")}>Open LABELED run</Link></li> : null}
            {phase.blind ? <li><Link href={`/run/${encodeURIComponent(phase.blind)}`} className={buttonClass("secondary", "w-full break-all py-2 sm:w-auto")}>Open BLIND run</Link></li> : null}
          </ul>
          {phase.message ? <p role="alert" className="text-violation">{phase.message}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 border-t pt-6">
        <div className="flex flex-col gap-1.5 rounded-md border border-dashed bg-background/60 p-4 text-sm leading-relaxed text-muted-foreground">
          <p className="text-foreground">
            Matched pair <Badge tone="primary">recommended</Badge>
          </p>
          <p className="text-pretty">
            Starts one LABELED and one BLIND run with the same seed and wealth visibility. Everything
            else is identical, so the difference between them is the label effect. A single run
            cannot separate label bias from style recognition.
          </p>
        </div>
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
              `Start ${condition} run only`
            )}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
          {pending ? "Registering with the run service." : "Run mode and agent count are set by the server."}
        </p>
      </div>
    </form>
  );
}
