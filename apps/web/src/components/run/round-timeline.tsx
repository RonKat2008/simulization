"use client";
import { useMemo } from "react";
import { PHASES, ROUNDS, type Phase } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { computeRoundStats, PHASE_SHORT } from "./run-helpers";

type PhaseState = "done" | "current" | "todo";

function phaseState(r: number, p: number, round: number | null, phaseIdx: number, ended: boolean): PhaseState {
  if (ended) return "done";
  if (round === null) return "todo";
  if (r < round) return "done";
  if (r > round) return "todo";
  if (p < phaseIdx) return "done";
  return p === phaseIdx ? "current" : "todo";
}

const PIP: Record<PhaseState, string> = {
  done: "bg-muted-foreground/60",
  current: "bg-primary",
  todo: "bg-border",
};

/** Round x phase progress. Each round is a toggle that restricts the feed to that round. */
export function RoundTimeline({ round, phase, ended }: { round: number | null; phase: Phase | null; ended: boolean }) {
  const events = useEventStore((s) => s.events);
  const roundFilter = useEventStore((s) => s.roundFilter);
  const setRoundFilter = useEventStore((s) => s.setRoundFilter);
  const stats = useMemo(() => computeRoundStats(events), [events]);
  const phaseIdx = phase ? PHASES.indexOf(phase) : -1;
  // Current position comes from the log when the status poll has not caught up.
  const cur = ended ? ROUNDS : round;

  return (
    <nav aria-label="Round timeline" className="mx-auto max-w-[1600px] px-4 pb-2.5 sm:px-6">
      <ol className="grid grid-cols-6 gap-1 sm:gap-1.5">
        {Array.from({ length: ROUNDS }, (_, i) => i + 1).map((r) => {
          const st = stats.get(r);
          const on = roundFilter === r;
          const isCurrent = !ended && cur === r;
          return (
            <li key={r} className="min-w-0">
              <button
                type="button"
                aria-pressed={on}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => setRoundFilter(on ? null : r)}
                title={
                  st
                    ? `Round ${r}: ${st.events} events, ${st.flagged} flagged. Click to ${on ? "show all rounds" : "filter the feed to this round"}.`
                    : `Round ${r}: no events yet`
                }
                className={`flex w-full min-w-0 flex-col gap-1 rounded-sm border px-1.5 py-1 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                  on ? "border-primary bg-primary/15" : isCurrent ? "border-primary/60" : "border-border hover:border-primary/50"
                }`}
              >
                <span className="flex items-baseline justify-between gap-1 text-[11px] tabular-nums">
                  <span className={on || isCurrent ? "text-foreground" : "text-muted-foreground"}>R{r}</span>
                  <span className="hidden truncate text-[10px] text-muted-foreground sm:inline">
                    {st ? st.events : 0}
                    {st && st.flagged > 0 ? <span className="text-violation">{` · ${st.flagged}`}</span> : null}
                  </span>
                </span>
                <span className="flex gap-0.5" aria-hidden="true">
                  {PHASES.map((p, pi) => (
                    <span key={p} className={`h-1 flex-1 ${PIP[phaseState(r, pi, cur, phaseIdx, ended)]}`} />
                  ))}
                </span>
                <span className="sr-only">
                  {isCurrent ? `current phase ${phase ?? "unknown"}` : st ? `${st.events} events, ${st.flagged} flagged` : "no events"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-muted-foreground">
        <span>
          {PHASES.map((p) => PHASE_SHORT[p]).join(" / ")} per round
          {!ended && phase ? <span className="text-foreground">{` · now R${round ?? "?"} ${phase}`}</span> : null}
        </span>
        <span>
          Counts: events <span className="text-violation">· flagged</span>
        </span>
      </p>
    </nav>
  );
}
