"use client";
// The Game tab's side column: leaderboard + "What's happening", both following the village playback,
// plus the merchant inspector at the same playback position.
import type { Event } from "@simulization/shared";
import { AgentCard } from "./agent-card";
import { HappeningFeed } from "./happening-feed";
import { Leaderboard } from "./leaderboard";
import { useRun } from "./run-context";
import { PLAYHEAD_END, usePlayhead } from "./story/use-playhead";
import { usePlayback } from "./story/use-playback";
import type { RunStatus } from "./use-run-source";

type Props = {
  events: Event[];
  status: RunStatus;
  finalScores: Record<string, number> | null;
  wealthVisibility: "private" | "public" | null;
  onOpenLog: () => void;
};

export function GameSide({ events, status, finalScores, wealthVisibility, onOpenLog }: Props) {
  const { label } = useRun();
  const runEnded = status === "ended";
  const lastEv = events.at(-1);
  const pb = usePlayback({ lastRound: lastEv?.round ?? 0, lastPhase: lastEv?.phase ?? null, runEnded });
  const upto = usePlayhead({ events, label, ended: pb.ended, follow: true });
  const atEnd = runEnded && upto === PLAYHEAD_END;

  return (
    <>
      <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-3 lg:h-[calc(100dvh-1.5rem)]">
        <Leaderboard upto={upto} finalScores={finalScores} ended={atEnd} />
        <HappeningFeed upto={upto} status={status} onOpenLog={onOpenLog} />
      </div>
      <AgentCard finalScores={finalScores} wealthVisibility={wealthVisibility} upto={upto} ended={atEnd} />
    </>
  );
}
