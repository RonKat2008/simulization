"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Phase } from "@simulization/shared";
import VillageCanvas from "@/game/VillageCanvas";
import { useEventStore } from "@/store/eventStore";
import { AgentCard } from "./agent-card";
import { EventFeed } from "./event-feed";
import { MetricsBar } from "./metrics-bar";
import { Roster } from "./roster";
import { RunLegend } from "./run-legend";
import { useStoredFlag } from "./run-prefs";
import { RunSummary } from "./run-summary";
import { buildRunCtx, RunProvider } from "./run-context";
import { mergeAgents } from "./run-helpers";
import { ErrorPanel, OfflineStrip } from "./run-states";
import { TopBar } from "./top-bar";
import { useRunSource } from "./use-run-source";
import { panelId, tabId, useView, ViewTabs } from "./view-tabs";
import DataView from "@/components/run/views/data-view";
import ResearchView from "@/components/run/views/research-view";
import { GameSide } from "./game-side";
import { OPEN_LOG_EVENT, openEventLog } from "./log-nav";
import { GuideLine } from "./story/guide-line";
import { StoryPanel } from "./story/story-panel";

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

export function RunViewer({ id }: { id: string }) {
  const meta = useRunSource(id);
  const events = useEventStore((s) => s.events);
  const storeRunId = useEventStore((s) => s.runId);
  const [view, setView] = useView();

  // Guide is collapsed to one line by default; opening it is remembered. `ready` avoids a flash before storage is read.
  const guide = useStoredFlag("guide-dismissed", true);
  const { value: guideDismissed, set: setGuide } = guide;
  const guideOpen = guide.ready && !guideDismissed;

  const merged = useMemo(() => mergeAgents(meta.roster, events), [events, meta.roster]);
  // Keep the agents array identity stable while its contents are unchanged: every poll appends events,
  // and a new array would rebuild the run context and re-render every memoized log row.
  const sigNow = merged.map((a) => `${a.id}\u0000${a.name}\u0000${a.company}`).join("\u0001");
  const [held, setHeld] = useState({ sig: sigNow, agents: merged });
  if (held.sig !== sigNow) setHeld({ sig: sigNow, agents: merged });
  const agents = held.agents;
  const ctx = useMemo(() => buildRunCtx(id, meta.condition, agents), [id, meta.condition, agents]);

  // Canvas labels: BLIND uses display labels so ids that encode company never appear as names.
  const canvasAgents = useMemo(
    () => agents.map((a) => ({ id: a.id, name: ctx.label(a.id), company: ctx.blind ? "" : a.company })),
    [agents, ctx],
  );

  const openLog = useCallback(() => {
    if (view === "game") setView("research");
  }, [view, setView]);
  useEffect(() => {
    window.addEventListener(OPEN_LOG_EVENT, openLog);
    return () => window.removeEventListener(OPEN_LOG_EVENT, openLog);
  }, [openLog]);

  // Global shortcuts: Esc deselects, [ ] step through merchants, / focuses search.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const st = useEventStore.getState();
      if (ev.key === "Escape" && !isTyping(ev.target)) st.select(null);
      if (isTyping(ev.target)) return;
      if (ev.key === "?") {
        ev.preventDefault();
        setGuide(!guideDismissed);
      }
      if (ev.key === "/") {
        ev.preventDefault();
        // The searchable log sits beside the Data/Research tabs; open it first when on the Game tab.
        const focus = () => {
          const el = document.getElementById("feed-search");
          el?.closest("details")?.setAttribute("open", "");
          el?.focus();
        };
        if (view === "game") openEventLog(focus);
        else focus();
      }
      if ((ev.key === "[" || ev.key === "]") && agents.length) {
        const i = agents.findIndex((a) => a.id === st.selectedAgentId);
        const n = ev.key === "]" ? i + 1 : i - 1;
        st.select(agents[(n + agents.length) % agents.length]!.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agents, guideDismissed, setGuide, view]);

  const last = events.at(-1);
  const round = meta.round ?? last?.round ?? null;
  const phase: Phase | null = meta.phase ?? last?.phase ?? null;

  const resultsReady = meta.status === "ended" && events.length > 0;

  if (storeRunId !== id) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading run...</p>;

  if (meta.error && events.length === 0) return <ErrorPanel message={meta.error} />;

  const metrics = (
    <details className="group rounded-lg border bg-surface open:border-border-strong">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 text-[13px] text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary group-open:rounded-b-none group-open:text-foreground [&::-webkit-details-marker]:hidden">
        <span>Behavioral measures <span className="text-subtle-foreground">· counts and denominators</span></span>
        <span aria-hidden="true" className="font-mono text-xs text-subtle-foreground transition-transform duration-200 group-open:rotate-45">+</span>
      </summary>
      <div className="border-t px-3 py-3"><MetricsBar events={events} /></div>
    </details>
  );

  return (
    <RunProvider value={ctx}>
      <div className="flex min-h-dvh flex-col">
        <TopBar status={meta.status} round={round} phase={phase} mode={meta.mode} wealthVisibility={meta.wealthVisibility} labelMode={meta.labelMode} monitoring={meta.monitoring} isMock={meta.isMock} reportStatus={meta.reportStatus} reportRunId={meta.reportRunId} seed={meta.seed} helpOpen={guideOpen} onHelp={() => setGuide(guideOpen)} />
        {guideOpen ? <RunLegend onClose={() => setGuide(true)} /> : guide.ready ? <GuideLine onOpen={() => setGuide(false)} /> : null}
        {meta.status === "offline" ? <OfflineStrip eventCount={events.length} /> : null}
        <main className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
          <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 lg:items-start ${view === "game" ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "lg:grid-cols-[minmax(0,1fr)_420px]"}`}>
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ViewTabs view={view} onChange={setView} />
                {resultsReady ? (
                  <a href="#run-summary-title" className="rounded-sm text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-primary">
                    Skip to results ↓
                  </a>
                ) : null}
              </div>
              <div role="tabpanel" id={panelId(view)} aria-labelledby={tabId(view)} tabIndex={0} className="min-w-0 max-w-full overflow-x-auto outline-none focus-visible:ring-1 focus-visible:ring-primary">
                {view === "game" ? (
                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="overflow-hidden rounded-lg border bg-surface shadow-raised">
                      <VillageCanvas key={id} agents={canvasAgents} />
                    </div>
                    <StoryPanel key={id} events={events} runEnded={meta.status === "ended"} />
                  </div>
                ) : view === "data" ? (
                  <DataView />
                ) : (
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
                    <ResearchView />
                    <Roster finalScores={meta.finalScores} />
                    {resultsReady ? null : metrics}
                  </div>
                )}
              </div>
            </div>
            {view === "game" ? (
              <GameSide events={events} status={meta.status} finalScores={meta.finalScores} wealthVisibility={meta.wealthVisibility} onOpenLog={openLog} />
            ) : (
              <div className="flex min-h-[28rem] min-w-0 flex-col lg:sticky lg:top-3 lg:h-[calc(100dvh-1.5rem)] lg:min-h-0">
                <EventFeed followLatest={!meta.isMock} status={meta.status} />
              </div>
            )}
          </div>
          {resultsReady ? <RunSummary events={events} isMock={meta.isMock} mode={meta.mode} extra={metrics} /> : null}
          {view === "game" ? null : <AgentCard finalScores={meta.finalScores} wealthVisibility={meta.wealthVisibility} upto={Number.POSITIVE_INFINITY} ended={meta.status === "ended"} />}
        </main>
      </div>
    </RunProvider>
  );
}
