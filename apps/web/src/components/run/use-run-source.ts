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
  /** Authoritative roster: the mock file, or the `agents` array of GET /runs/:id. Null until known. */
  roster: RunAgent[] | null;
  /** Server-reported run mode (initializing-live, live-model-relay, deterministic-stub). */
  mode: string | null;
  finalScores: Record<string, number> | null;
  isMock: boolean;
}

const MOCKS = { mock: labeled, "mock-blind": blind } as const;
/** Recorded real runs served as static files from public/runs, so they replay without the sim (e.g. on Vercel). */
const RECORDED: Record<string, string> = { featured: "/runs/featured.json" };
const SIM_URL = (process.env.NEXT_PUBLIC_SIM_URL ?? "/api").replace(/\/$/, "");
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
  agents?: unknown;
  mode?: string;
  /** Last committed event seq; terminal once status is done/failed. */
  seq?: number;
}

/** Highest seq such that every event 1..seq is in the store (gaps mean a read raced a write). */
function contiguousCursor(events: readonly Event[]): number {
  let cursor = 0;
  for (const e of events) {
    if (e.seq === cursor + 1) cursor = e.seq;
    else if (e.seq > cursor + 1) break;
  }
  return cursor;
}

function parseRoster(raw: unknown): RunAgent[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw.flatMap((r): RunAgent[] => {
    if (!r || typeof r !== "object") return [];
    const o = r as Record<string, unknown>;
    if (typeof o.id !== "string") return [];
    return [{ id: o.id, name: typeof o.name === "string" && o.name ? o.name : o.id, company: typeof o.company === "string" ? o.company : "" }];
  });
  return out.length ? out : null;
}

function mockMeta(id: string): RunMeta {
  const mock = MOCKS[id as keyof typeof MOCKS];
  return {
    condition: mock?.run.condition as Condition | null ?? null,
    status: mock ? "ended" : "connecting",
    round: null,
    phase: null,
    error: null,
    roster: mock ? (mock.agents as RunAgent[]) : null,
    mode: mock ? "recorded replay" : null,
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
    const recorded = RECORDED[id];
    if (recorded) {
      getJson(recorded)
        .then((raw) => {
          if (stopped) return;
          const file = raw as { run?: SimStatus & { seed?: number }; events?: unknown };
          const s = file.run ?? {};
          load(parseEvents(file.events));
          setMeta((m) => ({
            ...m,
            condition: s.condition ?? null,
            status: "ended",
            round: s.round ?? null,
            phase: s.phase ?? null,
            finalScores: s.finalScores ?? null,
            roster: parseRoster(s.agents),
            mode: s.mode ? `recorded ${s.mode}` : "recorded run",
            error: null,
          }));
        })
        .catch(() => {
          if (!stopped) setMeta((m) => ({ ...m, status: "offline", error: `Recorded run "${id}" could not be loaded.` }));
        });
      return () => {
        stopped = true;
      };
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fails = 0;
    let loaded = false;
    const base = `${SIM_URL}/runs/${encodeURIComponent(id)}`;

    const tick = async () => {
      let done = false;
      try {
        // Status first: its seq is the target the event cursor must reach before we can stop.
        const s = (await getJson(base)) as SimStatus;
        const after = contiguousCursor(useEventStore.getState().events);
        const evs = await getJson(`${base}/events?after=${after}`);
        if (stopped) return;
        const events = parseEvents(evs);
        if (events.length) append(events);
        fails = 0;
        loaded = true;
        const terminal = s.status === "done" || s.status === "failed" || s.stopped === true;
        const caughtUp = typeof s.seq !== "number" || contiguousCursor(useEventStore.getState().events) >= s.seq;
        done = terminal && caughtUp;
        // Still behind a terminal seq (paged or raced read): fetch again right away.
        if (terminal && !caughtUp && events.length > 0) {
          setTimeout(tick, 0);
          return;
        }
        setMeta((m) => ({
          ...m,
          condition: s.condition ?? m.condition,
          status: done ? "ended" : "live",
          round: s.round ?? m.round,
          phase: s.phase ?? m.phase,
          finalScores: s.finalScores ?? m.finalScores,
          roster: parseRoster(s.agents) ?? m.roster,
          mode: s.mode ?? m.mode,
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
