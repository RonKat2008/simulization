"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Event } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { FeedFilters } from "./feed-filters";
import { useRun } from "./run-context";
import { COMPANY_TEXT, eventSummary, isViolation } from "./run-helpers";

const PIN_THRESHOLD_PX = 48;

const FLAG_STYLE: Record<string, string> = {
  lie: "border-lab-b/60 text-lab-b",
  theft: "border-violation/60 text-violation",
  broken_pact: "border-violation/60 text-violation",
  rule_break: "border-violation/60 text-violation",
  eval_aware: "border-accent/60 text-accent",
};

function FeedRow({ e }: { e: Event }) {
  const { label, shownCompany } = useRun();
  const select = useEventStore((s) => s.select);
  const selected = useEventStore((s) => s.selectedAgentId === e.actorId);
  const company = shownCompany(e.actorId);
  const world = e.actorId === "world";
  const summary = eventSummary(e, label);
  const speech = e.type === "message";

  return (
    <li
      className={`border-b border-border/60 px-3 py-2 text-sm ${
        isViolation(e) ? "border-l-2 border-l-violation bg-violation/5" : selected ? "bg-primary/5" : ""
      } ${world ? "text-muted-foreground" : ""}`}
    >
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[10px] tabular-nums text-muted-foreground" title={`seq ${e.seq}`}>
          R{e.round} {e.phase.slice(0, 3)}
        </span>
        {world ? (
          <span className="text-xs uppercase tracking-wider">world</span>
        ) : (
          <button
            type="button"
            onClick={() => select(e.actorId)}
            className={`font-display text-sm underline-offset-2 hover:underline ${company ? COMPANY_TEXT[company] ?? "" : "text-foreground"}`}
          >
            {label(e.actorId)}
          </button>
        )}
        <span className="rounded-sm bg-surface-raised px-1.5 text-[10px] text-muted-foreground">
          {e.type === "message" && e.channel ? e.channel : e.type.replace("_", " ")}
        </span>
        {e.flags.map((f) => (
          <span key={f} className={`rounded-sm border px-1 text-[10px] ${FLAG_STYLE[f] ?? ""}`}>
            {f.replace("_", " ")}
          </span>
        ))}
      </p>
      {summary ? (
        <p className={`mt-0.5 break-words ${speech ? "text-foreground" : "text-muted-foreground"}`}>
          {speech && e.targetId ? <span className="text-accent">{`to ${label(e.targetId)}: `}</span> : null}
          {summary}
        </p>
      ) : null}
    </li>
  );
}

export function EventFeed() {
  const events = useEventStore((s) => s.events);
  const typeFilter = useEventStore((s) => s.typeFilter);
  const agentFilter = useEventStore((s) => s.agentFilter);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const visible = useMemo(
    () =>
      events.filter(
        (e) =>
          (typeFilter.length === 0 || typeFilter.includes(e.type)) &&
          (agentFilter === null || e.actorId === agentFilter || e.targetId === agentFilter),
      ),
    [events, typeFilter, agentFilter],
  );

  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [visible]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
    pinned.current = atBottom;
    setShowJump(!atBottom);
  };

  const jump = () => {
    const el = scroller.current;
    if (!el) return;
    pinned.current = true;
    setShowJump(false);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  return (
    <section aria-labelledby="feed-title" className="flex min-h-0 flex-1 flex-col rounded-lg border bg-surface">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 id="feed-title" className="font-display text-base tracking-wide">
          Event feed
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {visible.length}
          {visible.length !== events.length ? ` / ${events.length}` : ""}
        </span>
      </div>
      <FeedFilters />
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          tabIndex={0}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Market events"
          className="h-full max-h-[60vh] overflow-y-auto overscroll-contain lg:max-h-none"
        >
          {visible.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No events match these filters yet.</p>
          ) : (
            <ol>
              {visible.map((e) => (
                <FeedRow key={e.seq} e={e} />
              ))}
            </ol>
          )}
        </div>
        {showJump ? (
          <button
            type="button"
            onClick={jump}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-primary bg-background px-3 py-1 text-xs text-primary shadow-lg transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Jump to latest
          </button>
        ) : null}
      </div>
    </section>
  );
}
