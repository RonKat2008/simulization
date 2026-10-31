"use client";
// Compact "who's doing well" list for the Game tab. Follows playback: estimated coins while the night plays,
// final score (coins + true value of goods) once it is over. BLIND shows no company color.
import { useMemo, useState } from "react";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { COMPANY_BG } from "./run-helpers";
import { standingsAt, type Standing } from "./standings";

const TOP = 5;

type Props = {
  upto: number;
  /** Final scores, used once playback has reached the end. */
  finalScores: Record<string, number> | null;
  ended: boolean;
};

function Chips({ s }: { s: Standing }) {
  const chips = [
    s.lies ? `lied ×${s.lies}` : null,
    s.thefts ? `stole ×${s.thefts}` : null,
    s.brokenPacts ? `broke promise ×${s.brokenPacts}` : null,
  ].filter((c): c is string => !!c);
  if (!chips.length) return null;
  return (
    <span className="flex shrink-0 gap-1">
      {chips.map((c) => (
        <span key={c} className="rounded-sm bg-violation/15 px-1 text-[10.5px] font-medium leading-4 text-violation">
          {c}
        </span>
      ))}
    </span>
  );
}

export function Leaderboard({ upto, finalScores, ended }: Props) {
  const { agents, label, shownCompany } = useRun();
  const events = useEventStore((s) => s.events);
  const selected = useEventStore((s) => s.selectedAgentId);
  const select = useEventStore((s) => s.select);
  const [all, setAll] = useState(false);

  const final = ended && finalScores ? finalScores : null;
  const rows = useMemo(() => {
    const st = standingsAt(events, agents.map((a) => a.id), upto);
    return agents
      .map((a) => {
        const s = st.get(a.id)!;
        return { id: a.id, s, value: final?.[a.id] ?? s.coins, name: label(a.id) };
      })
      // Ties break on the display name, never roster order (which would group companies in BLIND).
      .sort((x, y) => y.value - x.value || x.name.localeCompare(y.name));
  }, [events, agents, upto, final, label]);

  if (!rows.length) return null;
  const list = all ? rows : rows.slice(0, TOP);
  const unit = final ? "points" : "coins";

  return (
    <section aria-labelledby="board-title" className="flex min-w-0 shrink-0 flex-col overflow-hidden rounded-lg border bg-surface shadow-raised">
      <div className="flex items-baseline justify-between gap-2 border-b px-3 py-2.5">
        <h2 id="board-title" className="text-[13px] font-semibold tracking-[-0.01em]">
          Leaderboard
        </h2>
        <span className="text-[11px] text-subtle-foreground" title={final ? "Final score: coins plus the true value of goods held" : "Estimated from trades, work and thefts so far; team payouts are added at the end"}>
          {final ? "final score" : "coins so far (approx.)"}
        </span>
      </div>
      <ol className="max-h-[45vh] overflow-y-auto overscroll-contain">
        {list.map((r, i) => {
          const co = shownCompany(r.id);
          const on = selected === r.id;
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => select(on ? null : r.id)}
                className={`flex w-full min-w-0 items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary ${
                  on ? "bg-primary/10" : "hover:bg-surface-raised/60"
                }`}
              >
                <span className="w-4 shrink-0 text-right font-mono text-[11px] text-subtle-foreground">{i + 1}</span>
                {co ? <span className={`size-2 shrink-0 rounded-[2px] ${COMPANY_BG[co] ?? "bg-muted-foreground/40"}`} aria-hidden="true" /> : null}
                <span className="min-w-0 truncate text-foreground">{r.name}</span>
                <Chips s={r.s} />
                <span className="ml-auto shrink-0 font-mono text-[12.5px] tabular-nums text-foreground">
                  {r.value}
                  <span className="sr-only"> {unit}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {rows.length > TOP ? (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((v) => !v)}
          className="w-full border-t px-3 py-2 text-left text-xs text-primary transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary"
        >
          {all ? "Show top 5" : `Show all ${rows.length}`}
        </button>
      ) : null}
    </section>
  );
}
