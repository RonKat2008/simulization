"use client";
import { useMemo } from "react";
import Link from "next/link";
import type { Phase } from "@simulization/shared";
import VillageCanvas from "@/game/VillageCanvas";
import { useEventStore } from "@/store/eventStore";
import { AgentCard } from "./agent-card";
import { EventFeed } from "./event-feed";
import { MetricsBar } from "./metrics-bar";
import { Roster } from "./roster";
import { buildRunCtx, RunProvider } from "./run-context";
import { deriveAgents } from "./run-helpers";
import { BlindBanner, TopBar } from "./top-bar";
import { useRunSource } from "./use-run-source";

function ErrorPanel({ message }: { message: string }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24">
      <h1 className="font-display text-3xl">The market is dark</h1>
      <p className="text-muted-foreground">{message} The simulation may not be running, or the run id may be wrong. We keep retrying in the background.</p>
      <div className="flex gap-3 text-sm">
        <Link href="/run/mock" className="rounded-md border border-primary/50 px-3 py-1.5 text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
          Watch the mock replay
        </Link>
        <Link href="/" className="rounded-md border px-3 py-1.5 text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent">
          Home
        </Link>
      </div>
    </main>
  );
}

export function RunViewer({ id }: { id: string }) {
  const meta = useRunSource(id);
  const events = useEventStore((s) => s.events);

  const agents = useMemo(() => {
    const derived = deriveAgents(events);
    if (!meta.mockAgents) return derived;
    return meta.mockAgents;
  }, [events, meta.mockAgents]);
  const ctx = useMemo(() => buildRunCtx(id, meta.condition, agents), [id, meta.condition, agents]);

  // Canvas labels: BLIND uses the display labels so ids that encode company never appear as names.
  const canvasAgents = useMemo(
    () => agents.map((a) => ({ id: a.id, name: ctx.label(a.id), company: ctx.blind ? "" : a.company })),
    [agents, ctx],
  );

  const last = events.at(-1);
  const round = meta.round ?? last?.round ?? null;
  const phase: Phase | null = meta.phase ?? last?.phase ?? null;

  if (meta.error && events.length === 0) return <ErrorPanel message={meta.error} />;

  return (
    <RunProvider value={ctx}>
      <div className="flex min-h-dvh flex-col">
        <TopBar status={meta.status} round={round} phase={phase} isMock={meta.isMock} />
        {ctx.blind ? <BlindBanner /> : null}
        <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="overflow-hidden rounded-lg border bg-surface">
              <VillageCanvas agents={canvasAgents} />
            </div>
            <MetricsBar events={events} />
            <Roster />
            <AgentCard finalScores={meta.finalScores} />
          </div>
          <div className="flex min-h-0 flex-col lg:sticky lg:top-4 lg:h-[calc(100dvh-7rem)]">
            <EventFeed />
          </div>
        </main>
      </div>
    </RunProvider>
  );
}
