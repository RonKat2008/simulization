"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import type { Phase } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { RoundTimeline } from "./round-timeline";
import type { RunStatus } from "./use-run-source";
import type { WealthVisibility } from "./use-run-info";

const STATUS_STYLE: Record<RunStatus, { label: string; dot: string; text: string }> = {
  connecting: { label: "connecting", dot: "bg-muted-foreground animate-pulse motion-reduce:animate-none", text: "text-muted-foreground" },
  live: { label: "live", dot: "bg-lab-c animate-pulse motion-reduce:animate-none", text: "text-lab-c" },
  draining: { label: "receiving final events", dot: "bg-muted-foreground animate-pulse motion-reduce:animate-none", text: "text-muted-foreground" },
  failed: { label: "failed / stopped", dot: "bg-violation", text: "text-violation" },
  ended: { label: "finished", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  offline: { label: "offline, retrying", dot: "bg-violation", text: "text-violation" },
};

const MODE_LABEL: Record<string, { text: string; hint: string; warn: boolean }> = {
  "deterministic-stub": { text: "stub agents", hint: "Scripted stand-ins, not model output", warn: true },
  "live-model-relay": { text: "live models", hint: "Real AI models from three companies", warn: false },
  "initializing-live": { text: "initializing", hint: "Live run is starting up", warn: false },
  "recorded replay": { text: "recorded replay", hint: "A saved run played back from file", warn: false },
};

const WEALTH_HINT: Record<WealthVisibility, string> = {
  private: "Hidden: merchants could not see each other's coins",
  public: "Public: every merchant could see everyone's coins",
};

const CONDITION_TEXT = {
  LABELED: { name: "Labeled", meaning: "merchants can see each other's company" },
  BLIND: { name: "Blind", meaning: "companies hidden" },
} as const;

function DetailRow({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

/** Technical run facts, out of the way until asked for. */
function RunDetails({ status, mode, wealthVisibility, isMock, reportStatus, reportRunId }: Pick<TopBarProps, "status" | "mode" | "wealthVisibility" | "isMock" | "reportStatus" | "reportRunId">) {
  const { runId, blind } = useRun();
  const total = useEventStore((s) => s.events.length);
  const modeKey = mode?.replace(/^recorded /, "") ?? null;
  const modeInfo = modeKey ? MODE_LABEL[modeKey] : null;
  const reportLabel = reportStatus === "done" ? "Open the saved report" : reportStatus === "failed" ? "Report failed — details" : reportStatus === "not-requested" ? "Open run results" : "Report status";
  return (
    <details className="group relative">
      <summary className="flex h-7 cursor-pointer list-none items-center gap-1.5 rounded-md border border-border px-2 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary group-open:border-border-strong group-open:bg-surface-raised group-open:text-foreground [&::-webkit-details-marker]:hidden">
        Run details
        <span aria-hidden="true" className="text-[10px] transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="absolute right-0 z-40 mt-1.5 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border-strong bg-surface p-3 text-xs shadow-pop">
        <dl className="divide-y divide-border/60">
          <DetailRow k="Run id"><span className="font-mono text-[11px]">{runId}</span></DetailRow>
          <DetailRow k="Status">{STATUS_STYLE[status].label}</DetailRow>
          {mode ? (
            <DetailRow k="Agents">
              <span className={modeInfo?.warn ? "text-violation" : undefined}>{modeInfo?.hint ?? mode}</span>
              {mode.startsWith("recorded") ? <span className="text-muted-foreground"> · saved recording</span> : null}
              <span className="block font-mono text-[10.5px] text-subtle-foreground">{mode}</span>
            </DetailRow>
          ) : null}
          {wealthVisibility ? <DetailRow k="Coin balances">{WEALTH_HINT[wealthVisibility]}</DetailRow> : null}
          <DetailRow k="Events recorded"><span className="font-mono">{total}</span></DetailRow>
          {blind ? <DetailRow k="Scoring">Merchants could not see companies; results still use each one&apos;s true company.</DetailRow> : null}
        </dl>
        {status === "ended" && !isMock ? (
          <Link href={`/report?runId=${encodeURIComponent(reportRunId ?? runId)}`} className="mt-2 inline-block rounded-sm text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-primary">
            {reportLabel} →
          </Link>
        ) : null}
      </div>
    </details>
  );
}

type TopBarProps = {
  status: RunStatus;
  round: number | null;
  phase: Phase | null;
  mode: string | null;
  wealthVisibility: "private" | "public" | null;
  labelMode?: "true" | "swapped" | null;
  monitoring?: "standard" | "unmonitored" | null;
  isMock: boolean;
  reportStatus: string | null;
  reportRunId: string | null;
  seed: number | null;
  onHelp: () => void;
  helpOpen: boolean;
};

export function TopBar({ status, round, phase, mode, wealthVisibility, labelMode = null, monitoring = null, isMock, reportStatus, reportRunId, seed, onHelp, helpOpen }: TopBarProps) {
  const { condition, blind } = useRun();
  const st = STATUS_STYLE[status];
  const cond = condition ? CONDITION_TEXT[condition] : null;
  const kind = status === "ended" ? "Replay" : "Live run";
  const title = seed !== null ? `${kind} · Seed ${seed}` : kind;

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="rounded-sm text-[15px] font-semibold tracking-[-0.02em] text-foreground transition-colors hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Simulization
        </Link>
        <span className="text-border-strong" aria-hidden="true">/</span>
        <h1 className="text-[15px] font-medium tracking-[-0.01em] text-foreground">{title}</h1>
        {cond ? (
          <span
            title={blind ? "Merchants saw only names, never companies. Colors are hidden here too." : "Each merchant could see which company made every other merchant."}
            className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
              blind ? "border-accent/40 bg-accent/[0.06]" : "border-primary/40 bg-primary/[0.06]"
            }`}
          >
            <span className={`font-mono text-[10.5px] uppercase tracking-[0.08em] ${blind ? "text-accent" : "text-primary"}`}>{cond.name}</span>
            <span className="text-muted-foreground">{cond.meaning}</span>
          </span>
        ) : null}
        {labelMode === "swapped" ? (
          <span title="Merchants saw company labels, but every other merchant's label was deliberately wrong (rotated)." className="inline-flex min-h-6 items-center gap-1.5 rounded-full border border-border-strong px-2.5 py-0.5 text-xs">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground">Swapped</span>
            <span className="text-muted-foreground">agents saw swapped labels</span>
          </span>
        ) : null}
        {monitoring === "unmonitored" ? (
          <span title="Merchants were told no one would review the game logs." className="inline-flex min-h-6 items-center gap-1.5 rounded-full border border-border-strong px-2.5 py-0.5 text-xs">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground">Unmonitored</span>
            <span className="text-muted-foreground">told nobody is watching</span>
          </span>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:ml-auto">
          {status !== "ended" ? (
            <p role="status" className={`mr-1 flex items-center gap-2 font-mono text-[11px] ${st.text}`}>
              <span className={`size-1.5 rounded-full ${st.dot}`} aria-hidden="true" />
              {st.label}
            </p>
          ) : null}
          <RunDetails status={status} mode={mode} wealthVisibility={wealthVisibility} isMock={isMock} reportStatus={reportStatus} reportRunId={reportRunId} />
          <button
            type="button"
            onClick={onHelp}
            aria-pressed={helpOpen}
            aria-keyshortcuts="?"
            title="What you're looking at, and keyboard shortcuts"
            className={`flex h-7 items-center gap-1.5 rounded-md border px-2 transition-colors duration-150 hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary active:bg-border ${
              helpOpen ? "border-border-strong bg-surface-raised text-foreground" : "border-border text-muted-foreground"
            }`}
          >
            <kbd className="inline-flex size-4 items-center justify-center rounded-[3px] border border-border-strong font-mono text-[10px] text-foreground">?</kbd>
            Guide
          </button>
        </div>
      </div>
      {/* A finished run replays in the village; its live-position strip would show the end state and
          contradict playback, so the timeline under the village takes over there. */}
      {status !== "ended" ? (
        <>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-1 px-4 pb-3 pt-1 text-sm leading-relaxed sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-4 sm:px-6">
        <strong className="font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-foreground">R{round ?? '…'}<span className="text-subtle-foreground">/6</span> · {phase ?? 'Connecting'}</strong>
        <p className="text-muted-foreground">{phase === 'negotiate' ? 'Merchants message each other, form coalitions and propose pacts.' : phase === 'trade' ? 'Merchants offer goods, then buyers accept or decline. Claimed quality may differ from the truth.' : phase === 'act' ? 'Each merchant chooses to work, contribute, steal or pass.' : phase === 'reveal' ? 'The referee resolves theft detection, fines and coalition rewards.' : 'Waiting for the simulation to connect.'}</p>
        <details className="group text-xs text-muted-foreground sm:ml-auto">
          <summary className="cursor-pointer list-none rounded-sm text-subtle-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary group-open:text-foreground [&::-webkit-details-marker]:hidden">Goal of the game</summary>
          <p className="mt-1 max-w-xl">Goal: finish with coins plus the true value of held goods. A coalition is a shared group; an accepted pact is a two-agent promise that can be broken.</p>
        </details>
      </div>
      <RoundTimeline round={round} phase={phase} ended={false} />
        </>
      ) : null}
    </header>
  );
}
