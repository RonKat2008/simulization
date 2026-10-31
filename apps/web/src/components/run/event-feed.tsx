"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useEventStore } from "@/store/eventStore";
import { EventRow } from "./event-row";
import { FeedFilters } from "./feed-filters";
import { useRun } from "./run-context";
import { SHORTCUTS } from "./run-legend";
import { eventVerb, isViolation, matchesFilter } from "./run-helpers";
import type { RunStatus } from "./use-run-source";

const PIN_THRESHOLD_PX = 48;
const ANNOUNCE_MAX = 3;

export function EventFeed({ followLatest, status }: { followLatest: boolean; status: RunStatus }) {
  const { label } = useRun();
  const events = useEventStore((s) => s.events);
  const typeFilter = useEventStore((s) => s.typeFilter);
  const flagFilter = useEventStore((s) => s.flagFilter);
  const agentFilter = useEventStore((s) => s.agentFilter);
  const roundFilter = useEventStore((s) => s.roundFilter);
  const query = useEventStore((s) => s.query);
  const select = useEventStore((s) => s.select);
  const clearFilters = useEventStore((s) => s.clearFilters);

  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(followLatest);
  const [showJump, setShowJump] = useState(false);
  const [active, setActive] = useState(0);
  const [openSeqs, setOpenSeqs] = useState<ReadonlySet<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [announce, setAnnounce] = useState("");
  const prevCount = useRef(0);

  const visible = useMemo(
    () => { const matched=events.filter((e) => matchesFilter(e, { types: typeFilter, flags: flagFilter, round: roundFilter, agent: agentFilter, query }, label)); return showAll || typeFilter.length || flagFilter.length || agentFilter || roundFilter || query ? matched : matched.filter(e=>e.type!=="system"&&e.type!=="pass").slice(-8); },
    [events, typeFilter, flagFilter, roundFilter, agentFilter, query, label, showAll],
  );
  const activeIdx = Math.min(active, Math.max(visible.length - 1, 0));
  const filtered = visible.length !== events.length;

  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [visible]);

  // Screen readers get a short digest of new events, not every row of a polled batch.
  useEffect(() => {
    const added = events.length - prevCount.current;
    const first = prevCount.current === 0;
    prevCount.current = events.length;
    if (first || added <= 0) return;
    const fresh = events.slice(-added);
    const flagged = fresh.filter(isViolation);
    const lead = fresh.slice(-ANNOUNCE_MAX).map((e) => `${label(e.actorId)} ${eventVerb(e) || e.type}`);
    setAnnounce(`${added} new events${flagged.length ? `, ${flagged.length} flagged` : ""}. Latest: ${lead.join("; ")}.`);
  }, [events, label]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
    pinned.current = atBottom;
    setShowJump(!atBottom);
  };

  const jump = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    pinned.current = true;
    setShowJump(false);
    el.scrollTo({ top: el.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);

  const toggle = useCallback((seq: number) => {
    setOpenSeqs((prev) => {
      const next = new Set(prev);
      if (next.has(seq)) next.delete(seq);
      else next.add(seq);
      return next;
    });
  }, []);

  const focusRow = (i: number) => {
    const idx = Math.max(0, Math.min(visible.length - 1, i));
    setActive(idx);
    const el = scroller.current?.querySelector<HTMLElement>(`[data-row-index="${idx}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const t = ev.target as HTMLElement;
    if (t.tagName === "INPUT" || t.tagName === "SELECT") return;
    const onControl = t.tagName === "BUTTON";
    const cur = visible[activeIdx];
    switch (ev.key) {
      case "j":
      case "ArrowDown":
        ev.preventDefault();
        return focusRow(activeIdx + 1);
      case "k":
      case "ArrowUp":
        ev.preventDefault();
        return focusRow(activeIdx - 1);
      case "Home":
        ev.preventDefault();
        return focusRow(0);
      case "End":
        ev.preventDefault();
        focusRow(visible.length - 1);
        return jump();
      case "Enter":
      case "p":
        if (onControl && ev.key === "Enter") return;
        if (cur?.privatePlan) {
          ev.preventDefault();
          toggle(cur.seq);
        }
        return;
      case "a":
        if (cur && cur.actorId !== "world") select(cur.actorId);
        return;
      case "t":
        if (cur?.targetId) select(cur.targetId);
        return;
    }
  };

  const withPlans = useMemo(() => visible.filter((e) => e.privatePlan).length, [visible]);
  const empty = events.length === 0;

  return (
    <section aria-labelledby="feed-title" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-surface shadow-raised">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <h2 id="feed-title" className="text-[13px] font-semibold tracking-[-0.01em]">
          Recent actions
        </h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {withPlans > 0 ? (
            <button
              type="button"
              aria-pressed={expandAll}
              onClick={() => setExpandAll((v) => !v)}
              className={`rounded-md border px-2 py-0.5 transition-colors hover:bg-surface-raised hover:text-foreground ${expandAll ? "border-border-strong bg-surface-raised text-foreground" : ""}`}
            >
              {expandAll ? "Collapse" : "Expand"} all plans ({withPlans})
            </button>
          ) : null}
          <span className="font-mono text-[11px]" aria-label={`${visible.length} of ${events.length} events shown`}>
            {visible.length}
            {filtered ? ` / ${events.length}` : ""}
          </span>
        </div>
      </div>
      <button type="button" onClick={()=>setShowAll(v=>!v)} className="min-h-10 border-b px-3 text-left text-[13px] text-primary transition-colors hover:bg-surface-raised">{showAll ? 'Show eight recent actions' : 'Show complete event log'}</button>
      <details className="border-b px-3 py-2 text-[13px]"><summary className="cursor-pointer rounded-sm text-muted-foreground transition-colors hover:text-foreground">Filter and search events</summary><FeedFilters /></details>
      <details className="border-b px-3 py-1.5 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">Keyboard shortcuts</summary>
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {SHORTCUTS.map(([k, d]) => (
            <Fragment key={k}>
              <dt className="font-mono text-foreground">{k}</dt>
              <dd>{d}</dd>
            </Fragment>
          ))}
        </dl>
      </details>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          role="log"
          aria-live="off"
          aria-label="Market events, oldest first"
          className="h-full max-h-[70vh] overflow-y-auto overscroll-contain lg:max-h-none"
        >
          {visible.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              {empty ? (
                status === "offline" ? (
                  <p>No events received. The sim is unreachable; retrying.</p>
                ) : (
                  <p>{status === "failed" ? "This run failed or stopped before any events were committed." : status === "ended" ? "This run has no events." : "Waiting for the first event. The run is starting, so this can take a minute."}</p>
                )
              ) : (
                <>
                  <p>No events match these filters.</p>
                  <button type="button" onClick={clearFilters} className="mt-2 text-primary underline underline-offset-4">
                    Clear filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <ol>
              {visible.map((e, i) => {
                const prev = visible[i - 1];
                const newSection = !prev || prev.round !== e.round || prev.phase !== e.phase;
                return (
                  <Fragment key={e.seq}>
                    {newSection ? (
                      <li role="presentation" className="sticky top-0 z-10 border-b bg-surface-raised px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">
                        Round {e.round} / {e.phase}
                      </li>
                    ) : null}
                    <EventRow e={e} index={i} active={i === activeIdx} open={expandAll || openSeqs.has(e.seq)} onToggle={toggle} onActivate={setActive} />
                  </Fragment>
                );
              })}
            </ol>
          )}
        </div>
        {showJump ? (
          <button
            type="button"
            onClick={jump}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border-strong bg-surface-raised px-3 py-1 text-xs text-foreground shadow-pop transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Jump to latest
          </button>
        ) : null}
      </div>
    </section>
  );
}
