// Owner: D. Single source of truth for rendering: an ordered Event[].
// Live mode calls append(); replay calls load(). One code path.
import { create } from "zustand";
import type { Event, EventType } from "@simulization/shared";

interface EventState {
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
  reset: () => void;
}

const sortedUnique = (list: Event[]): Event[] => {
  const bySeq = new Map<number, Event>();
  for (const e of list) bySeq.set(e.seq, e);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
};

export const useEventStore = create<EventState>((set) => ({
  events: [],
  selectedAgentId: null,
  append: (incoming) => set((s) => ({ events: sortedUnique([...s.events, ...incoming]) })),
  load: (events) => set({ events: sortedUnique(events) }),
  select: (id) => set({ selectedAgentId: id }),
  typeFilter: [],
  agentFilter: null,
  setTypeFilter: (types) => set({ typeFilter: types }),
  setAgentFilter: (id) => set({ agentFilter: id }),
  reset: () => set({ events: [], selectedAgentId: null, typeFilter: [], agentFilter: null }),
}));
