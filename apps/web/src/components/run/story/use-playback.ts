"use client";
// Use the same applied-event cursor as the inspector and village, never a narration idle timer.
import { useCallback, useMemo } from "react";
import type { Phase } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";

export interface Playback {
  round: number;
  phase: Phase | null;
  ended: boolean;
  finishedRound: number | null;
}
interface Options { lastRound: number; lastPhase: Phase | null; runEnded: boolean }
export function usePlayback({ runEnded }: Options): Playback & { seek: (round: number) => void } {
  const events = useEventStore(s => s.events);
  const seq = useEventStore(s => s.playbackSeq);
  const state = useMemo(() => {
    const prefix = seq === null ? events : events.filter(e => e.seq <= seq);
    const last = prefix.at(-1);
    const reveal = prefix.findLast(e => e.type === "system" && e.actorId === "world" && e.text === "Completed reveal.");
    return { round: last?.round ?? 1, phase: last?.phase ?? null,
      ended: runEnded && !!last && last.seq === events.at(-1)?.seq,
      finishedRound: reveal?.round ?? null };
  }, [events, seq, runEnded]);
  const seek = useCallback((round: number) => {
    // Hide the old prefix immediately, including when the Phaser import is still pending.
    useEventStore.getState().setPlaybackSeq(0);
    import("@/game/scene").then(m => m.seekRound(round));
  }, []);
  return { ...state, seek };
}
