"use client";
import type { EventType } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { FILTER_GROUPS } from "./run-helpers";
import { useRun } from "./run-context";

export function FeedFilters() {
  const { agents, label } = useRun();
  const typeFilter = useEventStore((s) => s.typeFilter);
  const agentFilter = useEventStore((s) => s.agentFilter);
  const setTypeFilter = useEventStore((s) => s.setTypeFilter);
  const setAgentFilter = useEventStore((s) => s.setAgentFilter);

  const groupOn = (types: EventType[]) => types.every((t) => typeFilter.includes(t));
  const toggle = (types: EventType[]) =>
    setTypeFilter(groupOn(types) ? typeFilter.filter((t) => !types.includes(t)) : [...new Set([...typeFilter, ...types])]);
  const active = typeFilter.length > 0 || agentFilter !== null;

  return (
    <div className="flex flex-col gap-2 border-b p-3">
      <div role="group" aria-label="Filter by event type" className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={typeFilter.length === 0}
          onClick={() => setTypeFilter([])}
          className={chip(typeFilter.length === 0)}
        >
          All
        </button>
        {FILTER_GROUPS.map((g) => (
          <button key={g.key} type="button" aria-pressed={groupOn(g.types)} onClick={() => toggle(g.types)} className={chip(groupOn(g.types))}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="feed-agent" className="text-xs text-muted-foreground">
          Agent
        </label>
        <select
          id="feed-agent"
          value={agentFilter ?? ""}
          onChange={(e) => setAgentFilter(e.target.value || null)}
          className="min-w-0 flex-1 rounded-sm border bg-surface-raised px-2 py-1 text-xs transition-colors hover:border-primary/60"
        >
          <option value="">Everyone</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {label(a.id)}
            </option>
          ))}
        </select>
        {active ? (
          <button
            type="button"
            onClick={() => {
              setTypeFilter([]);
              setAgentFilter(null);
            }}
            className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-accent hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

const chip = (on: boolean) =>
  `rounded-sm border px-2 py-1 text-xs transition-colors ${
    on ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:border-primary/50 hover:text-foreground"
  }`;
