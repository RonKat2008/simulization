"use client";
import { useMemo, useState } from "react";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { buildLeaderboardRows, type LeaderboardSort } from "./leaderboard-data";
import { COMPANY_BG } from "./run-helpers";
import { useStartingValues } from "./use-starting-values";

export function Roster({ finalScores }: { finalScores: Record<string, number> | null }) {
  const { agents, label, shownCompany } = useRun();
  const events = useEventStore(s => s.events);
  const seq = useEventStore(s => s.playbackSeq);
  const selected = useEventStore(s => s.selectedAgentId);
  const select = useEventStore(s => s.select);
  const [sortBy, setSortBy] = useState<LeaderboardSort>('coins');
  const initial = useStartingValues(events[0]?.runId ?? null);
  const rows = useMemo(() => buildLeaderboardRows(agents, events, seq, finalScores, initial.values, sortBy), [agents, events, seq, finalScores, initial.values, sortBy]);

  return <section aria-label="Leaderboard" className="min-w-0">
    <div className="space-y-2 border-b px-3 py-2 text-xs text-muted-foreground">
      <p>{seq === null ? "Full loaded run · all rounds" : "Through the current replay position"}</p>
      <label className="flex items-center justify-between gap-2">Sort by
        <select aria-label="Sort leaderboard" value={sortBy} onChange={e => setSortBy(e.target.value as LeaderboardSort)} className="min-h-9 min-w-0 max-w-[80%] rounded border bg-background px-2 text-foreground focus-visible:outline-2 focus-visible:outline-primary">
          <option value="coins">Coins · highest first</option><option value="luck">Starting luck · lowest first</option><option value="violations">Violations · most first</option>
        </select>
      </label>
    </div>
    {rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No agents recorded yet.</p> :
      <div className="max-h-[65dvh] overflow-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">Coins, initial goods value and distinct recorded violations. Select an agent to inspect their recorded activity. Missing values are not zero.</caption>
          <colgroup><col className="w-[37%]"/><col className="w-[17%]"/><col className="w-[23%]"/><col className="w-[23%]"/></colgroup>
          <thead><tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-3 font-normal">Agent</th>
            <th scope="col" aria-sort={sortBy === 'coins' ? 'descending' : undefined} className="px-1 font-normal text-right" title="Current coin balance; separate from game score">Coins</th>
            <th scope="col" aria-sort={sortBy === 'luck' ? 'ascending' : undefined} className="px-2 font-normal text-right" title="Total true value of initially assigned goods. Higher means a more valuable starting inventory, excluding coins.">Starting luck</th>
            <th scope="col" aria-sort={sortBy === 'violations' ? 'descending' : undefined} className="px-3 font-normal text-right" title="Distinct false-claim and theft actions. Breaking a pact in the same action is counted once.">Violations</th>
          </tr></thead>
          <tbody>{rows.map(({ agent, history, rank, startingValue, violations }) => {
            const on = selected === agent.id, company = shownCompany(agent.id);
            const toggle = () => select(on ? null : agent.id);
            const breakdown = violations ? `${violations.count} distinct violating actions: ${violations.falseClaims} false claims, ${violations.thefts} thefts. ${violations.pactBreakingActions} of these also broke a pact; not counted again.` : 'Violation count unavailable: incomplete event evidence.';
            return <tr key={agent.id} onClick={toggle} className={`cursor-pointer border-t border-border/60 hover:bg-surface-raised ${on ? "bg-primary/10" : ""}`}>
              <th scope="row" className="px-2 py-1 text-left font-normal">
                <button data-agent data-agent-id={agent.id} type="button" aria-pressed={on}
                  aria-label={`${on ? "Deselect" : "Select"} ${label(agent.id)}${company ? `, company ${company}` : ""}${rank !== null ? `, wealth rank ${rank}` : ""}`}
                  onClick={event => { event.stopPropagation(); toggle(); }}
                  className="flex min-h-10 w-full items-center gap-1.5 rounded-sm px-1 text-left focus-visible:outline-2 focus-visible:outline-primary">
                  {sortBy === 'coins' && <span aria-hidden="true" className="w-3 shrink-0 text-xs text-muted-foreground tabular-nums">{rank ?? "—"}</span>}
                  <span aria-hidden="true" className={`size-2 shrink-0 rounded-[2px] ${company ? COMPANY_BG[company] ?? "bg-muted-foreground" : "bg-muted-foreground"}`}/>
                  <span className="min-w-0 break-words">{label(agent.id)}</span>
                </button>
              </th>
              <td className="px-1 text-right font-medium tabular-nums">
                {history.coins ?? <span title={history.reason ?? "Coin balance unavailable"}><span aria-hidden="true">—</span><span className="sr-only">Coin balance unavailable</span></span>}
              </td>
              <td className="px-2 text-right tabular-nums">
                {startingValue ?? <span className="text-[11px] leading-tight text-muted-foreground">{initial.loading ? 'Loading…' : initial.failed ? 'Unavailable' : 'Not recorded'}</span>}
              </td>
              <td className={`px-3 text-right tabular-nums ${violations?.count ? 'text-violation' : 'text-muted-foreground'}`}>
                <span title={breakdown} aria-label={breakdown}>{violations?.count ?? 'Unavailable'}</span>
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    <details className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <summary className="min-h-8 cursor-pointer py-1 focus-visible:outline-2 focus-visible:outline-primary">What these numbers mean</summary>
      <p className="mt-1">Coins are current money, not game score. Starting luck is the total true value of goods assigned before play. Higher means a more valuable start; coins are excluded. This is observer-only information.</p>
      <p className="mt-2">Violations count false quality claims and executed thefts, caught or not. A pact broken by the same action is not counted again. Selecting an agent shows the underlying activity.</p>
      <p className="mt-2">Counts are not rates: agents that act more have more opportunities. Zero recorded violations does not establish trustworthiness. Comparing these columns cannot show that starting luck caused behavior. Missing evidence is shown as unavailable, never zero.</p>
    </details>
  </section>;
}
