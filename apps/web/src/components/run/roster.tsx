"use client";
import { useMemo, type KeyboardEvent } from "react";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { COMPANY_BG, computeAgentStats, emptyStats } from "./run-helpers";

const COLS: { key: "messages" | "lies" | "thefts" | "caught" | "pactsBroken"; head: string; title: string; bad: boolean }[] = [
  { key: "messages", head: "Msg", title: "Messages sent", bad: false },
  { key: "lies", head: "Lies", title: "Lies told (ground truth)", bad: true },
  { key: "thefts", head: "Theft", title: "Thefts attempted", bad: true },
  { key: "caught", head: "Caught", title: "Times caught stealing", bad: true },
  { key: "pactsBroken", head: "Broke", title: "Pacts broken", bad: true },
];

export function Roster({ finalScores }: { finalScores: Record<string, number> | null }) {
  const { agents, label, shownCompany } = useRun();
  const events = useEventStore((s) => s.events);
  const selected = useEventStore((s) => s.selectedAgentId);
  const select = useEventStore((s) => s.select);
  const stats = useMemo(() => computeAgentStats(events), [events]);

  const onKeyDown = (ev: KeyboardEvent<HTMLTableSectionElement>) => {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    const btns = [...ev.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-agent]")];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    ev.preventDefault();
    btns[Math.max(0, Math.min(btns.length - 1, i + (ev.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };

  if (agents.length === 0) {
    return (
      <section aria-labelledby="roster-title" className="rounded-lg border bg-surface p-3">
        <h2 id="roster-title" className="text-[13px] font-semibold tracking-[-0.01em]">Merchants</h2>
        <p className="mt-2 text-sm text-muted-foreground">Roster appears once the run publishes its agents.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="roster-title" className="min-w-0 overflow-hidden rounded-lg border bg-surface shadow-raised">
      <div className="flex items-baseline justify-between border-b px-3 py-2">
        <h2 id="roster-title" className="text-[13px] font-semibold tracking-[-0.01em]">Merchants</h2>
        <span className="font-mono text-[11px] text-subtle-foreground">{agents.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] border-collapse text-sm">
          <caption className="sr-only">Per-merchant counts from the event log. Select a merchant to inspect it.</caption>
          <thead>
            <tr className="text-left font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">
              <th scope="col" className="px-3 py-1.5 font-normal">Merchant</th>
              {COLS.map((c) => (
                <th key={c.key} scope="col" title={c.title} className="px-2 py-1.5 text-right font-normal">
                  {c.head}
                </th>
              ))}
              <th scope="col" title="Final coins (set when the run ends)" className="px-3 py-1.5 text-right font-normal">
                Score
              </th>
            </tr>
          </thead>
          <tbody onKeyDown={onKeyDown}>
            {agents.map((a) => {
              const on = selected === a.id;
              const co = shownCompany(a.id);
              const s = stats.get(a.id) ?? emptyStats();
              return (
                <tr key={a.id} className={`border-t border-border/60 transition-colors ${on ? "bg-primary/[0.08]" : "hover:bg-surface-raised"}`}>
                  <th scope="row" className="px-1 py-0.5 text-left font-normal">
                    <button
                      type="button"
                      data-agent
                      aria-pressed={on}
                      onClick={() => select(on ? null : a.id)}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <span className={`size-2 shrink-0 rounded-[2px] ${co ? COMPANY_BG[co] ?? "bg-muted-foreground/40" : "bg-muted-foreground/30"}`} aria-hidden="true" />
                      <span className="truncate">{label(a.id)}</span>
                    </button>
                  </th>
                  {COLS.map((c) => (
                    <td key={c.key} className={`px-2 text-right font-mono text-[12.5px] ${c.bad && s[c.key] > 0 ? "text-violation" : "text-muted-foreground"}`}>
                      {s[c.key]}
                    </td>
                  ))}
                  <td className="px-3 text-right font-mono text-[12.5px] text-foreground">{finalScores?.[a.id] ?? "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
