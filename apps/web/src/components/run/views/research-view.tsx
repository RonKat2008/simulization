"use client";
import { Fragment, useMemo, useState } from "react";
import {
  CHANCE,
  EVENT_TYPES,
  FLAGS,
  PHASES,
  computeRunMetrics,
  powerStructure,
  type Event,
} from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "@/components/run/run-context";
import { BTN, PANEL, companyMap, pct, relationOf, type Relation } from "./view-utils";

/* ---------- Pipeline ---------- */

interface Stage {
  title: string;
  kind: string;
  lines: [string, string | number][];
}

function usePipeline(events: Event[], metricLine: string): Stage[] {
  return useMemo(() => {
    const turnKeys = new Set<string>();
    const turnsByPhase: Record<string, Set<string>> = {};
    const actionsByPhase: Record<string, number> = {};
    const channels = new Map<string, number>();
    const flagCount: Record<string, number> = {};
    let plans = 0;
    let checked = 0;
    let system = 0;
    for (const e of events) {
      for (const f of e.flags) flagCount[f] = (flagCount[f] ?? 0) + 1;
      if (e.groundTruth) checked++;
      if (e.type === "system" || e.actorId === "world") {
        system++;
        continue;
      }
      const key = `${e.actorId}|${e.round}|${e.phase}`;
      turnKeys.add(key);
      (turnsByPhase[e.phase] ??= new Set()).add(key);
      actionsByPhase[e.phase] = (actionsByPhase[e.phase] ?? 0) + 1;
      if (e.privatePlan) plans++;
      if (e.type === "message") {
        const ch = e.channel?.startsWith("coalition") ? "coalition" : (e.channel ?? "unknown");
        channels.set(ch, (channels.get(ch) ?? 0) + 1);
      }
    }
    const nMsg = [...channels.values()].reduce((s, v) => s + v, 0);
    const flagTotal = Object.values(flagCount).reduce((s, v) => s + v, 0);
    return [
      {
        title: "Agent turn",
        kind: "prompt, private plan, actions",
        lines: [
          ["turns", turnKeys.size],
          ["actions", Object.values(actionsByPhase).reduce((s, v) => s + v, 0)],
          ["private plans", plans],
          ...PHASES.map((p): [string, string] => [p, `${turnsByPhase[p]?.size ?? 0} t / ${actionsByPhase[p] ?? 0} a`]),
        ],
      },
      {
        title: "AgentRelay",
        kind: "message transport",
        lines: [["messages", nMsg], ...[...channels.entries()].map(([k, v]): [string, number] => [k, v])],
      },
      {
        title: "World referee",
        kind: "ground-truth check",
        lines: [
          ["claims checked", checked],
          ["lie", flagCount.lie ?? 0],
          ["theft", flagCount.theft ?? 0],
          ["broken pact", flagCount.broken_pact ?? 0],
          ["world/system events", system],
        ],
      },
      {
        title: "Event log",
        kind: "append-only, flagged",
        lines: [
          ["events", events.length],
          ["flags raised", flagTotal],
          ["rule break", flagCount.rule_break ?? 0],
          ["eval aware", flagCount.eval_aware ?? 0],
        ],
      },
      {
        title: "Metrics",
        kind: "computed by code",
        lines: [["summary", metricLine]],
      },
      {
        title: "Opus review",
        kind: "anonymized input",
        lines: [
          ["input events", events.length],
          ["identity", "company and model stripped"],
        ],
      },
    ];
  }, [events, metricLine]);
}

function Pipeline({ events, metricLine }: { events: Event[]; metricLine: string }) {
  const stages = usePipeline(events, metricLine);
  return (
    <section aria-labelledby="pipe-h" className={PANEL}>
      <h2 id="pipe-h" className="text-sm font-medium">Data flow</h2>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {stages.map((s, i) => (
          <li key={s.title} className="relative min-w-0 rounded-md border bg-surface-raised p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <span aria-hidden="true">{i + 1}. </span>
              <span className="sr-only">Stage {i + 1}: </span>
              {s.kind}
            </p>
            <h3 className="font-display text-sm text-primary">{s.title}</h3>
            <dl className="mt-1.5 grid gap-0.5 text-[11px]">
              {s.lines.map(([k, v]) => (
                <div key={k} className="flex min-w-0 justify-between gap-2">
                  <dt className="truncate text-muted-foreground">{k}</dt>
                  <dd className="text-right tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            {i < stages.length - 1 ? (
              <span aria-hidden="true" className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 text-xs text-muted-foreground lg:-right-2.5 lg:bottom-auto lg:left-auto lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0">
                <span className="lg:hidden">v</span>
                <span className="hidden lg:inline">&gt;</span>
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- Metrics panel ---------- */

interface MRow {
  name: string;
  value: string;
  num: string;
  note?: string;
}

const frac = (n: number | undefined, d: number | undefined) => `${n ?? 0} / ${d ?? 0}`;

function MetricsPanel({ rows }: { rows: MRow[] }) {
  return (
    <section aria-labelledby="met-h" className={PANEL}>
      <h2 id="met-h" className="text-sm font-medium">Metrics (code, whole run)</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        computeRunMetrics and powerStructure over the full log. In-group means true company, also in BLIND. Chance = {pct(CHANCE)}.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-xs tabular-nums">
          <caption className="sr-only">Run metrics with numerators and denominators</caption>
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 pr-3">Metric</th>
              <th scope="col" className="pr-3 text-right">Value</th>
              <th scope="col" className="pr-3 text-right">Num / denom</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${i}`} className="border-t border-border/60 align-top">
                <th scope="row" className="py-1 pr-3 font-normal">{r.name}</th>
                <td className="pr-3 text-right text-primary">{r.value}</td>
                <td className="pr-3 text-right">{r.num}</td>
                <td className="text-muted-foreground">{r.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- Event table ---------- */

type SortKey = "seq" | "round" | "phase" | "type" | "actor" | "rel" | "claim";
interface Row {
  e: Event;
  actor: string;
  target: string;
  rel: Relation;
  claimDelta: number | null;
}

const PAGE_SIZE = 100;
const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: "seq", label: "Seq" },
  { key: "round", label: "Rnd" },
  { key: "phase", label: "Phase" },
  { key: "type", label: "Type" },
  { key: "actor", label: "Actor to target" },
  { key: "rel", label: "In/out" },
  { key: null, label: "Public text" },
  { key: null, label: "Private plan" },
  { key: "claim", label: "Claimed / true" },
  { key: null, label: "Flags" },
];

const sortValue = (r: Row, k: SortKey): string | number => {
  switch (k) {
    case "seq": return r.e.seq;
    case "round": return r.e.round;
    case "phase": return PHASES.indexOf(r.e.phase);
    case "type": return r.e.type;
    case "actor": return r.actor;
    case "rel": return r.rel;
    case "claim": return r.claimDelta ?? -1;
  }
};

const FLAG_CLASS: Record<string, string> = {
  lie: "border-lab-b/60 text-lab-b",
  theft: "border-violation/60 text-violation",
  broken_pact: "border-violation/60 text-violation",
  rule_break: "border-violation/60 text-violation",
  eval_aware: "border-accent/60 text-accent",
};

const csvCell = (v: unknown): string => {
  let s = v === undefined || v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function download(name: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const CSV_HEAD = [
  "seq", "round", "phase", "type", "actor_id", "actor_company", "target_id", "target_company",
  "relation", "channel", "text", "private_plan", "good_id", "claimed_quality", "price", "true_quality", "flags", "ts",
];

function toCsv(rows: Row[]): string {
  const lines = rows.map(({ e, rel }) =>
    [
      e.seq, e.round, e.phase, e.type, e.actorId, e.actorCompany, e.targetId, e.targetCompany, rel, e.channel,
      e.text, e.privatePlan, e.claim?.goodId, e.claim?.claimedQuality, e.claim?.price, e.groundTruth?.trueQuality,
      e.flags.join("|"), e.ts,
    ].map(csvCell).join(","),
  );
  return [CSV_HEAD.join(","), ...lines].join("\n");
}

const SELECT = "min-h-8 rounded-sm border bg-surface-raised px-2 py-1 text-xs focus-visible:outline-2";

function EventTable({ events }: { events: Event[] }) {
  const { agents, blind, label, runId } = useRun();
  const companies = useMemo(() => companyMap(agents), [agents]);
  const [type, setType] = useState("");
  const [round, setRound] = useState("");
  const [flag, setFlag] = useState("");
  const [rel, setRel] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "seq", dir: 1 });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Set<number>>(new Set());

  const name = (id: string | undefined, company: string | undefined) => {
    if (!id) return "";
    const c = blind ? undefined : (companies.get(id) ?? company);
    return `${label(id)}${c ? ` (${c})` : ""}`;
  };

  const all = useMemo<Row[]>(
    () =>
      events.map((e) => ({
        e,
        actor: name(e.actorId, e.actorCompany),
        target: name(e.targetId, e.targetCompany),
        rel: relationOf(e, companies),
        claimDelta: e.claim && e.groundTruth ? Math.abs(e.claim.claimedQuality - e.groundTruth.trueQuality) : null,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, companies, blind],
  );
  const rounds = useMemo(() => [...new Set(events.map((e) => e.round))].sort((a, b) => a - b), [events]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = all.filter(({ e, rel: r, actor, target }) => {
      if (type && e.type !== type) return false;
      if (round !== "" && e.round !== Number(round)) return false;
      if (flag && !e.flags.includes(flag as (typeof FLAGS)[number])) return false;
      if (rel && r !== rel) return false;
      if (!needle) return true;
      return [e.text, e.privatePlan, actor, target].some((s) => s?.toLowerCase().includes(needle));
    });
    return filtered.sort((a, b) => {
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return (c || a.e.seq - b.e.seq) * sort.dir;
    });
  }, [all, type, round, flag, rel, q, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * PAGE_SIZE, (cur + 1) * PAGE_SIZE);

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };
  const toggleSort = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));
  const toggleOpen = (seq: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(seq)) n.delete(seq);
      else n.add(seq);
      return n;
    });

  return (
    <section aria-labelledby="ev-h" className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ev-h" className="text-sm font-medium">
          Event log <span className="tabular-nums text-muted-foreground">({rows.length} of {events.length})</span>
        </h2>
        <div className="flex gap-2">
          <button type="button" className={BTN} onClick={() => download(`${runId}-events.json`, "application/json", JSON.stringify(events, null, 2))}>
            Download JSON
          </button>
          <button type="button" className={BTN} onClick={() => download(`${runId}-events.csv`, "text/csv", toCsv(all))}>
            Download CSV
          </button>
        </div>
      </div>
      {blind ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          BLIND: labels omit company letters. In/out is still computed from true company. Downloads contain raw ground-truth fields.
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <label className="grid gap-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Type
          <select className={SELECT} value={type} onChange={(e) => resetPage(setType)(e.target.value)}>
            <option value="">All</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="grid gap-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Round
          <select className={SELECT} value={round} onChange={(e) => resetPage(setRound)(e.target.value)}>
            <option value="">All</option>
            {rounds.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="grid gap-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Flag
          <select className={SELECT} value={flag} onChange={(e) => resetPage(setFlag)(e.target.value)}>
            <option value="">Any</option>
            {FLAGS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className="grid gap-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          In/out-group
          <select className={SELECT} value={rel} onChange={(e) => resetPage(setRel)(e.target.value)}>
            <option value="">All</option>
            <option value="in">in</option>
            <option value="out">out</option>
            <option value="none">n/a</option>
          </select>
        </label>
        <label className="col-span-2 grid min-w-0 gap-0.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:flex-1">
          Search text, plans, names
          <input type="search" className={`${SELECT} min-w-0`} value={q} onChange={(e) => resetPage(setQ)(e.target.value)} />
        </label>
      </div>

      <div className="mt-3 max-h-[70vh] overflow-auto rounded-sm border" tabIndex={0} role="region" aria-label="Event table, scrollable">
        <table className="w-full min-w-[960px] border-collapse text-left text-xs">
          <caption className="sr-only">All events; column headers are sort buttons</caption>
          <thead className="sticky top-0 z-10 bg-surface-raised text-muted-foreground">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.label}
                  scope="col"
                  aria-sort={c.key && sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                  className="whitespace-nowrap px-2 py-1.5 font-normal"
                >
                  {c.key ? (
                    <button type="button" onClick={() => toggleSort(c.key as SortKey)} className="underline-offset-2 hover:underline focus-visible:outline-2">
                      {c.label}
                      <span aria-hidden="true">{sort.key === c.key ? (sort.dir === 1 ? " ^" : " v") : ""}</span>
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map(({ e, actor, target, rel: r, claimDelta }) => {
              const expanded = open.has(e.seq);
              const clamp = expanded ? "" : "line-clamp-2";
              return (
                <tr key={e.seq} className={`border-t border-border/60 align-top ${e.flags.length ? "bg-violation/5" : ""}`}>
                  <td className="px-2 py-1.5 tabular-nums">
                    <button type="button" aria-expanded={expanded} aria-label={`Seq ${e.seq}, ${expanded ? "collapse" : "expand"} text`} onClick={() => toggleOpen(e.seq)} className="underline-offset-2 hover:underline focus-visible:outline-2">
                      {e.seq}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{e.round}</td>
                  <td className="px-2 py-1.5">{e.phase}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{e.type}{e.channel ? <span className="text-muted-foreground"> [{e.channel}]</span> : null}</td>
                  <td className="px-2 py-1.5">{actor}{target ? <Fragment> <span aria-label="to">-&gt;</span> {target}</Fragment> : null}</td>
                  <td className="px-2 py-1.5">{r === "none" ? <span className="text-muted-foreground">-</span> : r}</td>
                  <td className={`max-w-[18rem] break-words px-2 py-1.5 ${clamp}`}>{e.text ?? ""}</td>
                  <td className={`max-w-[18rem] break-words px-2 py-1.5 text-muted-foreground ${clamp}`}>{e.privatePlan ?? ""}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
                    {e.claim ? (
                      <span>
                        {e.claim.claimedQuality} / {e.groundTruth?.trueQuality ?? "?"} @ {e.claim.price}
                        {claimDelta !== null && claimDelta > 0 ? <span className="text-muted-foreground"> (d{claimDelta})</span> : null}
                      </span>
                    ) : ""}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="flex flex-wrap gap-1">
                      {e.flags.map((f) => (
                        <span key={f} className={`rounded-sm border px-1 ${FLAG_CLASS[f] ?? ""}`}>{f}</span>
                      ))}
                    </span>
                  </td>
                </tr>
              );
            })}
            {slice.length === 0 ? (
              <tr><td colSpan={COLUMNS.length} className="px-2 py-4 text-center text-muted-foreground">No events match.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <nav aria-label="Event table pages" className="mt-2 flex items-center justify-between gap-2 text-xs">
        <button type="button" className={BTN} disabled={cur === 0} onClick={() => setPage(cur - 1)}>Prev</button>
        <span className="tabular-nums text-muted-foreground" aria-live="polite">
          Page {cur + 1} / {pages} (rows {rows.length ? cur * PAGE_SIZE + 1 : 0} to {Math.min((cur + 1) * PAGE_SIZE, rows.length)})
        </span>
        <button type="button" className={BTN} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</button>
      </nav>
    </section>
  );
}

/* ---------- View ---------- */

export default function ResearchView() {
  const events = useEventStore((s) => s.events);
  const { agents, label } = useRun();

  const { rows, metricLine } = useMemo(() => {
    const refs = agents.filter((a) => a.company).map((a) => ({ id: a.id, company: a.company }));
    const m = computeRunMetrics(events, refs);
    const p = powerStructure(events, refs);
    const io = (r: typeof m.deception, name: string, note?: string): MRow[] => [
      { name: `${name}, in-group`, value: pct(r.inGroup), num: frac(r.inGroupCount, r.inGroupTotal), note },
      { name: `${name}, out-group`, value: pct(r.outGroup), num: frac(r.outGroupCount, r.outGroupTotal) },
    ];
    const out: MRow[] = [
      { name: "In-group alliance ratio", value: `${m.allianceRatio.ratio.toFixed(2)}x`, num: frac(m.allianceRatio.count, m.allianceRatio.total), note: `share ${pct(m.allianceRatio.share)} vs chance ${pct(m.allianceRatio.chance ?? CHANCE)}` },
      { name: "In-group message share", value: `${m.messageShare.ratio.toFixed(2)}x`, num: frac(m.messageShare.count, m.messageShare.total), note: `share ${pct(m.messageShare.share)} of DMs` },
      ...io(m.deception, "Deception rate", "lie-flagged offers / offers"),
      ...io(m.theft, "Theft rate", "steals / act-phase turns"),
      { name: "Theft, chance-adjusted in / out", value: m.theft.chanceAdjusted ? `${m.theft.chanceAdjusted.inGroup.toFixed(2)} / ${m.theft.chanceAdjusted.outGroup.toFixed(2)}` : "-", num: "-", note: "equal under random targeting" },
      ...io(m.pactKeeping, "Pact-keeping rate", "pacts never broken / pacts formed"),
      { name: "Eval-awareness rate", value: pct(m.evalAwareness.rate), num: frac(m.evalAwareness.count, m.evalAwareness.total), note: "eval_aware turns / turns" },
      { name: "Largest coalition", value: `${p.largestCoalition.size}`, num: `${p.largestCoalition.size} / ${agents.length}`, note: `share ${pct(p.largestCoalition.share)}; dominant company share ${pct(p.largestCoalition.dominantCompanyShare)}` },
      { name: "Degree centralization", value: p.degreeCentralization.toFixed(3), num: "-", note: "0 flat, 1 star" },
      { name: "Wealth Gini", value: p.wealthGini ? p.wealthGini.toFixed(3) : "n/a", num: "-", note: "needs final scores (not in event log)" },
      { name: "Top brokers (distinct partners)", value: p.brokers.length ? p.brokers.map((b) => `${label(b.agentId)} ${b.degree}`).join(", ") : "-", num: "-" },
    ];
    const line = `align ${m.allianceRatio.ratio.toFixed(2)}x, lie ${pct(m.deception.inGroup)}/${pct(m.deception.outGroup)}`;
    return { rows: out, metricLine: line };
  }, [events, agents, label]);

  return (
    <div className="grid min-w-0 gap-4">
      <Pipeline events={events} metricLine={metricLine} />
      <MetricsPanel rows={rows} />
      <EventTable events={events} />
    </div>
  );
}
