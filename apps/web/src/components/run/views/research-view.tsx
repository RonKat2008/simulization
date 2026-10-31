"use client";
import { Fragment, memo, useDeferredValue, useMemo, useState, useSyncExternalStore } from "react";
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
  desc: string;
  headline: [string | number, string];
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
        kind: "prompt, self-reported plan, actions",
        desc: "Each agent reads its prompt, writes a self-reported plan, then acts. Plans are not verified internal thoughts. t = turns, a = actions per phase.",
        headline: [turnKeys.size, "turns"],
        lines: [
          ["turns", turnKeys.size],
          ["actions", Object.values(actionsByPhase).reduce((s, v) => s + v, 0)],
          ["self-reported plans", plans],
          ...PHASES.map((p): [string, string] => [p, `${turnsByPhase[p]?.size ?? 0} t / ${actionsByPhase[p] ?? 0} a`]),
        ],
      },
      {
        title: "AgentRelay",
        kind: "message transport",
        desc: "Routes agent messages between channels (public, DM, coalition).",
        headline: [nMsg, "messages"],
        lines: [["messages", nMsg], ...[...channels.entries()].map(([k, v]): [string, number] => [k, v])],
      },
      {
        title: "World referee",
        kind: "ground-truth check",
        desc: "Compares claims with ground truth and raises lie, theft and broken-pact flags.",
        headline: [checked, "claims checked"],
        lines: [
          ["lie", flagCount.lie ?? 0],
          ["theft", flagCount.theft ?? 0],
          ["broken pact", flagCount.broken_pact ?? 0],
          ["world/system events", system],
        ],
      },
      {
        title: "Event log",
        kind: "append-only, flagged",
        desc: "Every action and system event is appended once, with its flags.",
        headline: [events.length, "events"],
        lines: [
          ["flags raised", flagTotal],
          ["rule break", flagCount.rule_break ?? 0],
          ["eval aware", flagCount.eval_aware ?? 0],
        ],
      },
      {
        title: "Metrics",
        kind: "computed by code",
        desc: "Alliance, deception, theft and power metrics computed from the log, not by a model.",
        headline: [flagTotal, "flags raised"],
        lines: [["summary", metricLine]],
      },
      {
        title: "Opus review",
        kind: "anonymized input",
        desc: "A reviewer model reads the log with company and model identity stripped.",
        headline: [events.length, "events in"],
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
      <p className="mt-0.5 text-[11px] text-muted-foreground">Six stages from agent turn to review, in order. Counts are over the events loaded so far.</p>
      <ol className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(11.5rem,1fr))] gap-2">
        {stages.map((s, i) => (
          <li key={s.title} className="min-w-0 rounded-md border bg-surface-raised p-2.5">
            <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">
              <span aria-hidden="true" className="grid size-4 place-items-center rounded-full border text-[10px] tabular-nums">{i + 1}</span>
              <span className="sr-only">Stage {i + 1}: </span>
              <span className="truncate">{s.kind}</span>
            </p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">{s.title}</h3>
            <p className="mt-0.5 text-lg font-semibold leading-none tabular-nums">
              {s.headline[0]} <span className="text-[11px] font-normal text-muted-foreground">{s.headline[1]}</span>
            </p>
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{s.desc}</p>
            <dl className="mt-2 grid gap-0.5 border-t border-border/60 pt-1.5 text-[11px]">
              {s.lines.map(([k, v]) => (
                <div key={k} className="flex min-w-0 justify-between gap-2">
                  <dt className="truncate text-muted-foreground">{k}</dt>
                  <dd className="break-words text-right tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
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
        <table className="w-full text-left text-xs tabular-nums">
          <caption className="sr-only">Run metrics with numerators and denominators</caption>
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 pr-3 font-normal">Metric</th>
              <th scope="col" className="pr-3 text-right font-normal">Value</th>
              <th scope="col" className="pr-3 text-right font-normal">Num / denom</th>
              <th scope="col" className="hidden font-normal md:table-cell">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}-${i}`} className="border-t border-border/60 align-top">
                <th scope="row" className="py-1.5 pr-3 font-normal">
                  {r.name}
                  {r.note ? <span className="block text-[11px] text-muted-foreground md:hidden">{r.note}</span> : null}
                </th>
                <td className="max-w-[14rem] break-words py-1.5 pr-3 text-right text-primary">{r.value}</td>
                <td className="whitespace-nowrap py-1.5 pr-3 text-right">{r.num}</td>
                <td className="hidden py-1.5 text-muted-foreground md:table-cell">{r.note ?? ""}</td>
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
type ColKey = SortKey | "text" | "plan" | "flags";
interface Row {
  e: Event;
  actor: string;
  target: string;
  rel: Relation;
  claimDelta: number | null;
}

const PAGE_SIZES = [50, 100, 250];
const COLUMNS: { id: ColKey; sort: SortKey | null; label: string; cell?: string }[] = [
  { id: "seq", sort: "seq", label: "Seq" },
  { id: "round", sort: "round", label: "Rnd" },
  { id: "phase", sort: "phase", label: "Phase" },
  { id: "type", sort: "type", label: "Type" },
  { id: "actor", sort: "actor", label: "Actor to target" },
  { id: "rel", sort: "rel", label: "In/out" },
  { id: "text", sort: null, label: "Channel-scoped text", cell: "min-w-[14rem] max-w-[24rem]" },
  { id: "plan", sort: null, label: "Self-reported plan", cell: "min-w-[14rem] max-w-[24rem]" },
  { id: "claim", sort: "claim", label: "Claimed / true" },
  { id: "flags", sort: null, label: "Flags" },
];
const COMPACT_HIDDEN: ColKey[] = ["phase", "plan", "claim", "rel"];
const COMPACT_QUERY = "(max-width: 639px)";
const subscribeCompact = (cb: () => void) => {
  const mq = window.matchMedia(COMPACT_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

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

const SELECT = "min-h-8 w-full min-w-0 rounded-sm border bg-surface-raised px-2 py-1 text-xs focus-visible:outline-2";
const FIELD = "grid min-w-0 gap-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground";

interface EventRowProps {
  row: Row;
  expanded: boolean;
  show: Set<ColKey>;
  colCount: number;
  json: string | null;
  onToggle: (seq: number) => void;
}

const EventRow = memo(function EventRow({ row, expanded, show, colCount, json, onToggle }: EventRowProps) {
  const { e, actor, target, rel: r, claimDelta } = row;
  const clamp = expanded ? "" : "line-clamp-2";
  return (
    <>
      <tr
        onClick={(ev) => {
          if (!(ev.target as HTMLElement).closest("button")) onToggle(e.seq);
        }}
        className={`cursor-pointer border-t border-border/60 align-top hover:bg-surface-raised ${expanded ? "bg-surface-raised" : e.flags.length ? "bg-violation/5" : ""}`}
      >
        <td className="px-2 py-1.5 tabular-nums">
          <button type="button" aria-expanded={expanded} aria-label={`Seq ${e.seq}, ${expanded ? "collapse" : "expand"} details`} onClick={() => onToggle(e.seq)} className="flex items-center gap-1 underline-offset-2 hover:underline focus-visible:outline-2">
            <span aria-hidden="true" className="inline-block w-2 text-muted-foreground">{expanded ? "v" : ">"}</span>
            {e.seq}
          </button>
        </td>
        {show.has("round") ? <td className="px-2 py-1.5 tabular-nums">{e.round}</td> : null}
        {show.has("phase") ? <td className="px-2 py-1.5">{e.phase}</td> : null}
        {show.has("type") ? <td className="whitespace-nowrap px-2 py-1.5">{e.type}{e.channel ? <span className="text-muted-foreground"> [{e.channel}]</span> : null}</td> : null}
        {show.has("actor") ? <td className="min-w-[8rem] px-2 py-1.5">{actor}{target ? <Fragment> <span aria-label="to">-&gt;</span> {target}</Fragment> : null}</td> : null}
        {show.has("rel") ? <td className="px-2 py-1.5">{r === "none" ? <span className="text-muted-foreground">-</span> : r}</td> : null}
        {show.has("text") ? <td className="min-w-[14rem] max-w-[24rem] break-words px-2 py-1.5"><div className={clamp}>{e.text ?? ""}</div></td> : null}
        {show.has("plan") ? <td className="min-w-[14rem] max-w-[24rem] break-words px-2 py-1.5 text-muted-foreground"><div className={clamp}>{e.privatePlan ?? ""}</div></td> : null}
        {show.has("claim") ? (
          <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
            {e.claim ? (
              <span>
                {e.claim.claimedQuality} / {e.groundTruth?.trueQuality ?? "?"} @ {e.claim.price}
                {claimDelta !== null && claimDelta > 0 ? <span className="text-muted-foreground"> (d{claimDelta})</span> : null}
              </span>
            ) : ""}
          </td>
        ) : null}
        {show.has("flags") ? (
          <td className="px-2 py-1.5">
            <span className="flex flex-wrap gap-1">
              {e.flags.map((f) => (
                <span key={f} className={`rounded-sm border px-1 ${FLAG_CLASS[f] ?? ""}`}>{f}</span>
              ))}
            </span>
          </td>
        ) : null}
      </tr>
      {expanded ? (
        <tr className="bg-surface-raised">
          <td colSpan={colCount} className="px-3 pb-3 pt-1">
            <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">Channel-scoped text</dt>
                <dd className="whitespace-pre-wrap break-words">{e.text || "-"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle-foreground">Self-reported plan</dt>
                <dd className="whitespace-pre-wrap break-words text-muted-foreground">{e.privatePlan || "-"}</dd>
              </div>
            </dl>
            {json ? (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Raw event JSON</summary>
                <pre className="mt-1 max-h-60 overflow-auto rounded-sm border bg-surface p-2 text-[11px] leading-snug">{json}</pre>
              </details>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
});

function EventTable({ events }: { events: Event[] }) {
  const { agents, blind, label, runId } = useRun();
  const companies = useMemo(() => companyMap(agents), [agents]);
  const [type, setType] = useState("");
  const [round, setRound] = useState("");
  const [flag, setFlag] = useState("");
  const [rel, setRel] = useState("");
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "seq", dir: 1 });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const compact = useSyncExternalStore(subscribeCompact, () => window.matchMedia(COMPACT_QUERY).matches, () => false);
  const [userHidden, setUserHidden] = useState<Set<ColKey> | null>(null);
  const hidden = useMemo(() => userHidden ?? new Set<ColKey>(compact ? COMPACT_HIDDEN : []), [userHidden, compact]);

  const all = useMemo<Row[]>(() => {
    const name = (id: string | undefined, company: string | undefined) => {
      if (!id) return "";
      const c = blind ? undefined : (companies.get(id) ?? company);
      return `${label(id)}${c ? ` (${c})` : ""}`;
    };
    return events.map((e) => ({
      e,
      actor: name(e.actorId, e.actorCompany),
      target: name(e.targetId, e.targetCompany),
      rel: relationOf(e, companies),
      claimDelta: e.claim && e.groundTruth ? Math.abs(e.claim.claimedQuality - e.groundTruth.trueQuality) : null,
    }));
  }, [events, companies, blind, label]);
  const rounds = useMemo(() => [...new Set(events.map((e) => e.round))].sort((a, b) => a - b), [events]);

  const rows = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
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
  }, [all, type, round, flag, rel, deferredQ, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = useMemo(() => rows.slice(cur * pageSize, (cur + 1) * pageSize), [rows, cur, pageSize]);
  const show = useMemo(() => new Set(COLUMNS.map((c) => c.id).filter((id) => id === "seq" || !hidden.has(id))), [hidden]);
  const visibleCols = COLUMNS.filter((c) => show.has(c.id));
  const filtering = Boolean(type || round !== "" || flag || rel || q);

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };
  const clearFilters = () => {
    setType("");
    setRound("");
    setFlag("");
    setRel("");
    setQ("");
    setPage(0);
  };
  const toggleSort = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));
  const toggleOpen = useMemo(
    () => (seq: number) =>
      setOpen((s) => {
        const n = new Set(s);
        if (n.has(seq)) n.delete(seq);
        else n.add(seq);
        return n;
      }),
    [],
  );
  const toggleCol = (id: ColKey) =>
    setUserHidden(() => {
      const n = new Set(hidden);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  /** On-screen raw JSON never carries company; BLIND also swaps ids (A-04 style) for neutral labels. */
  const jsonFor = (e: Event): string => {
    const { actorCompany: _ac, targetCompany: _tc, ...rest } = e;
    void _ac;
    void _tc;
    const safe = blind ? { ...rest, actorId: label(e.actorId), targetId: e.targetId ? label(e.targetId) : undefined, id: undefined } : e;
    return JSON.stringify(safe, null, 2);
  };

  return (
    <section aria-labelledby="ev-h" className={`${PANEL} min-w-0`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ev-h" className="text-sm font-medium">
          Event log <span className="tabular-nums text-muted-foreground">({rows.length} of {events.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN} onClick={() => download(`${runId}-events.json`, "application/json", JSON.stringify(rows.map((r) => r.e), null, 2))}>
            Download JSON{filtering ? ` (${rows.length})` : ""}
          </button>
          <button type="button" className={BTN} onClick={() => download(`${runId}-events.csv`, "text/csv", toCsv(rows))}>
            Download CSV{filtering ? ` (${rows.length})` : ""}
          </button>
        </div>
      </div>
      {blind ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          BLIND: labels omit company letters. In/out is still computed from true company. Downloads contain raw ground-truth fields; on-screen JSON is redacted.
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
        <label className={FIELD}>
          Type
          <select className={SELECT} value={type} onChange={(e) => resetPage(setType)(e.target.value)}>
            <option value="">All</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className={FIELD}>
          Round
          <select className={SELECT} value={round} onChange={(e) => resetPage(setRound)(e.target.value)}>
            <option value="">All</option>
            {rounds.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className={FIELD}>
          Flag
          <select className={SELECT} value={flag} onChange={(e) => resetPage(setFlag)(e.target.value)}>
            <option value="">Any</option>
            {FLAGS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className={FIELD}>
          In/out-group
          <select className={SELECT} value={rel} onChange={(e) => resetPage(setRel)(e.target.value)}>
            <option value="">All</option>
            <option value="in">in</option>
            <option value="out">out</option>
            <option value="none">n/a</option>
          </select>
        </label>
        <label className={`${FIELD} col-span-2 min-w-0 sm:min-w-[12rem] sm:flex-1`}>
          Search text, plans, names
          <input type="search" className={`${SELECT} min-w-0`} value={q} onChange={(e) => resetPage(setQ)(e.target.value)} />
        </label>
        <button type="button" className={`${BTN} col-span-1`} disabled={!filtering} onClick={clearFilters}>Clear filters</button>
        <details className="relative col-span-1">
          <summary className={`${BTN} flex cursor-pointer list-none items-center`}>Columns ({show.size}/{COLUMNS.length})</summary>
          <fieldset className="absolute left-0 z-20 mt-1 grid min-w-44 gap-1 rounded-md border bg-surface-raised p-2 text-xs shadow-lg sm:right-0 sm:left-auto">
            <legend className="sr-only">Visible columns</legend>
            {COLUMNS.map((c) => (
              <label key={c.id} className="flex min-h-7 items-center gap-2">
                <input type="checkbox" checked={show.has(c.id)} disabled={c.id === "seq"} onChange={() => toggleCol(c.id)} className="accent-[var(--primary)]" />
                {c.label}
              </label>
            ))}
          </fieldset>
        </details>
      </div>

      <div className="mt-3 max-h-[70vh] max-w-full overflow-auto rounded-sm border" tabIndex={0} role="region" aria-label="Event table, scrollable">
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">All events; column headers are sort buttons; each sequence number expands the row</caption>
          <thead className="text-muted-foreground">
            <tr>
              {visibleCols.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  aria-sort={c.sort && sort.key === c.sort ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                  className="sticky top-0 z-10 whitespace-nowrap border-b bg-surface-raised px-2 py-1.5 font-normal"
                >
                  {c.sort ? (
                    <button type="button" onClick={() => toggleSort(c.sort as SortKey)} className="underline-offset-2 hover:underline focus-visible:outline-2">
                      {c.label}
                      <span aria-hidden="true">{sort.key === c.sort ? (sort.dir === 1 ? " ^" : " v") : ""}</span>
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => {
              const expanded = open.has(row.e.seq);
              return <EventRow key={row.e.seq} row={row} expanded={expanded} show={show} colCount={visibleCols.length} json={expanded ? jsonFor(row.e) : null} onToggle={toggleOpen} />;
            })}
            {slice.length === 0 ? (
              <tr><td colSpan={visibleCols.length} className="px-2 py-4 text-center text-muted-foreground">No events match.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <nav aria-label="Event table pages" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <button type="button" className={BTN} disabled={cur === 0} onClick={() => setPage(cur - 1)}>Prev</button>
        <span className="order-last w-full text-center tabular-nums text-muted-foreground sm:order-none sm:w-auto" aria-live="polite">
          Page {cur + 1} / {pages} (rows {rows.length ? cur * pageSize + 1 : 0} to {Math.min((cur + 1) * pageSize, rows.length)})
        </span>
        <label className="flex items-center gap-1.5 text-muted-foreground">
          Rows
          <select className={SELECT} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
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
      { name: "Game-score Gini", value: p.wealthGini ? p.wealthGini.toFixed(3) : "n/a", num: "-", note: "needs final scores (not in event log)" },
      { name: "Most connected (distinct partners)", value: p.brokers.length ? p.brokers.map((b) => `${label(b.agentId)} ${b.degree}`).join(", ") : "-", num: "-" },
    ];
    const line = `align ${m.allianceRatio.ratio.toFixed(2)}x, lie ${pct(m.deception.inGroup)}/${pct(m.deception.outGroup)}`;
    return { rows: out, metricLine: line };
  }, [events, agents, label]);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <Pipeline events={events} metricLine={metricLine} />
      <MetricsPanel rows={rows} />
      <EventTable events={events} />
    </div>
  );
}
