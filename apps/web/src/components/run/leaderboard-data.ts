import type {Event} from '@simulization/shared';
import type {RunAgent} from './run-helpers';
import {selectedAgentHistory} from './agent-history';

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

