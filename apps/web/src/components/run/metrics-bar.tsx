"use client";
import { useMemo } from "react";
import { computeRunMetrics, type Event } from "@simulization/shared";
import { useRun } from "./run-context";

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Stat({ title, value, sub, tone }: { title: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-surface px-3 py-2">
      <dt className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">{title}</dt>
      <dd className={`font-display text-xl tabular-nums ${tone ?? ""}`}>{value}</dd>
      <dd className="truncate text-[11px] text-muted-foreground">{sub}</dd>
    </div>
  );
}

export function MetricsBar({ events }: { events: Event[] }) {
  const { agents } = useRun();
  const m = useMemo(
    () => computeRunMetrics(events, agents.filter((a) => a.company)),
    [events, agents],
  );
  const noData = (total?: number) => total === 0;

  return (
    <section aria-label="Live metrics">
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          title="In-group alliance"
          value={noData(m.allianceRatio.total) ? "–" : `${m.allianceRatio.ratio.toFixed(2)}x`}
          sub={`${pct(m.allianceRatio.share)} same-lab vs ${pct(m.allianceRatio.chance ?? 0)} chance`}
          tone="text-primary"
        />
        <Stat
          title="Deception in / out"
          value={noData(m.deception.inGroupTotal) && noData(m.deception.outGroupTotal) ? "–" : `${pct(m.deception.inGroup)} / ${pct(m.deception.outGroup)}`}
          sub={`${m.deception.inGroupCount ?? 0}/${m.deception.inGroupTotal ?? 0} in, ${m.deception.outGroupCount ?? 0}/${m.deception.outGroupTotal ?? 0} out`}
          tone="text-lab-b"
        />
        <Stat
          title="Theft in / out"
          value={noData(m.theft.inGroupTotal) && noData(m.theft.outGroupTotal) ? "–" : `${pct(m.theft.inGroup)} / ${pct(m.theft.outGroup)}`}
          sub={`${m.theft.inGroupCount ?? 0} in, ${m.theft.outGroupCount ?? 0} out`}
          tone="text-violation"
        />
        <Stat
          title="Pact keeping in / out"
          value={noData(m.pactKeeping.inGroupTotal) && noData(m.pactKeeping.outGroupTotal) ? "–" : `${pct(m.pactKeeping.inGroup)} / ${pct(m.pactKeeping.outGroup)}`}
          sub={`${m.pactKeeping.inGroupCount ?? 0}/${m.pactKeeping.inGroupTotal ?? 0} in, ${m.pactKeeping.outGroupCount ?? 0}/${m.pactKeeping.outGroupTotal ?? 0} out`}
          tone="text-lab-c"
        />
      </dl>
    </section>
  );
}
