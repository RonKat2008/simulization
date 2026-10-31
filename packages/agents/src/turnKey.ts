// Owner: Person B. Ordering key for turns (round:phase) so a late save for an older phase never overwrites a newer one.
import { PHASES, type AgentTurnInput } from "@simulization/shared";

/** "round:phase", e.g. "3:trade". */
export function turnKey(input: Pick<AgentTurnInput, "round" | "phase">): string {
  return `${input.round}:${input.phase}`;
}

function turnOrder(key: string): number {
  const [round, phase] = key.split(":");
  return Number(round) * PHASES.length + PHASES.indexOf(phase as (typeof PHASES)[number]);
}

/** True when `candidate` is strictly older than `current` (unknown/empty current is never newer). */
export function isOlderTurnKey(candidate: string, current: string | null | undefined): boolean {
  if (!current) return false;
  return turnOrder(candidate) < turnOrder(current);
}
