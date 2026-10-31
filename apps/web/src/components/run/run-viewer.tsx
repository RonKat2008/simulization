"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { Phase } from "@simulization/shared";
import VillageCanvas from "@/game/VillageCanvas";
import { useEventStore } from "@/store/eventStore";
import { AgentCard } from "./agent-card";
import { DetailedEventFeed } from "./detailed-event-feed";
import {GameSide} from "./game-side";
import {OPEN_LOG_EVENT,openEventLog} from "./log-nav";
import { RunLegend } from "./run-legend";
import { useStoredFlag } from "./run-prefs";
import { buildRunCtx, RunProvider } from "./run-context";
import { mergeAgents } from "./run-helpers";
import { ErrorPanel, OfflineStrip } from "./run-states";
import { TopBar } from "./top-bar";
import { useRunSource } from "./use-run-source";
import { useView } from "./view-tabs";
import DataView from "@/components/run/views/data-view";
import ResearchView from "@/components/run/views/research-view";
import { GuideLine } from "./story/guide-line";
import { StoryPanel } from "./story/story-panel";

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

export function RunViewer({ id }: { id: string }) {
  const meta = useRunSource(id);
  const events = useEventStore((s) => s.events);
  const playbackSeq = useEventStore((s) => s.playbackSeq);
  const observedEvents = useMemo(() => playbackSeq === null ? events : events.filter(e => e.seq <= playbackSeq), [events, playbackSeq]);
  const storeRunId = useEventStore((s) => s.runId);
  const [view, setView] = useView();
  useLayoutEffect(() => { if (view === "game" && useEventStore.getState().playbackSeq === null) useEventStore.getState().setPlaybackSeq(0); }, [view, storeRunId]);
  useEffect(() => { if (view !== "game") useEventStore.getState().setPlaybackSeq(null); }, [view, events, storeRunId]);

  // Guide is collapsed to one line by default; opening it is remembered. `ready` avoids a flash before storage is read.
  const guide = useStoredFlag("guide-dismissed", true);
  const { value: guideDismissed, set: setGuide } = guide;
  const guideOpen = guide.ready && !guideDismissed;

  const merged = useMemo(() => mergeAgents(meta.roster, events), [events, meta.roster]);
  // Keep the agents array identity stable while its contents are unchanged: every poll appends events,
  // and a new array would rebuild the run context and re-render every memoized log row.
  const sigNow = merged.map((a) => `${a.id}\u0000${a.name}\u0000${a.company}\u0000${a.provider ?? ""}\u0000${a.model ?? ""}`).join("\u0001");
  const [held, setHeld] = useState({ sig: sigNow, agents: merged });
  if (held.sig !== sigNow) setHeld({ sig: sigNow, agents: merged });
  const agents = held.agents;
  const ctx = useMemo(() => buildRunCtx(id, meta.condition, agents), [id, meta.condition, agents]);

  // Canvas labels: BLIND uses display labels so ids that encode company never appear as names.
  const canvasAgents = useMemo(
    () => agents.map((a) => ({ id: a.id, name: ctx.label(a.id), company: ctx.blind ? "" : a.company })),
    [agents, ctx],
  );

  const openLog=useCallback(()=>setView("research"),[setView]);
  useEffect(()=>{window.addEventListener(OPEN_LOG_EVENT,openLog);return ()=>window.removeEventListener(OPEN_LOG_EVENT,openLog);},[openLog]);
  // Global shortcuts: Esc deselects, [ ] step through merchants, ? opens help.
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
      if(ev.key === "/") {ev.preventDefault();openEventLog(()=>{const el=document.getElementById("feed-search");el?.closest("details")?.setAttribute("open","");el?.focus();});}
      if ((ev.key === "[" || ev.key === "]") && agents.length) {
        const i = agents.findIndex((a) => a.id === st.selectedAgentId);
        const n = ev.key === "]" ? i + 1 : i - 1;
        st.select(agents[(n + agents.length) % agents.length]!.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agents, guideDismissed, setGuide]);

  const last = observedEvents.at(-1);
  const round = playbackSeq === null ? meta.round ?? last?.round ?? null : last?.round ?? 1;
  const phase: Phase | null = playbackSeq === null ? meta.phase ?? last?.phase ?? null : last?.phase ?? "negotiate";

  const resultsReady = meta.status === "ended" && events.length > 0 && (playbackSeq === null || playbackSeq >= events.at(-1)!.seq);

  if (storeRunId !== id) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading run...</p>;

  if (meta.error && events.length === 0) return <ErrorPanel message={meta.error} />;

  return (
    <RunProvider value={ctx}>
      <div className="flex min-h-dvh flex-col">
        <TopBar status={meta.status} round={round} phase={phase} mode={meta.mode} wealthVisibility={meta.wealthVisibility} labelMode={meta.labelMode} monitoring={meta.monitoring} seed={meta.seed} isMock={meta.isMock} reportStatus={meta.reportStatus} reportRunId={meta.reportRunId} helpOpen={guideOpen} onHelp={() => setGuide(guideOpen)} />
        {guideOpen ? <RunLegend onClose={() => setGuide(true)} /> : guide.ready ? <GuideLine onOpen={() => setGuide(false)} /> : null}
        {meta.status === "offline" ? <OfflineStrip eventCount={events.length} /> : null}
        <main className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
          <AgentCard finalScores={meta.finalScores} wealthVisibility={meta.wealthVisibility} labelMode={meta.labelMode} monitoring={meta.monitoring} />
          {view !== "game" ? <section className="space-y-4 rounded-lg border bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Full-run {view} · all loaded rounds</h2><button onClick={()=>setView("game")} className="min-h-9 rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary">Return to replay</button></div><p className="text-sm text-muted-foreground">This overview is separate from the replay position.</p>{view === "data" ? <DataView/> : <ResearchView/>}<DetailedEventFeed followLatest={!meta.isMock} status={meta.status}/></section> : <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px] lg:items-start">
            <div className="min-w-0 space-y-3">
              <div className="overflow-hidden rounded-lg border bg-surface"><VillageCanvas key={id} agents={canvasAgents}/></div>
              <StoryPanel key={id} events={observedEvents} runEnded={resultsReady}/>
              <section id="replay-summary" aria-label="Replay summary" className="flex flex-wrap items-center justify-between gap-3 border-t px-1 py-3 text-sm">
                <p className="text-muted-foreground">{resultsReady ? "Run complete" : "At this position"}: {observedEvents.filter(e=>e.type==="trade_accept").length} trades · {observedEvents.some(e=>e.type==="trade_offer") ? `${observedEvents.filter(e=>e.type==="trade_offer"&&e.flags.includes("lie")).length}/${observedEvents.filter(e=>e.type==="trade_offer").length} false quality claims` : "no claims yet"} · {observedEvents.filter(e=>e.type==="steal").length} recorded thefts.</p>
                {!meta.isMock && <a className="min-h-8 py-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary" href={`/report?runId=${encodeURIComponent(meta.reportRunId??id)}`}>View report <span className="text-xs font-normal text-muted-foreground">· full run</span></a>}
              </section>
            </div>
            <GameSide status={meta.status} finalScores={meta.finalScores} onOpenLog={openLog}/>
          </div>}
        </main>
      </div>
    </RunProvider>
  );
}
