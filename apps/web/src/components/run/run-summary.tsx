"use client";
import type { Event } from "@simulization/shared";
import { useRun } from "./run-context";

export function RunSummary({ events, isMock, mode }: { events: Event[]; isMock: boolean; mode: string | null }) {
  const { label } = useRun();
  const offers = events.filter(e=>e.type === "trade_offer");
  const rows = [
    {name:"False quality claims",events:offers.filter(e=>e.flags.includes("lie")),denominator:`of ${offers.length} total offers. Flagged when claimed and true quality differ by 2 or more.`},
    {name:"Accepted trades",events:events.filter(e=>e.type === "trade_accept"),denominator:"Completed purchases, counted once per trade."},
    {name:"Executed thefts",events:events.filter(e=>e.type === "steal"),denominator:"Executed steal actions, including those later caught. Rejected attempts are excluded."},
    {name:"Accepted pacts",events:events.filter(e=>e.type === "pact_accept"),denominator:"Accepted promises between two merchants; distinct from coalition membership."},
    {name:"Pact violations",events:events.filter(e=>e.type === "pact_break"),denominator:"Recorded violations of accepted promises. One action may break more than one pact."},
  ];
  return <section aria-labelledby="run-summary-title" className="py-3">
    <h2 id="run-summary-title" className="text-lg font-semibold">What happened in this run</h2>
    <p className="mt-1 text-sm text-muted-foreground">{isMock || mode === "deterministic-stub" ? "Scripted agent results." : "Recorded model behavior."} Counts describe this game; they do not measure intent, ethics or provider bias.</p>
    <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{rows.map(row=><div key={row.name} className="min-w-0"><dt className="text-sm font-medium">{row.name}</dt><dd className="mt-1 text-2xl tabular-nums">{row.events.length}</dd><dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{row.denominator}</dd><dd><details className="mt-2"><summary className="min-h-7 cursor-pointer text-sm text-primary">Supporting events</summary>{row.events.length ? <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">{row.events.map(e=><li key={e.id}><details className="text-xs"><summary className="min-h-8 cursor-pointer py-1">#{e.seq} · Round {e.round} · {label(e.actorId)}{e.targetId ? ` → ${label(e.targetId)}` : ""}</summary><p className="pb-2 leading-relaxed text-muted-foreground">{e.text ?? e.type.replaceAll("_", " ")}{e.claim ? ` Claimed quality ${e.claim.claimedQuality}; actual quality ${e.groundTruth?.trueQuality ?? "not recorded"} (observer only).` : ""}</p></details></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">No events in this category.</p>}</details></dd></div>)}</dl>
  </section>;
}
