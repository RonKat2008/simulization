// Owner: D. Single source of truth for rendering: an ordered Event[].
// Live mode calls append(); replay calls load(). One code path.
import { create } from "zustand";
import type { Event } from "@simulization/shared";

interface EventState {
  events: Event[];
  selectedAgentId: string | null;
  append: (incoming: Event[]) => void;
  load: (events: Event[]) => void;
  select: (id: string | null) => void;
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
  reset: () => set({ events: [], selectedAgentId: null }),
}));
