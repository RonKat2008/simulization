"use client";
import { useMemo, useState, type KeyboardEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHANCE, type Event } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "@/components/run/run-context";
import { COMPANY_VAR, INTERACTION_TYPES, PANEL, companyMap, pct, relationOf } from "./view-utils";

type EdgeType = "message" | "trade" | "pact" | "coalition" | "theft" | "lie";

interface EdgeStyle {
  label: string;
  stroke: string;
  dash?: string;
  offset: number;
}

const EDGE_STYLE: Record<EdgeType, EdgeStyle> = {
  message: { label: "Messages (DM)", stroke: "var(--muted-foreground)", offset: -12, dash: undefined },
  trade: { label: "Accepted trades", stroke: "var(--primary)", offset: -6 },
  pact: { label: "Pacts", stroke: "var(--lab-c)", offset: 0 },
  coalition: { label: "Coalition ties", stroke: "var(--foreground)", offset: 6, dash: "10 3 2 3" },
  theft: { label: "Thefts", stroke: "var(--violation)", offset: 12, dash: "1.5 4" },
  lie: { label: "Lie-flagged offers", stroke: "var(--accent)", offset: 18, dash: "7 5" },
};
const EDGE_TYPES = Object.keys(EDGE_STYLE) as EdgeType[];
const DEFAULT_ON: Record<EdgeType, boolean> = {
  message: true,
  trade: true,
  pact: true,
  coalition: false,
  theft: true,
  lie: true,
};

interface Edge {
  type: EdgeType;
  a: string;
  b: string;
  count: number;
}

function buildEdges(events: Event[], ids: Set<string>): Edge[] {
  const map = new Map<string, Edge>();
  const bump = (type: EdgeType, x: string, y: string) => {
    if (x === y || !ids.has(x) || !ids.has(y)) return;
    const [a, b] = x < y ? [x, y] : [y, x];
    const key = `${type}|${a}|${b}`;
    const hit = map.get(key);
    if (hit) hit.count += 1;
    else map.set(key, { type, a, b, count: 1 });
  };
  const members = new Map<string, Set<string>>();
  const leave = (id: string) => members.forEach((s) => s.delete(id));
  for (const e of [...events].sort((p, q) => p.seq - q.seq)) {
    const t = e.targetId;
    if (e.type === "message" && t && e.channel === "dm") bump("message", e.actorId, t);
    else if (e.type === "message" && t && e.channel !== "public" && !e.channel?.startsWith("coalition")) bump("message", e.actorId, t);
    else if (e.type === "trade_accept" && t) bump("trade", e.actorId, t);
    else if (e.type === "pact_accept" && t) bump("pact", e.actorId, t);
    else if (e.type === "steal" && t) bump("theft", e.actorId, t);
    else if (e.type === "trade_offer" && t && e.flags.includes("lie")) bump("lie", e.actorId, t);
    else if ((e.type === "coalition_create" || e.type === "coalition_join") && e.channel) {
      leave(e.actorId);
      const set = members.get(e.channel) ?? new Set<string>();
      for (const o of set) bump("coalition", e.actorId, o);
      set.add(e.actorId);
      members.set(e.channel, set);
    } else if (e.type === "coalition_leave") leave(e.actorId);
  }
  return [...map.values()];
}

const SIZE = 580;
const HALF = SIZE / 2;
const RING = 215;
const NODE_R = 13;

function layout(order: string[]): Map<string, { x: number; y: number; angle: number }> {
  const n = Math.max(order.length, 1);
  return new Map(
    order.map((id, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      return [id, { x: Math.cos(angle) * RING, y: Math.sin(angle) * RING, angle }];
    }),
  );
}

const widthFor = (count: number) => 0.8 + Math.sqrt(count) * 1.3;

function Network({ events }: { events: Event[] }) {
  const { agents, blind, label, shownCompany } = useRun();
  const selected = useEventStore((s) => s.selectedAgentId);
  const [on, setOn] = useState<Record<EdgeType, boolean>>(DEFAULT_ON);

  const order = useMemo(() => {
    const ids = agents.map((a) => a.id);
    if (blind) return ids; // BLIND: roster/id order only, never grouped by company
    return [...agents]
      .sort((p, q) => p.company.localeCompare(q.company) || p.id.localeCompare(q.id))
      .map((a) => a.id);
  }, [agents, blind]);
  const pos = useMemo(() => layout(order), [order]);
  const edges = useMemo(() => buildEdges(events, new Set(order)), [events, order]);
  const visible = edges.filter((e) => on[e.type]);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of visible) {
      d.set(e.a, (d.get(e.a) ?? 0) + e.count);
      d.set(e.b, (d.get(e.b) ?? 0) + e.count);
    }
    return d;
  }, [visible]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(EDGE_TYPES.map((t) => [t, 0])) as Record<EdgeType, number>;
    for (const e of edges) c[e.type] += e.count;
    return c;
  }, [edges]);

  const pick = (id: string) => useEventStore.getState().select(selected === id ? null : id);
  const onKey = (id: string) => (ev: KeyboardEvent) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      pick(id);
    }
  };
  const topEdges = [...visible].sort((p, q) => q.count - p.count).slice(0, 12);

  return (
    <section aria-labelledby="net-h" className={PANEL}>
      <h2 id="net-h" className="text-sm font-medium">Interaction network</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {blind
          ? "BLIND: nodes are neutral and ordered by roster; company is hidden."
          : "Nodes grouped by company around the ring (color and letter). "}
        Edge thickness is the number of events. Line style, not only color, marks edge type.
      </p>

      <div role="group" aria-label="Edge types" className="mt-3 flex flex-wrap gap-2">
        {EDGE_TYPES.map((t) => {
          const s = EDGE_STYLE[t];
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on[t]}
              onClick={() => setOn((p) => ({ ...p, [t]: !p[t] }))}
              className={`flex min-h-8 items-center gap-2 rounded-sm border px-2 py-1 text-xs focus-visible:outline-2 ${
                on[t] ? "border-primary/60 bg-surface-raised" : "opacity-60"
              }`}
            >
              <svg width="26" height="8" aria-hidden="true">
                <line x1="1" y1="4" x2="25" y2="4" stroke={s.stroke} strokeWidth="2.5" strokeDasharray={s.dash} strokeLinecap="round" />
              </svg>
              <span>{s.label}</span>
              <span className="tabular-nums text-muted-foreground">{counts[t]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`${-HALF} ${-HALF} ${SIZE} ${SIZE}`}
          role="group"
          aria-label="Agent interaction network. Each agent is a focusable button; the edge table below lists the strongest links."
          className="mx-auto block aspect-square w-full min-w-[340px] max-w-[640px]"
        >
          {visible.map((e) => {
            const p = pos.get(e.a);
            const q = pos.get(e.b);
            if (!p || !q) return null;
            const st = EDGE_STYLE[e.type];
            const mx = (p.x + q.x) / 2;
            const my = (p.y + q.y) / 2;
            const dx = q.x - p.x;
            const dy = q.y - p.y;
            const len = Math.hypot(dx, dy) || 1;
            const cx = mx + (-dy / len) * st.offset - mx * 0.25;
            const cy = my + (dx / len) * st.offset - my * 0.25;
            const dim = selected && e.a !== selected && e.b !== selected;
            return (
              <path
                key={`${e.type}|${e.a}|${e.b}`}
                d={`M${p.x},${p.y} Q${cx},${cy} ${q.x},${q.y}`}
                fill="none"
                stroke={st.stroke}
                strokeWidth={widthFor(e.count)}
                strokeDasharray={st.dash}
                strokeLinecap={st.dash ? "round" : "butt"}
                opacity={dim ? 0.08 : 0.75}
              >
                <title>{`${st.label}: ${label(e.a)} - ${label(e.b)} x${e.count}`}</title>
              </path>
            );
          })}
          {order.map((id) => {
            const p = pos.get(id)!;
            const company = shownCompany(id);
            const isSel = selected === id;
            const lx = Math.cos(p.angle) * (RING + NODE_R + 6);
            const ly = Math.sin(p.angle) * (RING + NODE_R + 6);
            const anchor = Math.cos(p.angle) > 0.2 ? "start" : Math.cos(p.angle) < -0.2 ? "end" : "middle";
            return (
              <g
                key={id}
                tabIndex={0}
                role="button"
                aria-pressed={isSel}
                aria-label={`${label(id)}${company ? `, company ${company}` : ""}, ${degree.get(id) ?? 0} visible interactions`}
                onClick={() => pick(id)}
                onKeyDown={onKey(id)}
                className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[var(--foreground)] [&:focus-visible>circle:first-child]:stroke-[3]"
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={NODE_R}
                  fill={company ? COMPANY_VAR[company] ?? "var(--muted-foreground)" : "var(--surface-raised)"}
                  stroke={isSel ? "var(--foreground)" : "var(--muted-foreground)"}
                  strokeWidth={isSel ? 3 : 1}
                />
                {company ? (
                  <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill="var(--primary-foreground)">
                    {company}
                  </text>
                ) : null}
                <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="central" fontSize="12" fill="var(--foreground)">
                  {label(id)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Strongest visible edges ({topEdges.length} of {visible.length})</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[320px] text-left tabular-nums">
            <caption className="sr-only">Strongest visible network edges by event count</caption>
            <thead className="text-muted-foreground">
              <tr><th scope="col" className="pr-3">Type</th><th scope="col" className="pr-3">Pair</th><th scope="col" className="text-right">Count</th></tr>
            </thead>
            <tbody>
              {topEdges.map((e) => (
                <tr key={`${e.type}|${e.a}|${e.b}`} className="border-t border-border/60">
                  <td className="pr-3">{EDGE_STYLE[e.type].label}</td>
                  <td className="pr-3">{label(e.a)} - {label(e.b)}</td>
                  <td className="text-right">{e.count}</td>
                </tr>
              ))}
              {topEdges.length === 0 ? <tr><td colSpan={3} className="py-2 text-muted-foreground">No edges for the selected types yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

interface RoundRow {
  name: string;
  round: number;
  messages: number;
  trades: number;
  lies: number;
  thefts: number;
  pactsBroken: number;
  inCount: number;
  outCount: number;
  inShare: number;
  outShare: number;
}

function buildRows(events: Event[], companies: Map<string, string>): RoundRow[] {
  if (events.length === 0) return [];
  const rounds = events.map((e) => e.round);
  const lo = Math.min(...rounds);
  const hi = Math.max(...rounds);
  const rows: RoundRow[] = [];
  for (let r = lo; r <= hi; r++) {
    const ev = events.filter((e) => e.round === r);
    let inCount = 0;
    let outCount = 0;
    for (const e of ev) {
      if (!INTERACTION_TYPES.has(e.type)) continue;
      const rel = relationOf(e, companies);
      if (rel === "in") inCount++;
      else if (rel === "out") outCount++;
    }
    const total = inCount + outCount;
    rows.push({
      name: `R${r}`,
      round: r,
      messages: ev.filter((e) => e.type === "message").length,
      trades: ev.filter((e) => e.type === "trade_accept").length,
      lies: ev.filter((e) => e.flags.includes("lie")).length,
      thefts: ev.filter((e) => e.type === "steal").length,
      pactsBroken: ev.filter((e) => e.type === "pact_break" || e.flags.includes("broken_pact")).length,
      inCount,
      outCount,
      inShare: total ? inCount / total : 0,
      outShare: total ? outCount / total : 0,
    });
  }
  return rows;
}

const TICK = { fill: "var(--muted-foreground)", fontSize: 11 };
const TIP = {
  contentStyle: { background: "var(--surface-raised)", border: "1px solid var(--border)", fontSize: 12 },
  labelStyle: { color: "var(--foreground)" },
  itemStyle: { color: "var(--foreground)" },
};

const SERIES: { key: keyof RoundRow; name: string; stroke: string; dash?: string }[] = [
  { key: "messages", name: "Messages", stroke: "var(--primary)" },
  { key: "trades", name: "Trades (accepted)", stroke: "var(--lab-c)", dash: "6 3" },
  { key: "lies", name: "Lies", stroke: "var(--lab-b)", dash: "2 3" },
  { key: "thefts", name: "Thefts", stroke: "var(--violation)", dash: "10 3 2 3" },
  { key: "pactsBroken", name: "Pacts broken", stroke: "var(--accent)", dash: "1 5" },
];

function Charts({ events }: { events: Event[] }) {
  const { agents } = useRun();
  const rows = useMemo(() => buildRows(events, companyMap(agents)), [events, agents]);

  if (rows.length === 0) {
    return <p className={`${PANEL} text-sm text-muted-foreground`}>No events yet. Charts appear as the run unfolds.</p>;
  }
  return (
    <section aria-labelledby="ts-h" className="grid gap-4">
      <h2 id="ts-h" className="sr-only">Per-round time series</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <figure className={PANEL}>
          <figcaption className="text-sm font-medium">Activity per round</figcaption>
          <div className="mt-2 h-60 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={TICK} stroke="var(--border)" tickLine={false} />
                <YAxis tick={TICK} stroke="var(--border)" tickLine={false} allowDecimals={false} />
                <Tooltip {...TIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {SERIES.map((s) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.stroke} strokeDasharray={s.dash} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure>
        <figure className={PANEL}>
          <figcaption className="text-sm font-medium">In-group vs out-group share of interactions</figcaption>
          <p className="text-[11px] text-muted-foreground">
            Messages, offers, accepts/declines, pact proposals/accepts and thefts with a target. True company; dashed line = chance ({pct(CHANCE)}).
          </p>
          <div className="mt-2 h-52 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={TICK} stroke="var(--border)" tickLine={false} />
                <YAxis tick={TICK} stroke="var(--border)" tickLine={false} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} />
                <Tooltip {...TIP} formatter={(v) => pct(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={CHANCE} stroke="var(--foreground)" strokeDasharray="4 4" />
                <Bar dataKey="inShare" name="In-group" stackId="s" fill="var(--primary)" isAnimationActive={false} />
                <Bar dataKey="outShare" name="Out-group" stackId="s" fill="var(--surface-raised)" stroke="var(--muted-foreground)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      </div>

      <div className={PANEL}>
        <h3 className="text-sm font-medium">Per-round values</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs tabular-nums">
            <caption className="sr-only">Per-round counts and in-group interaction share</caption>
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 pr-3">Round</th>
                <th scope="col" className="pr-3 text-right">Msgs</th>
                <th scope="col" className="pr-3 text-right">Trades</th>
                <th scope="col" className="pr-3 text-right">Lies</th>
                <th scope="col" className="pr-3 text-right">Thefts</th>
                <th scope="col" className="pr-3 text-right">Pacts broken</th>
                <th scope="col" className="pr-3 text-right">In / out</th>
                <th scope="col" className="text-right">In share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.round} className="border-t border-border/60">
                  <th scope="row" className="py-1 pr-3 font-normal">{r.name}</th>
                  <td className="pr-3 text-right">{r.messages}</td>
                  <td className="pr-3 text-right">{r.trades}</td>
                  <td className="pr-3 text-right">{r.lies}</td>
                  <td className="pr-3 text-right">{r.thefts}</td>
                  <td className="pr-3 text-right">{r.pactsBroken}</td>
                  <td className="pr-3 text-right">{r.inCount} / {r.outCount}</td>
                  <td className="text-right">{r.inCount + r.outCount ? pct(r.inShare) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function DataView() {
  const events = useEventStore((s) => s.events);
  return (
    <div className="grid min-w-0 gap-4">
      <Network events={events} />
      <Charts events={events} />
    </div>
  );
}
