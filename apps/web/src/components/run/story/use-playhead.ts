"use client";
// Which event the village is showing right now, so side panels can follow playback instead of the log's end.
// The scene's "now happening" channel carries round, phase and sentence but no event id, so the sentence is
// matched against describe() for the events of that round + phase (same names: the canvas gets ctx.label).
import { useEffect, useMemo, useRef, useState } from "react";
import type { Event } from "@simulization/shared";
import { describe } from "@/game/narrate";

/** Lines the scene emits on (re)start; they carry the position from before the restart. */
const STALE = /^(Skipping ahead|Waiting for)/;

export const PLAYHEAD_END = Number.POSITIVE_INFINITY;

interface Options {
  events: Event[];
  label: (id: string) => string;
  /** Village playback finished: everything is "played". */
  ended: boolean;
  /** Off-screen village (another tab): nothing follows playback, show the whole log. */
  follow: boolean;
}

/** Highest event seq the village has shown. 0 before playback starts, Infinity when ended or not following. */
export function usePlayhead({ events, label, ended, follow }: Options): number {
  const [seq, setSeq] = useState(0);
  const latest = useRef({ events, label });
  useEffect(() => {
    latest.current = { events, label };
  }, [events, label]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let dead = false;
    import("@/game/scene").then(({ onNarrate }) => {
      if (dead) return;
      unsub = onNarrate((n) => {
        if (n.round < 1 || !n.phase || STALE.test(n.sentence)) return;
        const { events: evs, label: nameOf } = latest.current;
        const inPhase = evs.filter((e) => e.round === n.round && e.phase === n.phase);
        if (!inPhase.length) return;
        const hits = inPhase.filter((e) => {
          const b = describe(e, nameOf);
          return !!b && (b.sentence === n.sentence || b.lie?.sentence === n.sentence);
        });
        setSeq((cur) => {
          if (!hits.length) return inPhase[0]!.seq - 1; // phase title card: nothing of this phase shown yet
          // Repeated sentences (same message twice): take the first one past what is already shown.
          return (hits.find((e) => e.seq > cur) ?? hits.at(-1)!).seq;
        });
      });
    });
    return () => {
      dead = true;
      unsub?.();
    };
  }, []);

  return useMemo(() => (ended || !follow ? PLAYHEAD_END : seq), [ended, follow, seq]);
}
