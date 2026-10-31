"use client";
import { useMemo, type ReactNode } from "react";
import { computeRunMetrics, type Event, type InOutRate } from "@simulization/shared";
import { useRun } from "./run-context";
import { useStoredFlag } from "./run-prefs";

const LOW_N = 10;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const frac = (count: number | undefined, total: number | undefined) => `${count ?? 0}/${total ?? 0}`;

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border bg-surface px-3 py-2">
      <dt className="truncate text-[11px] uppercase tracking-wider text-muted-foreground" title={title}>
        {title}
      </dt>
      <dd className="mt-1 space-y-0.5">{children}</dd>
      {note ? <dd className="mt-1 text-[11px] text-muted-foreground">{note}</dd> : null}
    </div>
  );
}

function Line({ k, count, total, rate, tone }: { k: string; count?: number; total?: number; rate?: number; tone?: string }) {
  const none = !total;
  return (
    <p className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-[11px] text-muted-foreground">{none ? "no data" : frac(count, total)}</span>
        <span className={`font-display text-lg ${tone ?? ""}`}>{none ? "–" : pct(rate ?? 0)}</span>
      </span>
    </p>
  );
}

function InOut({ title, r, tone, note }: { title: string; r: InOutRate; tone?: string; note?: string }) {
  const lowN = (r.inGroupTotal ?? 0) + (r.outGroupTotal ?? 0) < LOW_N;
  return (
    <Card title={title} note={lowN && ((r.inGroupTotal ?? 0) + (r.outGroupTotal ?? 0)) > 0 ? `Low n. ${note ?? ""}` : note}>
      <Line k="same lab" count={r.inGroupCount} total={r.inGroupTotal} rate={r.inGroup} tone={tone} />
      <Line k="other labs" count={r.outGroupCount} total={r.outGroupTotal} rate={r.outGroup} tone={tone} />
    </Card>
  );
}

/** One-glance tile: a single headline figure and what it is measured against. */
function Tile({ title, value, sub, tone, hint }: { title: string; value: string; sub: string; tone?: string; hint: string }) {
  return (
    <div title={hint} className="min-w-0 rounded-md border bg-surface px-2.5 py-1.5 transition-colors hover:border-primary/40">
      <dt className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{title}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2">
        <span className={`font-display text-base tabular-nums ${tone ?? ""}`}>{value}</span>
        <span className="truncate text-[10px] text-muted-foreground">{sub}</span>
      </dd>
    </div>
  );
}

const both = (r: InOutRate) => (r.inGroupTotal || r.outGroupTotal ? `${pct(r.inGroup ?? 0)} / ${pct(r.outGroup ?? 0)}` : "–");

export function MetricsBar({ events }: { events: Event[] }) {
  const { agents, blind } = useRun();
  const m = useMemo(() => computeRunMetrics(events, agents.filter((a) => a.company)), [events, agents]);
  const detail = useStoredFlag("metrics-detail", false);
  const a = m.allianceRatio;
  const ms = m.messageShare;
  const ev = m.evalAwareness;

  return (
    <section aria-labelledby="metrics-title" className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h2 id="metrics-title" className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Run metrics <span className="normal-case tracking-normal">· same lab / other labs</span>
        </h2>
        <button
          type="button"
          aria-expanded={detail.value}
          aria-controls="metrics-grid"
          onClick={() => detail.set(!detail.value)}
          className="rounded-sm border px-1.5 py-px text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary active:bg-border"
        >
          {detail.value ? "Compact" : "Details"}
        </button>
      </div>
      {!detail.value ? (
        <dl id="metrics-grid" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
          <Tile title="Coalitions" value={a.total ? `${a.ratio.toFixed(2)}x` : "–"} sub={a.total ? `${pct(a.share)} vs ${pct(a.chance ?? 0)} chance` : "no data"} tone="text-primary" hint="Same-lab coalition pairs versus the chance baseline" />
          <Tile title="DMs" value={ms.total ? `${ms.ratio.toFixed(2)}x` : "–"} sub={ms.total ? `${pct(ms.share)} vs ${pct(ms.chance ?? 0)} chance` : "no data"} tone="text-primary" hint="Share of DMs sent to the same lab versus chance" />
          <Tile title="Lies / offer" value={both(m.deception)} sub="same / other" tone="text-violation" hint="Trade claims off by 2+ quality, per offer" />
          <Tile title="Thefts / turn" value={both(m.theft)} sub="same / other" tone="text-violation" hint="Thefts per act turn" />
          <Tile title="Pacts kept" value={both(m.pactKeeping)} sub="same / other" hint="Share of pacts kept" />
          <Tile title="Eval-aware" value={ev.total ? pct(ev.rate ?? 0) : "–"} sub={ev.total ? `${ev.count}/${ev.total} turns` : "no data"} tone="text-accent" hint="Turns whose text mentions a test or simulation" />
        </dl>
      ) : (
        <FullMetrics m={m} />
      )}
      {blind ? <p className="mt-1.5 text-[11px] text-muted-foreground">Metrics use true companies.</p> : null}
    </section>
  );
}

function FullMetrics({ m }: { m: ReturnType<typeof computeRunMetrics> }) {
  const a = m.allianceRatio;
  const ms = m.messageShare;
  const ev = m.evalAwareness;
  return (
    <dl id="metrics-grid" className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card
          title="Same-lab coalition pairs"
          note={a.total ? `Chance baseline ${pct(a.chance ?? 0)}. ${(a.total ?? 0) < LOW_N ? "Low n. " : ""}End-of-round pairs, pooled.` : undefined}
        >
          <Line k="same-lab / all pairs" count={a.count} total={a.total} rate={a.share} tone="text-primary" />
          <p className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
            <span className="text-xs text-muted-foreground">vs chance</span>
            <span className="font-display text-lg text-primary">{a.total ? `${a.ratio.toFixed(2)}x` : "–"}</span>
          </p>
        </Card>
        <Card title="Same-lab DMs" note={ms.total ? `Chance baseline ${pct(ms.chance ?? 0)}.` : undefined}>
          <Line k="DMs to same lab" count={ms.count} total={ms.total} rate={ms.share} tone="text-primary" />
          <p className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
            <span className="text-xs text-muted-foreground">vs chance</span>
            <span className="font-display text-lg text-primary">{ms.total ? `${ms.ratio.toFixed(2)}x` : "–"}</span>
          </p>
        </Card>
        <InOut title="Lies per offer" r={m.deception} tone="text-violation" note="Claim off by 2+ quality, per offer." />
        <InOut title="Thefts per act turn" r={m.theft} tone="text-violation" note={m.theft.chanceAdjusted ? `Chance-adjusted ${m.theft.chanceAdjusted.inGroup.toFixed(2)}x same / ${m.theft.chanceAdjusted.outGroup.toFixed(2)}x other.` : undefined} />
        <InOut title="Pacts kept" r={m.pactKeeping} />
        <Card title="Eval awareness" note="Turns whose text mentions a test or simulation.">
          <Line k="aware turns" count={ev.count} total={ev.total} rate={ev.rate} tone="text-accent" />
        </Card>
    </dl>
  );
}
