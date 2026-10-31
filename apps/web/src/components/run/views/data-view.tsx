"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
  message: { label: "Messages (DM)", stroke: "var(--muted-foreground)", offset: -12 },
  trade: { label: "Accepted trades", stroke: "var(--primary)", offset: -6 },
  pact: { label: "Pacts", stroke: "var(--lab-c)", offset: 0 },
  coalition: { label: "Coalition ties", stroke: "var(--foreground)", offset: 6, dash: "10 3 2 3" },
  theft: { label: "Thefts", stroke: "var(--violation)", offset: 12, dash: "1.5 4" },
  lie: { label: "Lie-flagged offers", stroke: "var(--accent)", offset: 18, dash: "7 5" },
};
/** BLIND must not reuse company colors (--lab-*) for anything: swap them for neutral tokens. */
const BLIND_STROKE: Partial<Record<EdgeType, string>> = { pact: "var(--foreground)", coalition: "var(--muted-foreground)" };
const strokeFor = (t: EdgeType, blind: boolean) => (blind ? BLIND_STROKE[t] : undefined) ?? EDGE_STYLE[t].stroke;
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

const MIN_SIZE = 260;
const MAX_SIZE = 620;
const RADIAL_BELOW = 520;
const CHAR_PX = 6.2;

interface Pt { x: number; y: number; angle: number }

const widthFor = (count: number) => 0.8 + Math.sqrt(count) * 1.1;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.round(entry.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width) || 560);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function Network({ events }: { events: Event[] }) {
  const { agents, blind, label, shownCompany } = useRun();
  const selected = useEventStore((s) => s.selectedAgentId);
  const [on, setOn] = useState<Record<EdgeType, boolean>>(DEFAULT_ON);
  const [hover, setHover] = useState<string | null>(null);
  const [upTo, setUpTo] = useState<number | null>(null);
  const [wrapRef, width] = useWidth();

  const order = useMemo(() => {
    const ids = agents.map((a) => a.id);
    if (blind) return ids; // BLIND: roster/id order only, never grouped by company
    return [...agents]
      .sort((p, q) => p.company.localeCompare(q.company) || p.id.localeCompare(q.id))
      .map((a) => a.id);
  }, [agents, blind]);

  const [lo, hi] = useMemo(() => {
    let l = Infinity;
    let h = -Infinity;
    for (const e of events) {
      if (e.round < l) l = e.round;
      if (e.round > h) h = e.round;
    }
    return l === Infinity ? [0, 0] : [l, h];
  }, [events]);
  const round = Math.min(Math.max(upTo ?? hi, lo), hi);
  const atLatest = round >= hi;
  const scoped = useMemo(() => (atLatest ? events : events.filter((e) => e.round <= round)), [events, round, atLatest]);

  const size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, width));
  const radial = size < RADIAL_BELOW;
  const maxLen = useMemo(() => Math.max(4, ...order.map((id) => label(id).length)), [order, label]);
  const nodeMax = Math.max(9, Math.round(size / 36));
  const nodeMin = Math.max(5, Math.round(size / 90));
  const pad = maxLen * CHAR_PX + 10;
  const ring = Math.max(60, size / 2 - nodeMax - (radial ? pad : pad * 0.9) - 4);
  const half = size / 2;

  const pos = useMemo(() => {
    const n = Math.max(order.length, 1);
    return new Map<string, Pt>(
      order.map((id, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        return [id, { x: Math.cos(angle) * ring, y: Math.sin(angle) * ring, angle }];
      }),
    );
  }, [order, ring]);
  const edges = useMemo(() => buildEdges(scoped, new Set(order)), [scoped, order]);
  const visible = useMemo(() => edges.filter((e) => on[e.type]), [edges, on]);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of visible) {
      d.set(e.a, (d.get(e.a) ?? 0) + e.count);
      d.set(e.b, (d.get(e.b) ?? 0) + e.count);
    }
    return d;
  }, [visible]);
  const maxDeg = Math.max(1, ...degree.values());
  const counts = useMemo(() => {
    const c = Object.fromEntries(EDGE_TYPES.map((t) => [t, 0])) as Record<EdgeType, number>;
    for (const e of edges) c[e.type] += e.count;
    return c;
  }, [edges]);

  const active = hover ?? selected;
  const neighbors = useMemo(() => {
    const s = new Set<string>();
    if (!active) return s;
    for (const e of visible) {
      if (e.a === active) s.add(e.b);
      else if (e.b === active) s.add(e.a);
    }
    return s;
  }, [active, visible]);
  const readout = useMemo(() => {
    if (!active) return null;
    const per: Partial<Record<EdgeType, number>> = {};
    for (const e of visible) if (e.a === active || e.b === active) per[e.type] = (per[e.type] ?? 0) + e.count;
    const parts = EDGE_TYPES.filter((t) => per[t]).map((t) => `${per[t]} ${EDGE_STYLE[t].label.toLowerCase()}`);
    return `${label(active)}: ${parts.length ? parts.join(", ") : "no visible interactions"}${neighbors.size ? ` with ${neighbors.size} agent${neighbors.size === 1 ? "" : "s"}` : ""}.`;
  }, [active, visible, neighbors, label]);

  const pick = (id: string) => useEventStore.getState().select(selected === id ? null : id);
  const onKey = (id: string) => (ev: KeyboardEvent) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      pick(id);
    }
  };
  const topEdges = useMemo(() => [...visible].sort((p, q) => q.count - p.count).slice(0, 12), [visible]);
  const companyLetters = useMemo(() => [...new Set(agents.map((a) => a.company).filter(Boolean))].sort(), [agents]);
  const fs = size < 400 ? 10 : 11.5;

  return (
    <section aria-labelledby="net-h" className={PANEL}>
      <h2 id="net-h" className="text-sm font-medium">Interaction network</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {blind
          ? "BLIND: nodes are neutral and ordered by roster; company is hidden. "
          : "Nodes are grouped by company around the ring (color and letter). "}
        Node size is activity, edge thickness is event count, and line style (not only color) marks edge type. Hover, focus or select an agent to isolate its edges.
      </p>

      <div role="group" aria-label="Edge types" className="mt-3 flex flex-wrap gap-1.5">
        {EDGE_TYPES.map((t) => {
          const s = EDGE_STYLE[t];
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on[t]}
              onClick={() => setOn((p) => ({ ...p, [t]: !p[t] }))}
              className={`flex min-h-8 items-center gap-1.5 rounded-sm border px-2 py-1 text-xs focus-visible:outline-2 ${
                on[t] ? "border-primary/60 bg-surface-raised" : "text-muted-foreground opacity-70"
              }`}
            >
              <svg width="24" height="8" aria-hidden="true">
                <line x1="1" y1="4" x2="23" y2="4" stroke={strokeFor(t, blind)} strokeWidth="2.5" strokeDasharray={s.dash} strokeLinecap="round" />
              </svg>
              <span>{s.label}</span>
              <span className="tabular-nums text-muted-foreground">{counts[t]}</span>
            </button>
          );
        })}
      </div>

      {hi > lo ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <label htmlFor="net-round" className="text-muted-foreground">Network up to round</label>
          <input
            id="net-round"
            type="range"
            min={lo}
            max={hi}
            step={1}
            value={round}
            onChange={(e) => setUpTo(Number(e.target.value) >= hi ? null : Number(e.target.value))}
            aria-valuetext={`Round ${round} of ${hi}`}
            className="min-w-0 flex-1 basis-40 accent-[var(--primary)]"
          />
          <span className="tabular-nums" aria-live="polite">R{round} / R{hi}</span>
          <button type="button" className="rounded-sm border bg-surface-raised px-2 py-1 text-xs hover:border-primary/60 focus-visible:outline-2 disabled:opacity-40" disabled={atLatest} onClick={() => setUpTo(null)}>
            Latest
          </button>
        </div>
      ) : null}

      <div ref={wrapRef} className="mt-2 w-full min-w-0">
        <svg
          width={size}
          height={size}
          viewBox={`${-half} ${-half} ${size} ${size}`}
          role="group"
          aria-label="Agent interaction network. Each agent is a focusable button; the edge table below lists the strongest links."
          className="mx-auto block max-w-full"
          onMouseLeave={() => setHover(null)}
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
            const off = st.offset * (size / 580);
            const cx = mx + (-dy / len) * off - mx * 0.25;
            const cy = my + (dx / len) * off - my * 0.25;
            const hit = active ? e.a === active || e.b === active : false;
            const dim = active && !hit;
            return (
              <path
                key={`${e.type}|${e.a}|${e.b}`}
                d={`M${p.x},${p.y} Q${cx},${cy} ${q.x},${q.y}`}
                fill="none"
                stroke={strokeFor(e.type, blind)}
                strokeWidth={widthFor(e.count) + (hit ? 0.8 : 0)}
                strokeDasharray={st.dash}
                strokeLinecap={st.dash ? "round" : "butt"}
                opacity={dim ? 0.07 : hit ? 1 : active ? 0.75 : 0.62}
              >
                <title>{`${st.label}: ${label(e.a)} - ${label(e.b)} x${e.count}`}</title>
              </path>
            );
          })}
          {order.map((id) => {
            const p = pos.get(id);
            if (!p) return null;
            const company = shownCompany(id);
            const isSel = selected === id;
            const isAct = active === id;
            const faded = active ? !isAct && !neighbors.has(id) : false;
            const deg = degree.get(id) ?? 0;
            const r = nodeMin + (nodeMax - nodeMin) * Math.sqrt(deg / maxDeg);
            const gap = r + 5;
            const cosA = Math.cos(p.angle);
            const sinA = Math.sin(p.angle);
            const lx = p.x + cosA * gap;
            const ly = p.y + sinA * gap;
            const flip = cosA < 0;
            const deg360 = (p.angle * 180) / Math.PI;
            const labelProps = radial
              ? { x: 0, y: 0, textAnchor: flip ? ("end" as const) : ("start" as const), transform: `translate(${lx} ${ly}) rotate(${flip ? deg360 + 180 : deg360})` }
              : { x: lx, y: ly, textAnchor: cosA > 0.25 ? ("start" as const) : cosA < -0.25 ? ("end" as const) : ("middle" as const) };
            const extra = !radial && Math.abs(cosA) <= 0.25 ? sinA * fs * 0.6 : 0;
            return (
              <g
                key={id}
                tabIndex={0}
                role="button"
                aria-pressed={isSel}
                aria-label={`${label(id)}${company ? `, company ${company}` : ""}, ${deg} visible interactions`}
                onClick={() => pick(id)}
                onKeyDown={onKey(id)}
                onMouseEnter={() => setHover(id)}
                onFocus={() => setHover(id)}
                onBlur={() => setHover(null)}
                opacity={faded ? 0.3 : 1}
                className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[var(--foreground)] [&:focus-visible>circle:first-child]:stroke-[3]"
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={company ? COMPANY_VAR[company] ?? "var(--muted-foreground)" : "var(--surface-raised)"}
                  stroke={isSel || isAct ? "var(--foreground)" : company ? "var(--surface)" : "var(--muted-foreground)"}
                  strokeWidth={isSel ? 3 : isAct ? 2 : 1.25}
                />
                {company && r >= 8 ? (
                  <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(11, r)} fontWeight="700" fill="var(--primary-foreground)" pointerEvents="none">
                    {company}
                  </text>
                ) : null}
                <text
                  {...labelProps}
                  dy={extra || undefined}
                  dominantBaseline="central"
                  fontSize={fs}
                  fontWeight={isAct || isSel ? 700 : 400}
                  fill={faded ? "var(--muted-foreground)" : "var(--foreground)"}
                  paintOrder="stroke"
                  stroke="var(--surface)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                >
                  {label(id)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="min-h-4 text-center text-xs text-muted-foreground" aria-live="polite">
        {readout ?? "No agent highlighted."}
      </p>

      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legend">
        {blind ? (
          <li>Nodes: neutral (company hidden)</li>
        ) : (
          companyLetters.map((c) => (
            <li key={c} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ background: COMPANY_VAR[c] ?? "var(--muted-foreground)" }} />
              Company {c}
            </li>
          ))
        )}
        <li className="flex items-center gap-1.5">
          <svg width="26" height="12" aria-hidden="true"><circle cx="5" cy="6" r="3" fill="var(--muted-foreground)" /><circle cx="19" cy="6" r="5" fill="var(--muted-foreground)" /></svg>
          Node size: interactions
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="26" height="12" aria-hidden="true"><line x1="1" y1="3" x2="25" y2="3" stroke="var(--muted-foreground)" strokeWidth="1" /><line x1="1" y1="9" x2="25" y2="9" stroke="var(--muted-foreground)" strokeWidth="3.5" /></svg>
          Edge width: events
        </li>
      </ul>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Strongest visible edges ({topEdges.length} of {visible.length})</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left tabular-nums">
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

const TICK = { fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" };
const AXIS_LABEL = { fill: "var(--subtle-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" };
const TIP = {
  contentStyle: { background: "var(--surface-raised)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 12, boxShadow: "var(--shadow-pop)" },
  labelStyle: { color: "var(--foreground)", marginBottom: 2 },
  itemStyle: { color: "var(--foreground)", padding: 0 },
  cursor: { stroke: "var(--muted-foreground)", strokeOpacity: 0.4 },
};

/** Series reuse the network's edge-type colors and dashes so one event type reads the same everywhere. */
const SERIES: { key: keyof RoundRow; name: string; type: EdgeType | null; stroke: string; dash?: string }[] = [
  { key: "messages", name: "Messages", type: "message", stroke: "var(--foreground)" },
  { key: "trades", name: "Trades (accepted)", type: "trade", stroke: "var(--primary)", dash: "6 3" },
  { key: "lies", name: "Lies", type: "lie", stroke: "var(--accent)", dash: "2 3" },
  { key: "thefts", name: "Thefts", type: "theft", stroke: "var(--violation)", dash: "10 3 2 3" },
  { key: "pactsBroken", name: "Pacts broken", type: null, stroke: "var(--muted-foreground)", dash: "1 5" },
];

const roundLabel = (v: unknown) => `Round ${String(v).replace(/^R/, "")}`;

function Charts({ events }: { events: Event[] }) {
  const { agents } = useRun();
  const rows = useMemo(() => buildRows(events, companyMap(agents)), [events, agents]);

  if (rows.length === 0) {
    return <p className={`${PANEL} text-sm text-muted-foreground`}>No events yet. Charts appear as the run unfolds.</p>;
  }
  return (
    <section aria-labelledby="ts-h" className="grid min-w-0 gap-4">
      <h2 id="ts-h" className="sr-only">Per-round time series</h2>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <figure className={`${PANEL} min-w-0`}>
          <figcaption className="text-sm font-medium">Activity per round</figcaption>
          <p className="text-[11px] text-muted-foreground">Event counts per round; line style matches the edge types above. Exact values in the table below.</p>
          <div className="mt-2 h-64 w-full min-w-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 16, left: 4 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={TICK} stroke="var(--border)" tickLine={false} label={{ value: "Round", position: "insideBottom", offset: -10, ...AXIS_LABEL }} />
                <YAxis width={40} tick={TICK} stroke="var(--border)" tickLine={false} allowDecimals={false} label={{ value: "Events", angle: -90, position: "insideLeft", offset: 10, style: { textAnchor: "middle" }, ...AXIS_LABEL }} />
                <Tooltip {...TIP} labelFormatter={roundLabel} />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11 }} />
                {SERIES.map((s) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.stroke} strokeDasharray={s.dash} strokeWidth={2} dot={rows.length > 24 ? false : { r: 2.5 }} activeDot={{ r: 4 }} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure>
        <figure className={`${PANEL} min-w-0`}>
          <figcaption className="text-sm font-medium">In-group vs out-group share of interactions</figcaption>
          <p className="text-[11px] text-muted-foreground">
            Messages, offers, accepts/declines, pact proposals/accepts and thefts with a target. True company; dashed line = chance ({pct(CHANCE)}).
          </p>
          <div className="mt-2 h-64 w-full min-w-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 16, left: 4 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={TICK} stroke="var(--border)" tickLine={false} label={{ value: "Round", position: "insideBottom", offset: -10, ...AXIS_LABEL }} />
                <YAxis width={44} tick={TICK} stroke="var(--border)" tickLine={false} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} label={{ value: "Share of interactions", angle: -90, position: "insideLeft", offset: -2, style: { textAnchor: "middle" }, ...AXIS_LABEL }} />
                <Tooltip
                  {...TIP}
                  cursor={{ fill: "var(--muted-foreground)", fillOpacity: 0.12 }}
                  labelFormatter={roundLabel}
                  formatter={(v, n, item) => {
                    const row = item.payload as RoundRow;
                    const c = n === "In-group" ? row.inCount : row.outCount;
                    return [`${pct(Number(v))} (${c} events)`, n];
                  }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={CHANCE} stroke="var(--foreground)" strokeDasharray="4 4" label={{ value: `chance ${pct(CHANCE)}`, position: "insideTopRight", fill: "var(--foreground)", fontSize: 10 }} />
                <Bar dataKey="inShare" name="In-group" stackId="s" fill="var(--primary)" isAnimationActive={false} />
                <Bar dataKey="outShare" name="Out-group" stackId="s" fill="var(--muted-foreground)" fillOpacity={0.3} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      </div>

      <div className={`${PANEL} min-w-0`}>
        <h3 className="text-sm font-medium">Per-round values</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[460px] text-left text-xs tabular-nums">
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
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <Network events={events} />
      <Charts events={events} />
    </div>
  );
}
