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
    <span title={title} className={`rounded-sm border px-2 py-0.5 text-[11px] ${tone}`}>
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
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pb-2 pt-2.5 sm:px-6">
        <Link href="/" className="font-display text-base font-semibold tracking-wide transition-colors hover:text-accent">
          Simulization
        </Link>
        <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
        <h1 className="flex min-w-0 items-center gap-2 text-sm font-normal">
          <span className="text-muted-foreground">Run</span>
          <span className="max-w-[18ch] truncate sm:max-w-[32ch]" title={runId}>
            {runId}
          </span>
        </h1>
        {condition ? (
          <span
            className={`rounded-sm border px-2 py-0.5 font-display text-[11px] tracking-widest ${
              blind ? "border-accent/60 text-accent" : "border-primary/60 text-primary"
            }`}
          >
            {condition}
          </span>
        ) : null}
        {modeInfo ? (
          <Badge title={modeInfo.hint} tone={modeInfo.warn ? "border-violation/60 text-violation" : "border-border text-muted-foreground"}>
            {modeInfo.text}
          </Badge>
        ) : null}
        {wealthVisibility ? (
          <Badge title={WEALTH_HINT[wealthVisibility]} tone={wealthVisibility === "public" ? "border-lab-b/60 text-lab-b" : "border-border text-muted-foreground"}>
            {`wealth ${wealthVisibility}`}
          </Badge>
        ) : null}

        {status === "ended" && !isMock ? (
          <Link href={`/report?runId=${encodeURIComponent(reportRunId ?? runId)}`} className="text-xs text-primary underline underline-offset-4">
            {reportStatus === "done" ? "View persisted report" : reportStatus === "failed" ? "Report failed — details" : reportStatus === "not-requested" ? "View run results" : "View report status"}
          </Link>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:ml-auto">
          <p className="tabular-nums text-muted-foreground">
            <span className="text-foreground">{total}</span> events
          </p>
          <button
            type="button"
            onClick={onHelp}
            aria-pressed={helpOpen}
            aria-keyshortcuts="?"
            title="What you're looking at, and keyboard shortcuts"
            className={`flex items-center gap-1.5 rounded-sm border px-2 py-0.5 transition-colors hover:border-primary/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary active:bg-border ${
              helpOpen ? "border-primary/60 text-foreground" : "text-muted-foreground"
            }`}
          >
            <kbd className="font-display text-[11px] text-foreground">?</kbd>
            Guide
          </button>
          <p role="status" className={`flex items-center gap-2 ${st.text}`}>
            <span className={`size-2 rounded-full ${st.dot}`} aria-hidden="true" />
            {st.label}
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-[1600px] px-4 py-3 text-sm leading-relaxed sm:px-6">
        <strong>Round {round ?? '…'} of 6 · {phase ?? 'Connecting'}</strong>
        <p className="mt-1 text-muted-foreground">{phase === 'negotiate' ? 'Merchants message each other, form coalitions and propose pacts.' : phase === 'trade' ? 'Merchants offer goods, then buyers accept or decline. Claimed quality may differ from the truth.' : phase === 'act' ? 'Each merchant chooses to work, contribute, steal or pass.' : phase === 'reveal' ? 'The referee resolves theft detection, fines and coalition rewards.' : 'Waiting for the simulation to connect.'}</p>
        <p className="mt-1 text-xs text-muted-foreground">Goal: finish with coins plus the true value of held goods. A coalition is a shared group; an accepted pact is a two-agent promise that can be broken.</p>
      </div>
      <RoundTimeline round={round} phase={phase} ended={status === "ended"} />
    </header>
  );
}

export function BlindBanner() {
  return (
    <div role="note" className="border-b border-accent/40 bg-accent/10">
      <p className="mx-auto max-w-[1600px] px-4 py-1.5 text-xs text-accent sm:px-6">
        <span className="font-display tracking-widest">BLIND</span>
        <span className="mx-2 opacity-60" aria-hidden="true">/</span>
        Labels hidden. Metrics use true companies.
      </p>
    </div>
  );
}
