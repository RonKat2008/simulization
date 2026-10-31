"use client";
import Link from "next/link";
import { PHASES, ROUNDS } from "@simulization/shared";
import type { Phase } from "@simulization/shared";
import { useRun } from "./run-context";
import type { RunStatus } from "./use-run-source";

const STATUS_STYLE: Record<RunStatus, { label: string; dot: string; text: string }> = {
  connecting: { label: "connecting", dot: "bg-lab-b animate-pulse", text: "text-lab-b" },
  live: { label: "live", dot: "bg-lab-c animate-pulse", text: "text-lab-c" },
  ended: { label: "ended", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  offline: { label: "sim offline", dot: "bg-violation", text: "text-violation" },
};

export function TopBar({
  status,
  round,
  phase,
  isMock,
}: {
  status: RunStatus;
  round: number | null;
  phase: Phase | null;
  isMock: boolean;
}) {
  const { runId, condition, blind } = useRun();
  const st = STATUS_STYLE[status];
  const phaseIdx = phase ? PHASES.indexOf(phase) : -1;

  return (
    <header className="border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
        <Link href="/" className="font-display text-lg font-semibold tracking-wide transition-colors hover:text-accent">
          Simulization
        </Link>
        <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <span className="text-muted-foreground">run</span>
          <span className="max-w-[16ch] truncate sm:max-w-[28ch]" title={runId}>
            {runId}
          </span>
          {isMock ? <span className="rounded-sm border px-1.5 py-0.5 text-[10px] text-muted-foreground">replay</span> : null}
        </p>
        {condition ? (
          <span
            className={`rounded-sm border px-2 py-0.5 font-display text-xs tracking-widest ${
              blind ? "border-accent/60 text-accent" : "border-primary/60 text-primary"
            }`}
          >
            {condition}
          </span>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:ml-auto">
          <p className="flex items-center gap-2">
            <span className="text-muted-foreground">round</span>
            <span className="tabular-nums">{round ?? "–"}/{ROUNDS}</span>
          </p>
          <ol className="flex items-center gap-1" aria-label={`phase: ${phase ?? "unknown"}`}>
            {PHASES.map((p, i) => (
              <li
                key={p}
                title={p}
                className={`rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                  i === phaseIdx ? "bg-primary text-primary-foreground" : "bg-surface-raised text-muted-foreground"
                }`}
              >
                {p}
              </li>
            ))}
          </ol>
          <p role="status" className={`flex items-center gap-2 ${st.text}`}>
            <span className={`size-2 ${st.dot}`} aria-hidden="true" />
            {st.label}
          </p>
        </div>
      </div>
    </header>
  );
}

export function BlindBanner() {
  return (
    <div role="note" className="border-b border-accent/40 bg-accent/10">
      <p className="mx-auto max-w-[1600px] px-4 py-1.5 text-center text-xs text-accent sm:px-6">
        <span className="font-display tracking-widest">BLIND RUN</span>
        <span className="mx-2 opacity-60" aria-hidden="true">/</span>
        Agents see names only. Company is hidden in this view too.
      </p>
    </div>
  );
}
