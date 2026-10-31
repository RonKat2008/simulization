"use client";
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
  ended: { label: "ended", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  offline: { label: "offline, retrying", dot: "bg-violation", text: "text-violation" },
};

const MODE_LABEL: Record<string, { text: string; hint: string; warn: boolean }> = {
  "deterministic-stub": { text: "stub agents", hint: "Scripted stand-ins, not model output", warn: true },
  "live-model-relay": { text: "live models", hint: "Real model calls relayed through the gateway", warn: false },
  "initializing-live": { text: "initializing", hint: "Live run is starting up", warn: false },
  "recorded replay": { text: "recorded replay", hint: "A saved run played back from file", warn: false },
};

const WEALTH_HINT: Record<WealthVisibility, string> = {
  private: "Wealth private: merchants could not see each other's coin balances",
  public: "Wealth public: every merchant could see everyone's coin balances",
};

function Badge({ children, tone, title }: { children: string; tone: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex h-5 items-center rounded-sm border px-1.5 font-mono text-[10.5px] tracking-[0.02em] ${tone}`}>
      {children}
    </span>
  );
}

export function TopBar({
  status,
  round,
  phase,
  mode,
  wealthVisibility,
  isMock,
  reportStatus,
  reportRunId,
  onHelp,
  helpOpen,
}: {
  status: RunStatus;
  round: number | null;
  phase: Phase | null;
  mode: string | null;
  wealthVisibility: "private" | "public" | null;
  isMock: boolean;
  reportStatus: string | null;
  reportRunId: string | null;
  onHelp: () => void;
  helpOpen: boolean;
}) {
  const { runId, condition, blind } = useRun();
  const total = useEventStore((s) => s.events.length);
  const st = STATUS_STYLE[status];
  const modeInfo = mode ? (MODE_LABEL[mode] ?? { text: mode, hint: undefined, warn: false }) : null;

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="rounded-sm text-[15px] font-semibold tracking-[-0.02em] text-foreground transition-colors hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Simulization
        </Link>
        <span className="hidden text-border-strong sm:block" aria-hidden="true">/</span>
        <h1 className="flex min-w-0 items-center gap-2 text-sm font-normal">
          <span className="sr-only">Run</span>
          <span className="max-w-[18ch] truncate font-mono text-[13px] text-foreground sm:max-w-[32ch]" title={runId}>
            {runId}
          </span>
        </h1>
        {condition ? (
          <span
            className={`inline-flex h-5 items-center rounded-sm border px-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] ${
              blind ? "border-accent/40 bg-accent/[0.06] text-accent" : "border-primary/40 bg-primary/[0.06] text-primary"
            }`}
          >
            {condition}
          </span>
        ) : null}
        {modeInfo ? (
          <Badge title={modeInfo.hint} tone={modeInfo.warn ? "border-violation/50 text-violation" : "border-border-strong text-muted-foreground"}>
            {modeInfo.text}
          </Badge>
        ) : null}
        {wealthVisibility ? (
          <Badge title={WEALTH_HINT[wealthVisibility]} tone={wealthVisibility === "public" ? "border-lab-b/50 text-lab-b" : "border-border-strong text-muted-foreground"}>
            {`wealth ${wealthVisibility}`}
          </Badge>
        ) : null}

        {status === "ended" && !isMock ? (
          <Link href={`/report?runId=${encodeURIComponent(reportRunId ?? runId)}`} className="rounded-sm text-xs text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {reportStatus === "done" ? "View persisted report" : reportStatus === "failed" ? "Report failed — details" : reportStatus === "not-requested" ? "View run results" : "View report status"}
          </Link>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:ml-auto">
          <p className="font-mono text-[11px] text-muted-foreground">
            <span className="text-foreground">{total}</span> events
          </p>
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
          <p role="status" className={`flex items-center gap-2 font-mono text-[11px] ${st.text}`}>
            <span className={`size-1.5 rounded-full ${st.dot}`} aria-hidden="true" />
            {st.label}
          </p>
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

export function BlindBanner() {
  return (
    <div role="note" className="border-b border-accent/25 bg-accent/[0.05]">
      <p className="mx-auto max-w-[1600px] px-4 py-1.5 text-xs text-muted-foreground sm:px-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent">Blind</span>
        <span className="mx-2 text-subtle-foreground" aria-hidden="true">/</span>
        Labels hidden. Metrics use true companies.
      </p>
    </div>
  );
}
