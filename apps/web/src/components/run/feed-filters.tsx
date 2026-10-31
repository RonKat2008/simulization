"use client";
import { useMemo } from "react";
import type { EventType, Flag } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { FILTER_GROUPS, FLAG_FILTERS, FLAG_LABEL } from "./run-helpers";
import { useRun } from "./run-context";

const chip = (on: boolean, tone = "primary") =>
  `rounded-sm border px-2 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
    on
      ? tone === "violation"
        ? "border-violation bg-violation/15 text-violation"
        : "border-primary bg-primary/15 text-primary"
      : "text-muted-foreground hover:border-primary/50 hover:text-foreground"
  }`;

export function FeedFilters() {
  const { agents, label } = useRun();
  const events = useEventStore((s) => s.events);
  const typeFilter = useEventStore((s) => s.typeFilter);
  const flagFilter = useEventStore((s) => s.flagFilter);
  const agentFilter = useEventStore((s) => s.agentFilter);
  const roundFilter = useEventStore((s) => s.roundFilter);
  const query = useEventStore((s) => s.query);
  const setTypeFilter = useEventStore((s) => s.setTypeFilter);
  const setFlagFilter = useEventStore((s) => s.setFlagFilter);
  const setAgentFilter = useEventStore((s) => s.setAgentFilter);
  const setRoundFilter = useEventStore((s) => s.setRoundFilter);
  const setQuery = useEventStore((s) => s.setQuery);
  const clearFilters = useEventStore((s) => s.clearFilters);

  const counts = useMemo(() => {
    const flags: Record<string, number> = {};
    const types: Record<string, number> = {};
    for (const e of events) {
      for (const f of e.flags) flags[f] = (flags[f] ?? 0) + 1;
      types[e.type] = (types[e.type] ?? 0) + 1;
    }
    return { flags, types };
  }, [events]);

  const groupOn = (types: EventType[]) => types.every((t) => typeFilter.includes(t));
  const toggleGroup = (types: EventType[]) =>
    setTypeFilter(groupOn(types) ? typeFilter.filter((t) => !types.includes(t)) : [...new Set([...typeFilter, ...types])]);
  const toggleFlag = (f: Flag) => setFlagFilter(flagFilter.includes(f) ? flagFilter.filter((x) => x !== f) : [...flagFilter, f]);
  const active = typeFilter.length > 0 || flagFilter.length > 0 || agentFilter !== null || roundFilter !== null || query !== "";

  return (
    <div className="flex flex-col gap-2 border-b p-3">
      <div role="group" aria-label="Filter by ground-truth flag" className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Flags</span>
        {FLAG_FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={flagFilter.includes(f)} onClick={() => toggleFlag(f)} className={chip(flagFilter.includes(f), f === "eval_aware" ? "primary" : "violation")}>
            {FLAG_LABEL[f]} <span className="tabular-nums opacity-70">{counts.flags[f] ?? 0}</span>
          </button>
        ))}
      </div>
      <div role="group" aria-label="Filter by event type" className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</span>
        {FILTER_GROUPS.map((g) => (
          <button key={g.key} type="button" aria-pressed={groupOn(g.types)} onClick={() => toggleGroup(g.types)} className={chip(groupOn(g.types))}>
            {g.label} <span className="tabular-nums opacity-70">{g.types.reduce((n, t) => n + (counts.types[t] ?? 0), 0)}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="feed-agent" className="sr-only">
          Filter by agent
        </label>
        <select
          id="feed-agent"
          value={agentFilter ?? ""}
          onChange={(e) => setAgentFilter(e.target.value || null)}
          className="min-w-0 flex-1 basis-28 rounded-sm border bg-surface-raised px-2 py-1 text-xs hover:border-primary/60"
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {label(a.id)}
            </option>
          ))}
        </select>
        <label htmlFor="feed-search" className="sr-only">
          Search public text and self-reported plans
        </label>
        <input
          id="feed-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search text, plans (/)"
          className="min-w-0 flex-1 basis-32 rounded-sm border bg-surface-raised px-2 py-1 text-xs placeholder:text-muted-foreground/70 hover:border-primary/60"
        />
      </div>
      {active ? (
        <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          {roundFilter !== null ? (
            <button type="button" onClick={() => setRoundFilter(null)} className="rounded-sm border px-1.5 py-0.5 hover:border-primary/60">
              Round {roundFilter} ×
            </button>
          ) : null}
          <button type="button" onClick={clearFilters} className="underline-offset-2 hover:text-accent hover:underline">
            Clear all filters
          </button>
        </p>
      ) : null}
    </div>
  );
}
