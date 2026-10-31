"use client";
// Everything that sits under the village: first-visit intro, the night's timeline, the recap of the
// round that just ended, and an end-of-night pointer to the results below.
import { useCallback, useMemo, useState } from "react";
import { ROUNDS, type Event } from "@simulization/shared";
import { useRun } from "../run-context";
import { CoachMark } from "./coach-mark";
import { cellOf, keyMoments, roundRecap } from "./moments";
import { RoundRecap } from "./round-recap";
import { StoryTimeline } from "./story-timeline";
import { usePlayback } from "./use-playback";

interface Props {
  events: Event[];
  runEnded: boolean;
}

export function StoryPanel({ events, runEnded }: Props) {
  const { label, blind, agents } = useRun();
  const lastEv = events.at(-1);
  const rounds = Math.max(ROUNDS, lastEv?.round ?? 0);
  const pb = usePlayback({ lastRound: lastEv?.round ?? 0, lastPhase: lastEv?.phase ?? null, runEnded });
  const moments = useMemo(() => keyMoments(events, rounds, label), [events, rounds, label]);

  // The recap opens each time a new round finishes; the user can collapse or reopen it.
  const recapRound = pb.finishedRound;
  const [openFor, setOpenFor] = useState<number | null>(null);
  const [closedFor, setClosedFor] = useState<number | null>(null);
  // Round recaps stay collapsed until explicitly opened.
  const recapOpen = recapRound !== null && openFor === recapRound;
  const setRecapOpen = useCallback(
    (open: boolean) => {
      if (recapRound === null) return;
      if (open) {
        setOpenFor(recapRound);
        setClosedFor(null);
      } else {
        setOpenFor(null);
        setClosedFor(recapRound);
      }
    },
    [recapRound],
  );
  const recap = useMemo(() => (recapRound === null ? null : roundRecap(events, moments, recapRound)), [events, moments, recapRound]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-1">Replay help</summary><div className="mt-2"><CoachMark blind={blind} merchants={agents.length}/><p className="py-2">Choose a round to replay it. Timeline marks show recorded events reached so far; select a mark for details. Select an agent to inspect its activity and coins.</p></div></details>
      <div className="rounded-lg border bg-surface px-3 pb-2 pt-1 sm:px-4">
        <StoryTimeline moments={moments} rounds={rounds} cell={cellOf(pb.round, pb.phase)} ended={pb.ended} onSeek={pb.seek} />
      </div>
      {recap ? <RoundRecap recap={recap} open={recapOpen} onOpenChange={setRecapOpen} final={pb.ended} /> : null}
      {pb.ended ? (
        <section aria-label="End of the night" className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-primary/40 bg-surface-raised/40 px-3 py-2.5 sm:px-4">
          <p className="font-display text-base tracking-wide">Replay complete.</p>
          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => pb.seek(1)}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Watch again
            </button>
            {runEnded ? (
              <a
                href="#replay-summary"
                className="rounded-sm bg-primary px-2.5 py-1 font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                View run results ↓
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
