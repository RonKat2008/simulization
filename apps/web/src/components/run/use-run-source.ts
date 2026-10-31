"use client";
import { useEffect, useState } from "react";
import { EventSchema, type Condition, type Event, type Phase } from "@simulization/shared";
import labeled from "@simulization/shared/mock/mock-run.labeled.json";
import blind from "@simulization/shared/mock/mock-run.blind.json";
import { useEventStore } from "@/store/eventStore";
import type { RunAgent } from "./run-helpers";

export type RunStatus = "connecting" | "live" | "ended" | "offline";

export interface RunMeta {
  condition: Condition | null;
  status: RunStatus;
  round: number | null;
  phase: Phase | null;
  /** Set when the run could not be loaded at all. */
  error: string | null;
  mockAgents: RunAgent[] | null;
  finalScores: Record<string, number> | null;
  isMock: boolean;
}

const MOCKS = { mock: labeled, "mock-blind": blind } as const;
const SIM_URL = (process.env.NEXT_PUBLIC_SIM_URL ?? "http://localhost:8787").replace(/\/$/, "");
const POLL_MS = 1000;
const FETCH_TIMEOUT_MS = 5000;
const OFFLINE_AFTER_FAILS = 3;

class HttpError extends Error {
  constructor(public readonly code: number) {
    super(`HTTP ${code}`);
  }
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new HttpError(res.status);
  return res.json();
}

const parseEvents = (raw: unknown): Event[] =>
  Array.isArray(raw)
    ? raw.flatMap((r) => {
        const p = EventSchema.safeParse(r);
        return p.success ? [p.data] : [];
      })
    : [];

interface SimStatus {
  condition?: Condition;
  status?: string;
  round?: number;
  phase?: Phase;
  stopped?: boolean;
  finalScores?: Record<string, number>;
}

function mockMeta(id: string): RunMeta {
  const mock = MOCKS[id as keyof typeof MOCKS];
  return {
    condition: mock?.run.condition as Condition | null ?? null,
    status: mock ? "ended" : "connecting",
    round: null,
    phase: null,
    error: null,
    mockAgents: mock ? (mock.agents as RunAgent[]) : null,
    finalScores: mock ? (mock.run.finalScores as Record<string, number>) : null,
    isMock: Boolean(mock),
  };
}

/** One code path: mock runs load() once, live runs append() from polling. Everything renders from the store. */
export function useRunSource(id: string): RunMeta {
  const [meta, setMeta] = useState<RunMeta>(() => mockMeta(id));

  useEffect(() => {
    const { reset, load, append } = useEventStore.getState();
    reset();
    const mock = MOCKS[id as keyof typeof MOCKS];
    if (mock) {
      load(mock.events as Event[]);
      return;
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fails = 0;
    let loaded = false;
    const base = `${SIM_URL}/runs/${encodeURIComponent(id)}`;

    const tick = async () => {
      let done = false;
      try {
        const after = useEventStore.getState().events.at(-1)?.seq ?? 0;
        const [run, evs] = await Promise.all([getJson(base), getJson(`${base}/events?after=${after}`)]);
        if (stopped) return;
        const s = run as SimStatus;
        const events = parseEvents(evs);
        if (events.length) append(events);
        fails = 0;
        loaded = true;
        done = s.status === "done" || s.status === "failed" || s.stopped === true;
        setMeta((m) => ({
          ...m,
          condition: s.condition ?? m.condition,
          status: done ? "ended" : "live",
          round: s.round ?? m.round,
          phase: s.phase ?? m.phase,
          finalScores: s.finalScores ?? m.finalScores,
          error: null,
        }));
      } catch (err) {
        if (stopped) return;
        fails += 1;
        if (!loaded) {
          const notFound = err instanceof HttpError && err.code === 404;
          setMeta((m) => ({
            ...m,
            status: "offline",
            error: notFound ? `No run with id "${id}" exists on the sim.` : `Could not reach the sim at ${SIM_URL}.`,
          }));
        } else if (fails >= OFFLINE_AFTER_FAILS) {
          setMeta((m) => ({ ...m, status: "offline" }));
        }
      }
      if (!stopped && !done) timer = setTimeout(tick, POLL_MS);
    };
    void tick();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]);

  return meta;
}
