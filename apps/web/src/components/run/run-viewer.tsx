"use client";
import { useEffect, useMemo, useState } from "react";
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
import { BlindBanner, TopBar } from "./top-bar";
import { useRunSource } from "./use-run-source";
import { panelId, tabId, useView, ViewTabs } from "./view-tabs";
import DataView from "@/components/run/views/data-view";
import ResearchView from "@/components/run/views/research-view";

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

export function RunViewer({ id }: { id: string }) {
  const meta = useRunSource(id);
  const events = useEventStore((s) => s.events);
  const storeRunId = useEventStore((s) => s.runId);
  const [view, setView] = useView();

  // Guide is shown until dismissed; the choice is remembered. `ready` avoids a flash before storage is read.
  const guide = useStoredFlag("guide-dismissed", false);
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
        document.getElementById("feed-search")?.focus();
      }
      if ((ev.key === "[" || ev.key === "]") && agents.length) {
        const i = agents.findIndex((a) => a.id === st.selectedAgentId);
        const n = ev.key === "]" ? i + 1 : i - 1;
        st.select(agents[(n + agents.length) % agents.length]!.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agents, guideDismissed, setGuide]);

  const last = events.at(-1);
  const round = meta.round ?? last?.round ?? null;
  const phase: Phase | null = meta.phase ?? last?.phase ?? null;

  if (storeRunId !== id) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading run...</p>;

  if (meta.error && events.length === 0) return <ErrorPanel message={meta.error} />;

  return (
    <RunProvider value={ctx}>
      <div className="flex min-h-dvh flex-col">
        <TopBar status={meta.status} round={round} phase={phase} mode={meta.mode} wealthVisibility={meta.wealthVisibility} isMock={meta.isMock} reportStatus={meta.reportStatus} reportRunId={meta.reportRunId} helpOpen={guideOpen} onHelp={() => setGuide(guideOpen)} />
        {guideOpen ? <RunLegend onClose={() => setGuide(true)} /> : null}
        {ctx.blind ? <BlindBanner /> : null}
        {meta.status === "offline" ? <OfflineStrip eventCount={events.length} /> : null}
        <main className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-1 flex-col gap-3 px-4 py-3 sm:px-6">
          {meta.status === "ended" && events.length > 0 ? <RunSummary events={events} isMock={meta.isMock} mode={meta.mode} /> : null}
          <details className="rounded-md border px-3 py-2"><summary className="cursor-pointer text-sm font-medium">Behavioral measures · counts and denominators</summary><div className="mt-3"><MetricsBar events={events} /></div></details>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
            <div className="flex min-w-0 flex-col gap-3">
              <ViewTabs view={view} onChange={setView} />
              <div role="tabpanel" id={panelId(view)} aria-labelledby={tabId(view)} tabIndex={0} className="min-w-0 max-w-full overflow-x-auto outline-none focus-visible:ring-1 focus-visible:ring-primary">
                {view === "game" ? (
                  <div className="overflow-hidden rounded-lg border bg-surface">
                    <VillageCanvas key={id} agents={canvasAgents} />
                  </div>
                ) : view === "data" ? (
                  <DataView />
                ) : (
                  <ResearchView />
                )}
              </div>
              <AgentCard finalScores={meta.finalScores} wealthVisibility={meta.wealthVisibility} />
              <Roster finalScores={meta.finalScores} />
            </div>
            <div className="flex min-h-[28rem] min-w-0 flex-col lg:sticky lg:top-3 lg:h-[calc(100dvh-1.5rem)] lg:min-h-0">
              <EventFeed followLatest={!meta.isMock} status={meta.status} />
            </div>
          </div>
        </main>
      </div>
    </RunProvider>
  );
}
