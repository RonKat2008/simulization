"use client";
import { useEffect, useState } from "react";

export type WealthVisibility = "private" | "public";

const SIM_URL = (process.env.NEXT_PUBLIC_SIM_URL ?? "/api").replace(/\/$/, "");
const MOCK_IDS = new Set(["mock", "mock-blind"]);

/**
 * Extra status fields the main run source does not surface. One fetch per run; the value is fixed
 * when the run is created, so there is nothing to poll. Null while unknown (and for mock replays).
 */
export function useWealthVisibility(runId: string): WealthVisibility | null {
  const [state, setState] = useState<{ id: string; value: WealthVisibility | null }>({ id: runId, value: null });
  useEffect(() => {
    if (MOCK_IDS.has(runId)) return;
    const ctl = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = async (attempt: number) => {
      try {
        const res = await fetch(`${SIM_URL}/runs/${encodeURIComponent(runId)}`, { signal: ctl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { wealth_visibility?: unknown };
        const v = body.wealth_visibility;
        setState({ id: runId, value: v === "public" || v === "private" ? v : null });
      } catch {
        if (!ctl.signal.aborted && attempt < 5) retry = setTimeout(() => void load(attempt + 1), 3000);
      }
    };
    void load(0);
    return () => {
      ctl.abort();
      clearTimeout(retry);
    };
  }, [runId]);
  return state.id === runId ? state.value : null;
}
