"use client";
import Link from "next/link";
import type { Phase } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { RoundTimeline } from "./round-timeline";
import type { RunStatus } from "./use-run-source";

const STATUS_STYLE: Record<RunStatus, { label: string; dot: string; text: string }> = {
  connecting: { label: "connecting", dot: "bg-muted-foreground animate-pulse", text: "text-muted-foreground" },
  live: { label: "live", dot: "bg-lab-c animate-pulse motion-reduce:animate-none", text: "text-lab-c" },
  ended: { label: "ended", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  offline: { label: "sim unreachable, retrying", dot: "bg-violation", text: "text-violation" },
};

const MODE_LABEL: Record<string, { text: string; warn: boolean }> = {
  "deterministic-stub": { text: "stub agents, not model output", warn: true },
  "live-model-relay": { text: "live models", warn: false },
  "initializing-live": { text: "initializing", warn: false },
  "recorded replay": { text: "recorded replay", warn: false },
};

export function TopBar({
  status,
  round,
  phase,
  mode,
}: {
  status: RunStatus;
  round: number | null;
  phase: Phase | null;
  mode: string | null;
}) {
  const { runId, condition, blind } = useRun();
  const total = useEventStore((s) => s.events.length);
  const st = STATUS_STYLE[status];
  const modeInfo = mode ? (MODE_LABEL[mode] ?? { text: mode, warn: false }) : null;

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
          <span className={`text-xs ${modeInfo.warn ? "text-violation" : "text-muted-foreground"}`}>{modeInfo.text}</span>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:ml-auto">
          <p className="tabular-nums text-muted-foreground">
            <span className="text-foreground">{total}</span> events
          </p>
          <p role="status" className={`flex items-center gap-2 ${st.text}`}>
            <span className={`size-2 rounded-full ${st.dot}`} aria-hidden="true" />
            {st.label}
          </p>
        </div>
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
        Company labels and colors are hidden in this view. The metrics below are still computed from true companies.
      </p>
    </div>
  );
}
