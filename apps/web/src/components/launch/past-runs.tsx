"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ROUNDS } from "@simulization/shared";
import { RunListSchema, readErrorMessage, type RunSummary } from "./schemas";
import { settingBadges } from "../runs/settings";

type State =
  | { kind: "loading" }
  | { kind: "ready"; runs: RunSummary[] }
  | { kind: "error"; message: string };

const LINK =
  "text-foreground underline decoration-border-strong underline-offset-4 transition-colors duration-150 hover:text-primary hover:decoration-primary";

function formatCreated(value: RunSummary["createdAt"]): string {
  if (value === null || value === undefined) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function modeLabel(mode: RunSummary["mode"]): string {
  if (!mode) return "–";
  if (mode.includes("stub")) return "stub";
  if (mode.includes("live")) return "live";
  return mode;
}

function statusTone(status: string): string {
  if (status === "done") return "text-lab-c";
  if (status === "failed") return "text-violation";
  return "text-lab-b";
}

export function PastRuns({ refreshKey = 0 }: { refreshKey?: number }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch("/api/runs", { cache: "no-store", signal: controller.signal });
        if (!res.ok) {
          setState({ kind: "error", message: await readErrorMessage(res) });
          return;
        }
        const parsed = RunListSchema.safeParse(await res.json());
        setState(
          parsed.success
            ? { kind: "ready", runs: parsed.data }
            : { kind: "error", message: "The server returned an unexpected run list." },
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ kind: "error", message: "Could not reach the server." });
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey, nonce]);

  return (
    <section aria-labelledby="past-runs-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="past-runs-heading" className="text-lg font-semibold">
          Past runs
        </h2>
        <button
          type="button"
          onClick={() => {
            setState({ kind: "loading" });
            setNonce((n) => n + 1);
          }}
          disabled={state.kind === "loading"}
          className="inline-flex min-h-10 items-center rounded-md border border-border-strong bg-surface px-4 text-xs text-muted-foreground transition-colors duration-150 hover:bg-surface-raised hover:text-foreground disabled:opacity-50"
        >
          {state.kind === "loading" ? "Loading…" : "Refresh"}
        </button>
      </div>

      {state.kind === "loading" ? (
        <p role="status" className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Loading…
        </p>
      ) : null}

      {state.kind === "error" ? (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-dashed p-6 text-sm">
          <p className="font-semibold text-violation">Run history unavailable.</p>
          <p className="leading-relaxed text-muted-foreground">{state.message}</p>
        </div>
      ) : null}

      {state.kind === "ready" && state.runs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm leading-relaxed text-muted-foreground">
          No runs yet.
        </p>
      ) : null}

      {state.kind === "ready" && state.runs.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border bg-surface shadow-raised">
          <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
            <caption className="sr-only">Recorded runs, newest first</caption>
            <thead className="bg-surface font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-normal">Run</th>
                <th scope="col" className="px-3 py-2.5 font-normal">Condition</th>
                <th scope="col" className="px-3 py-2.5 font-normal">Seed</th>
                <th scope="col" className="px-3 py-2.5 font-normal">Status</th>
                <th scope="col" className="px-3 py-2.5 font-normal">Round</th>
                <th scope="col" className="px-3 py-2.5 font-normal">Open</th>
              </tr>
            </thead>
            <tbody>
              {state.runs.map((run) => (
                <tr key={run.id} className="border-t transition-colors hover:bg-surface-raised">
                  <th scope="row" className="max-w-[10rem] px-3 py-2.5 font-normal" title={`${run.id} · ${formatCreated(run.createdAt)}`}>
                    <span className="block truncate">{run.id}</span>
                    <span className="block text-xs text-muted-foreground">{modeLabel(run.mode)} · {run.wealth_visibility ?? "private"} wealth{settingBadges(run).map((b) => ` · ${b}`).join("")}</span>
                  </th>
                  <td className={`px-3 py-2.5 font-mono text-xs ${run.condition === "BLIND" ? "text-accent" : "text-primary"}`}>
                    {run.condition}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{run.seed ?? "–"}</td>
                  <td className={`px-3 py-2.5 ${statusTone(run.status)}`}>{run.status}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{run.round ?? "–"}/{ROUNDS}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <Link href={`/run/${encodeURIComponent(run.id)}`} className={LINK}>
                      viewer
                    </Link>
                    <span className="mx-2 text-muted-foreground" aria-hidden="true">/</span>
                    <Link href={`/report?runId=${encodeURIComponent(run.id)}`} className={LINK}>
                      report
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
