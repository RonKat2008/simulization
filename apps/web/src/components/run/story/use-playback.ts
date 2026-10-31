"use client";
// Where the village playback is right now, read from the scene's "now happening" channel.
// The scene module is imported lazily (it pulls in Phaser), exactly like VillageCanvas does.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Phase } from "@simulization/shared";

/** With no new line for this long while in the night's last phase, playback has finished. */
const END_IDLE_MS = 4000;
/** Lines the scene emits on (re)start; they carry the position from before the restart. */
const STALE = /^(Skipping ahead|Waiting for)/;

export interface Playback {
  round: number;
  phase: Phase | null;
  /** The village has played the last event of a finished run. */
  ended: boolean;
  /** Round whose reveal just finished (playback moved on by exactly one round). */
  finishedRound: number | null;
}

interface Options {
  /** Last round + phase present in the log; playback reaching it (then going idle) means the end. */
  lastRound: number;
  lastPhase: Phase | null;
  /** Only finished runs can "end"; a live run idles while it waits for events. */
  runEnded: boolean;
}

export function usePlayback({ lastRound, lastPhase, runEnded }: Options): Playback & { seek: (round: number) => void } {
  const [state, setState] = useState<Playback>({ round: 0, phase: null, ended: false, finishedRound: null });
  const endTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevRound = useRef(0);
  const seekTarget = useRef(0); // after a seek, stale lines from before the jump are ignored
  const last = useRef({ lastRound, lastPhase, runEnded });
  useEffect(() => {
    last.current = { lastRound, lastPhase, runEnded };
  }, [lastRound, lastPhase, runEnded]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let dead = false;
    import("@/game/scene").then(({ onNarrate }) => {
      if (dead) return;
      unsub = onNarrate((n) => {
        clearTimeout(endTimer.current);
        if (n.round < 1 || !n.phase || STALE.test(n.sentence)) return; // restart lines repeat the old position
        if (n.round < seekTarget.current) return; // "skipping ahead" repeats the pre-seek position
        seekTarget.current = 0;
        const prev = prevRound.current;
        prevRound.current = n.round;
        setState((s) => ({
          round: n.round,
          phase: n.phase,
          ended: false,
          finishedRound: prev >= 1 && n.round === prev + 1 ? prev : n.round === prev ? s.finishedRound : null,
        }));
        const L = last.current;
        if (L.runEnded && n.round === L.lastRound && n.phase === L.lastPhase) {
          endTimer.current = setTimeout(
            () => setState((s) => ({ ...s, ended: true, finishedRound: L.lastRound })),
            END_IDLE_MS,
          );
        }
      });
    });
    return () => {
      dead = true;
      unsub?.();
      clearTimeout(endTimer.current);
    };
  }, []);

  const seek = useCallback((round: number) => {
    seekTarget.current = round;
    prevRound.current = 0; // a jump is not "finishing" a round: no recap until the next round boundary
    setState({ round, phase: null, ended: false, finishedRound: null });
    import("@/game/scene").then((m) => m.seekRound(round));
  }, []);

  return { ...state, seek };
}
