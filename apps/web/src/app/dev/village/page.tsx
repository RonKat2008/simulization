"use client";
// Owner: C. Dev-only harness: plays a mock run through the event store into the village.
import { useEffect, useState } from "react";
import type { Event } from "@simulization/shared";
import labeled from "@simulization/shared/mock/mock-run.labeled.json";
import blind from "@simulization/shared/mock/mock-run.blind.json";
import VillageCanvas from "@/game/VillageCanvas";
import { useEventStore } from "@/store/eventStore";

const RUNS = { labeled, blind };

export default function DevVillage() {
  const [which, setWhich] = useState<keyof typeof RUNS>("labeled");
  const selected = useEventStore((s) => s.selectedAgentId);

  useEffect(() => {
    const { reset, load } = useEventStore.getState();
    reset();
    load(RUNS[which].events as Event[]);
  }, [which]);

  return (
    <main className="mx-auto w-full max-w-[1280px] space-y-2 p-4 font-mono text-sm text-slate-300">
      <div className="flex gap-2">
        {(Object.keys(RUNS) as (keyof typeof RUNS)[]).map((k) => (
          <button key={k} onClick={() => setWhich(k)} className={k === which ? "underline" : ""}>
            {k}
          </button>
        ))}
        <span className="ml-auto">selected: {selected ?? "none"}</span>
      </div>
      <VillageCanvas agents={RUNS[which].agents} />
    </main>
  );
}
