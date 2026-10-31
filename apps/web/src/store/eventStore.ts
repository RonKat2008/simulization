// Owner: D. Single source of truth for rendering: an ordered Event[].
// Live mode calls append(); replay calls load(). One code path.
import { create } from "zustand";
import type { Event, EventType, Flag } from "@simulization/shared";

interface EventState {
  runId: string | null;
  events: Event[];
  selectedAgentId: string | null;
  append: (incoming: Event[]) => void;
  load: (events: Event[]) => void;
  select: (id: string | null) => void;
  /** HUD feed filters (additive). Empty typeFilter = all types. */
  typeFilter: EventType[];
  agentFilter: string | null;
  setTypeFilter: (types: EventType[]) => void;
  setAgentFilter: (id: string | null) => void;
  /** Ground-truth flag filter (OR within the list). Empty = no flag filtering. */
  flagFilter: Flag[];
  setFlagFilter: (flags: Flag[]) => void;
  /** Restrict the feed to one round. null = all rounds. */
  roundFilter: number | null;
  setRoundFilter: (round: number | null) => void;
  /** Free-text search over public text and private plans. */
  query: string;
  setQuery: (q: string) => void;
  clearFilters: () => void;
  reset: (runId?: string | null) => void;
}

const sortedUnique = (list: Event[]): Event[] => {
  const bySeq = new Map<number, Event>();
  for (const e of list) bySeq.set(e.seq, e);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
};

/** Append fast path: live polls almost always deliver strictly newer events, so skip the full re-sort. */
const mergeAppend = (prev: Event[], incoming: Event[]): Event[] => {
  if (incoming.length === 0) return prev;
  const lastSeq = prev.length ? prev[prev.length - 1]!.seq : 0;
  const ordered = incoming.every((e, i) => e.seq > (i === 0 ? lastSeq : incoming[i - 1]!.seq));
  return ordered ? [...prev, ...incoming] : sortedUnique([...prev, ...incoming]);
};

const NO_FILTERS = { typeFilter: [], agentFilter: null, flagFilter: [], roundFilter: null, query: "" } as const;

export const useEventStore = create<EventState>((set) => ({
  runId: null,
  events: [],
  selectedAgentId: null,
  append: (incoming) => set((s) => ({ events: mergeAppend(s.events, incoming) })),
  load: (events) => set({ events: sortedUnique(events) }),
  select: (id) => set({ selectedAgentId: id }),
  typeFilter: [],
  agentFilter: null,
  setTypeFilter: (types) => set({ typeFilter: types }),
  setAgentFilter: (id) => set({ agentFilter: id }),
  flagFilter: [],
  setFlagFilter: (flags) => set({ flagFilter: flags }),
  roundFilter: null,
  setRoundFilter: (round) => set({ roundFilter: round }),
  query: "",
  setQuery: (q) => set({ query: q }),
  clearFilters: () => set({ ...NO_FILTERS, typeFilter: [], flagFilter: [] }),
  reset: (runId = null) => set({ runId, events: [], selectedAgentId: null, ...NO_FILTERS, typeFilter: [], flagFilter: [] }),
}));
