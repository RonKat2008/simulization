"use client";
// The whole night on one track: 6 rounds x 4 phases, where playback is, and the moments worth seeing.
// Hover or focus a marker for its sentence; click it to replay from that round.
import { useState } from "react";
import { PHASES } from "@simulization/shared";
import { PHASE_LABEL } from "@/game/narrate";
import { KIND_LABEL, type Moment, type MomentKind } from "./moments";

/** Shape + color per kind, so the track reads without color alone. Red stays reserved for violations. */
const MARK: Record<MomentKind, string> = {
  lie: "size-2.5 rotate-45 bg-violation",
  caught: "size-2.5 rounded-[2px] bg-violation ring-2 ring-violation/40",
  theft: "size-2.5 rounded-[2px] bg-violation",
  pact_break: "size-2.5 rounded-full border-2 border-violation bg-surface",
  pact: "size-2 rounded-full bg-primary",
  coalition: "size-2.5 rounded-[2px] bg-muted-foreground",
  lantern: "size-3 rounded-full bg-foreground ring-2 ring-primary/50",
};

// Key order: violations first, then cooperative moments.
const LEGEND_ORDER: MomentKind[] = ["lie", "caught", "theft", "pact_break", "pact", "coalition", "lantern"];
const LANE_PX = 9;
const MAX_LANES = 3;
const NEAR = 0.012; // markers closer than this (fraction of the track) stack instead of overlapping

/** Vertical lane per marker so close moments stack upward. */
function lanes(moments: Moment[]): number[] {
  const out: number[] = [];
  moments.forEach((m, i) => {
    let lane = 0;
    for (let j = i - 1; j >= 0 && m.pos - moments[j]!.pos < NEAR; j--) lane = Math.max(lane, out[j]! + 1);
    out.push(lane % MAX_LANES);
  });
  return out;
}

interface Props {
  moments: Moment[];
  rounds: number;
  /** Phase cell playback is in (0..rounds*4-1); -1 before it starts. */
  cell: number;
  ended: boolean;
  onSeek: (round: number) => void;
}

export function StoryTimeline({ moments, rounds, cell, ended, onSeek }: Props) {
  const [hover, setHover] = useState<Moment | null>(null);
  const [picked, setPicked] = useState<Moment | null>(null);
  const candidate = hover ?? picked;
  const shown = candidate && moments.some(m => m.id === candidate.id) ? candidate : null;
  const lane = lanes(moments);
  const cells = rounds * PHASES.length;
  const position = ended
    ? "Replay complete"
    : cell >= 0
      ? `Recorded through: Round ${Math.floor(cell / PHASES.length) + 1} · ${PHASE_LABEL[PHASES[cell % PHASES.length]!]}`
      : null;

  return (
    <section aria-label="Agent-to-Agent Interactions" className="min-w-0">
      <h3 className="pt-2 text-sm font-medium">Agent-to-Agent Interactions</h3>
      <div className="relative pt-8">
        {/* markers */}
        <ol className="absolute inset-x-0 top-0 h-8" aria-label="Key moments">
          {moments.map((m, i) => (
            <li key={m.id} className="absolute bottom-1" style={{ left: `${m.pos * 100}%`, transform: `translate(-50%, -${lane[i]! * LANE_PX}px)` }}>
              <button
                type="button"
                aria-label={`Round ${m.round}: ${m.sentence}. Replay from round ${m.round}`}
                onMouseEnter={() => setHover(m)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(m)}
                onBlur={() => setHover(null)}
                onClick={() => {
                  setPicked(m);
                  onSeek(m.round);
                }}
                className="group -m-1.5 flex min-h-6 min-w-6 items-center justify-center rounded-sm p-1.5 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span aria-hidden className={`block transition-transform group-hover:scale-150 motion-reduce:transition-none ${MARK[m.kind]} ${shown?.id === m.id ? "scale-150" : ""}`} />
              </button>
            </li>
          ))}
        </ol>
        {/* track */}
        <div className="flex h-3 gap-1" aria-hidden>
          {Array.from({ length: rounds }, (_, r) => (
            <div key={r} className="flex flex-1 gap-px overflow-hidden rounded-sm">
              {PHASES.map((p, pi) => {
                const idx = r * PHASES.length + pi;
                const done = ended || idx < cell;
                const now = !ended && idx === cell;
                return (
                  <span
                    key={p}
                    title={`Round ${r + 1} · ${PHASE_LABEL[p]}`}
                    className={`flex-1 ${now ? "animate-pulse bg-primary motion-reduce:animate-none" : done ? "bg-primary/45" : "bg-border"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {/* round labels: buttons so the track itself is a scrubber */}
        <div className="mt-1 flex gap-1">
          {Array.from({ length: rounds }, (_, r) => {
            const current = !ended && Math.floor(cell / PHASES.length) === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onSeek(r + 1)}
                aria-current={current ? "step" : undefined}
                aria-label={`Replay from round ${r + 1}`}
                className={`min-h-8 flex-1 rounded-sm py-0.5 text-center text-[11px] tabular-nums transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary ${current ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                <span className="sm:hidden">R{r + 1}</span>
                <span className="hidden sm:inline">Round {r + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* one line: the hovered/picked moment, or the legend */}
      <div className="mt-1.5 min-h-5 text-xs" aria-live="polite">
        {shown ? (
          <p className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 tabular-nums text-muted-foreground">R{shown.round} · {PHASE_LABEL[shown.phase]}</span>
            <span className={`min-w-0 truncate ${shown.kind === "lie" || shown.kind === "caught" || shown.kind === "theft" || shown.kind === "pact_break" ? "text-violation" : "text-foreground"}`}>
              {shown.sentence}
            </span>
          </p>
        ) : (
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            {position ? <li className="font-medium text-foreground">{position}</li> : null}
            {moments.length ? <li>{moments.length} recorded highlights</li> : null}
            {LEGEND_ORDER.map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span aria-hidden className={`block ${MARK[k]}`} />
                {KIND_LABEL[k]}
              </li>
            ))}
            {moments.length ? <li className="hidden text-subtle-foreground sm:block">· tap a mark to replay that round</li> : null}
            {cells && !moments.length ? <li>No flagged claims, thefts or pacts at this playback position.</li> : null}
          </ul>
        )}
      </div>
    </section>
  );
}
