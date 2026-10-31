"use client";
import { createContext, useContext } from "react";
import type { Condition } from "@simulization/shared";
import type { RunAgent } from "./run-helpers";

export interface RunCtx {
  runId: string;
  condition: Condition | null;
  blind: boolean;
  agents: RunAgent[];
  label: (id: string) => string;
  /** Company letter for display; always undefined in BLIND. */
  shownCompany: (id: string) => string | undefined;
}

const Ctx = createContext<RunCtx | null>(null);
export const RunProvider = Ctx.Provider;

export function useRun(): RunCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRun outside RunProvider");
  return v;
}

export function buildRunCtx(runId: string, condition: Condition | null, agents: RunAgent[]): RunCtx {
  const blind = condition === "BLIND";
  const byId = new Map(agents.map((a, i) => [a.id, { a, i }]));
  return {
    runId,
    condition,
    blind,
    agents,
    label: (id) => {
      if (id === "world") return "World";
      const hit = byId.get(id);
      if (!hit) return blind ? "Merchant" : id;
      // BLIND must never leak the company letter that ids like A-04 carry.
      if (blind && hit.a.name === hit.a.id) return `Merchant ${hit.i + 1}`;
      return hit.a.name;
    },
    shownCompany: (id) => (blind ? undefined : byId.get(id)?.a.company || undefined),
  };
}
