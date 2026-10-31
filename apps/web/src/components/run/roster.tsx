"use client";
import { useMemo } from "react";
import type { Event } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { selectedAgentHistory } from "./agent-history";
import { COMPANY_BG, type RunAgent } from "./run-helpers";

/** Rankings share the inspector's verified projection; the full log never overrides its cursor. */
export function buildLeaderboardRows(
  agents: readonly RunAgent[], events: readonly Event[], throughSeq: number | null,
  finalScores: Record<string, number> | null,
) {
  const rows = agents.map(agent => ({ agent, history: selectedAgentHistory(events, agent.id, throughSeq, finalScores) }))
    .sort((a, b) => {
      if (a.history.coins === null && b.history.coins !== null) return 1;
      if (b.history.coins === null && a.history.coins !== null) return -1;
      return (b.history.coins ?? 0) - (a.history.coins ?? 0)
        || a.agent.name.localeCompare(b.agent.name) || a.agent.id.localeCompare(b.agent.id);
    });
  let rank: number | null = null;
  return rows.map((row, index) => {
    if (row.history.coins === null) rank = null;
    else if (index === 0 || row.history.coins !== rows[index - 1]!.history.coins) rank = index + 1;
    return { ...row, rank };
  });
}

export function Roster({ finalScores }: { finalScores: Record<string, number> | null }) {
  const { agents, label, shownCompany } = useRun();
  const events = useEventStore(s => s.events);
  const seq = useEventStore(s => s.playbackSeq);
  const selected = useEventStore(s => s.selectedAgentId);
  const select = useEventStore(s => s.select);
  const rows = useMemo(() => buildLeaderboardRows(agents, events, seq, finalScores), [agents, events, seq, finalScores]);

  return <section aria-label="Leaderboard" className="min-w-0">
    <p className="border-b px-3 py-2 text-xs text-muted-foreground">
      {seq === null ? "Full loaded run · all rounds" : "Through the current replay position"}
    </p>
    {rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No agents recorded yet.</p> :
      <div className="max-h-[65dvh] overflow-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">Ranked by current coins, highest first. Equal balances share a rank. Select an agent to inspect their recorded activity.</caption>
          <colgroup><col className="w-[38%]"/><col className="w-[16%]"/><col className="w-[24%]"/><col className="w-[22%]"/></colgroup>
          <thead><tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-3 font-normal">Agent</th>
            <th scope="col" className="px-1 font-normal text-right" title="Current coin balance; separate from game score">Wealth<span className="block font-normal">(coins)</span></th>
            <th scope="col" className="px-2 font-normal text-right" title="Engine-flagged false quality claims / all recorded offers">False claims</th>
            <th scope="col" className="px-3 font-normal text-right" title="Recorded executed theft actions, caught or not. Rejected or unrecorded attempts are unavailable.">Theft attempts</th>
          </tr></thead>
          <tbody>{rows.map(({ agent, history, rank }) => {
            const on = selected === agent.id, company = shownCompany(agent.id);
            const toggle = () => select(on ? null : agent.id);
            return <tr key={agent.id} onClick={toggle} className={`cursor-pointer border-t border-border/60 hover:bg-surface-raised ${on ? "bg-primary/10" : ""}`}>
              <th scope="row" className="px-2 py-1 text-left font-normal">
                <button data-agent data-agent-id={agent.id} type="button" aria-pressed={on}
                  aria-label={`${on ? "Deselect" : "Select"} ${label(agent.id)}${company ? `, company ${company}` : ""}${rank !== null ? `, wealth rank ${rank}` : ""}`}
                  onClick={event => { event.stopPropagation(); toggle(); }}
                  className="flex min-h-10 w-full items-center gap-1.5 rounded-sm px-1 text-left focus-visible:outline-2 focus-visible:outline-primary">
                  <span aria-hidden="true" className="w-3 shrink-0 text-xs text-muted-foreground tabular-nums">{rank ?? "—"}</span>
                  <span aria-hidden="true" className={`size-2 shrink-0 rounded-[2px] ${company ? COMPANY_BG[company] ?? "bg-muted-foreground" : "bg-muted-foreground"}`}/>
                  <span className="min-w-0 break-words">{label(agent.id)}</span>
                </button>
              </th>
              <td className="px-1 text-right font-medium tabular-nums">
                {history.coins ?? <span title={history.reason ?? "Coin balance unavailable"}><span aria-hidden="true">—</span><span className="sr-only">Coin balance unavailable</span></span>}
              </td>
              <td className={`px-2 text-right tabular-nums ${history.falseClaims ? "text-violation" : "text-muted-foreground"}`}>
                {history.claims ? <span aria-label={`${history.falseClaims} false claims out of ${history.claims} claims`}>{history.falseClaims}/{history.claims}</span> : <span className="text-[11px] leading-tight">No claims yet</span>}
              </td>
              <td className="px-3 text-right tabular-nums">{history.thefts}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    <p className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      Ranked by coins; game score also includes goods and is shown at the end. Ties share a rank. False claims: flagged / total. Theft counts include recorded actions only. “—” means wealth is unavailable.
    </p>
  </section>;
}
