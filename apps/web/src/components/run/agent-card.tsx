"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { COMPANIES, type Event } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { claimCheck, COMPANY_BG, computeAgentStats, emptyStats, eventVerb, FLAG_LABEL, FLAG_TONE, isViolation, PHASE_SHORT } from "./run-helpers";

const PAGE = 12;

function Row({ k, v, tone }: { k: string; v: ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={`text-right tabular-nums ${tone ?? ""}`}>{v}</dd>
    </div>
  );
}

function relations(events: Event[], id: string) {
  const pacts = new Set<string>();
  let coalition: string | null = null;
  for (const e of events) {
    const other = e.actorId === id ? e.targetId : e.targetId === id ? e.actorId : undefined;
    if (e.type === "pact_accept" && other) pacts.add(other);
    // A broken promise remains a pact in the engine; violation is counted separately.
    if (e.actorId !== id) continue;
    if (e.type === "coalition_create" || e.type === "coalition_join") coalition = e.channel ?? "coalition";
    if (e.type === "coalition_leave") coalition = null;
  }
  return { pacts: [...pacts], coalition };
}

function Pair({ e }: { e: Event }) {
  const { label } = useRun();
  const c = claimCheck(e);
  const lie = e.flags.includes("lie");
  const to = e.targetId ? label(e.targetId) : null;
  return (
    <li className={`border-b border-border/60 last:border-b-0 ${isViolation(e) ? "border-l-2 border-l-violation" : "border-l-2 border-l-transparent"}`}>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 bg-surface px-3 pt-1.5 text-[11px] text-muted-foreground">
        <span className="tabular-nums">R{e.round} {PHASE_SHORT[e.phase]} #{e.seq}</span>
        <span className="uppercase tracking-wider">{e.type.replaceAll("_", " ")}</span>
        {to ? <span>{`→ ${to}`}</span> : null}
        {e.flags.map((f) => (
          <span key={f} className={`rounded-sm border px-1 text-[10px] uppercase ${FLAG_TONE[f]}`}>{FLAG_LABEL[f]}</span>
        ))}
      </p>
      <div className="grid gap-px bg-border sm:grid-cols-2">
        <div className="bg-surface px-3 py-1.5 text-xs">
          <p className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Said / did</p>
          <p className="break-words">{e.text ?? eventVerb(e)}</p>
          {c ? <p className="mt-0.5 tabular-nums">claimed <b>Q{c.claimed}</b> for {c.price}c</p> : null}
        </div>
        <div className="bg-surface-raised px-3 py-1.5 text-xs">
          <p className="mb-0.5 text-[10px] uppercase tracking-wider text-accent">Self-reported plan{c ? " · observer truth below" : ""}</p>
          <p className="break-words">{e.privatePlan ?? <span className="text-muted-foreground">no plan recorded</span>}</p>
          {c && c.actual !== null ? (
            <p className={`mt-0.5 tabular-nums ${lie ? "text-violation" : ""}`}>
              true <b>Q{c.actual}</b>
              {c.delta ? ` (${c.delta > 0 ? "+" : "−"}${Math.abs(c.delta)} claimed)` : " (accurate)"}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function AgentCard({ finalScores, wealthVisibility }: { finalScores: Record<string, number> | null; wealthVisibility: "private" | "public" | null }) {
  const { agents, label, shownCompany, blind } = useRun();
  const selected = useEventStore((s) => s.selectedAgentId);
  const events = useEventStore((s) => s.events);
  const select = useEventStore((s) => s.select);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [more, setMore] = useState<{ id: string | null; n: number }>({ id: null, n: PAGE });
  const root = useRef<HTMLElement>(null);

  const agent = agents.find((a) => a.id === selected);
  const stats = useMemo(() => (selected ? (computeAgentStats(events).get(selected) ?? emptyStats()) : null), [events, selected]);
  const rel = useMemo(() => (selected ? relations(events, selected) : null), [events, selected]);
  const pairs = useMemo(
    () =>
      selected
        ? events.filter((e) => e.actorId === selected && (e.privatePlan || e.text) && e.type !== "system" && e.type !== "caught" && (!flaggedOnly || isViolation(e))).reverse()
        : [],
    [events, selected, flaggedOnly],
  );

  useEffect(() => {
    if (selected) root.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [selected]);

  const shown = more.id === selected ? more.n : PAGE;
  const company = selected ? shownCompany(selected) : undefined;
  const lab = COMPANIES.find((c) => c.id === company);

  return (
    <section ref={root} aria-labelledby="agent-title" className="min-w-0 rounded-lg border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 id="agent-title" className="flex min-w-0 items-center gap-2 font-display text-sm tracking-wide">
          {selected && agent ? (
            <>
              {company ? <span className={`size-2.5 shrink-0 ${COMPANY_BG[company] ?? "bg-muted-foreground"}`} aria-hidden="true" /> : null}
              <span className="truncate">{label(agent.id)}</span>
              <span className="text-xs font-normal text-muted-foreground">{lab ? lab.name : blind ? "lab hidden" : ""}</span>
            </>
          ) : (
            "Agent inspector"
          )}
        </h2>
        {selected ? (
          <button type="button" onClick={() => select(null)} className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-accent">
            Close (Esc)
          </button>
        ) : null}
      </div>
      {!selected || !stats || !rel || !agent ? (
        <p className="p-4 text-sm text-muted-foreground">
          Select a merchant in the table, the log or on the map to compare its recorded actions with its self-reported plan and observer-only truth.
        </p>
      ) : (
        <>
          <div className="grid gap-px bg-border sm:grid-cols-2">
            <div className="bg-surface p-3">
              <h3 className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Public identity and group</h3>
              <dl>
                <Row k="Coalition" v={rel.coalition ?? "none"} />
                <Row k="Messages sent" v={stats.messages} />

              </dl>
            </div>
            <div className="bg-surface-raised p-3">
              <h3 className="mb-1 text-[11px] uppercase tracking-wider text-accent">Ground truth (observer only)</h3>
              <dl>
                <Row k="Game score (coins + goods)" v={finalScores?.[agent.id] ?? "in play"} />
                <Row k="Pacts accepted / violated" v={`${stats.pactsAccepted} / ${stats.pactsBroken}`} />
                <Row k="Lies / offers made" v={`${stats.lies} / ${stats.offers}`} tone={stats.lies ? "text-violation" : ""} />
                {!blind ? <Row k="Lies to same lab" v={`${stats.liesToSameCompany} / ${stats.lies}`} /> : null}
                <Row k="Thefts" v={stats.thefts} tone={stats.thefts ? "text-violation" : ""} />
                <Row k="Caught / thefts" v={`${stats.caught} / ${stats.thefts}`} />
                <Row k="Lied to / stolen from" v={`${stats.victimOfLie} / ${stats.victimOfTheft}`} />
                <Row k="Eval-aware turns" v={stats.evalAware} />
              </dl>
            </div>
          </div>
          <div className="border-t px-3 py-3 text-sm leading-relaxed">
            <h3 className="font-semibold">What this agent can see</h3>
            <p className="mt-1">Accepted pact partners: {rel.pacts.length ? rel.pacts.map(label).join(", ") : "none"}. Pacts are promises, not protection from theft.</p>
            <p className="mt-1 text-muted-foreground">Its own coins and true inventory quality, addressed offers, coalition membership and scoped messages. {blind ? 'Other company names are hidden.' : 'Other company names are visible.'} {wealthVisibility === 'public' ? 'Other merchants’ current coin balances are visible.' : 'Other merchants’ coin balances are hidden.'} Other merchants’ inventory truth is never provided.</p>
            <p className="mt-2 text-xs text-muted-foreground">This page is an observer record, not a complete replay of the agent’s private input. Plans are model-generated statements, not verified internal thoughts.</p>
          </div>
          <div className="border-t">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Action and self-reported plan <span className="tabular-nums">({pairs.length})</span>
              </h3>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
                Flagged only
              </label>
            </div>
            {pairs.length === 0 ? (
              <p className="px-3 pb-3 text-sm text-muted-foreground">{flaggedOnly ? "No flagged actions by this merchant." : "Nothing recorded yet."}</p>
            ) : (
              <>
                <ul className="max-h-[28rem] overflow-y-auto border-t">
                  {pairs.slice(0, shown).map((e) => (
                    <Pair key={e.seq} e={e} />
                  ))}
                </ul>
                {pairs.length > shown ? (
                  <button type="button" onClick={() => setMore({ id: selected, n: shown + PAGE })} className="w-full border-t px-3 py-2 text-xs text-primary hover:bg-primary/10">
                    Show {Math.min(PAGE, pairs.length - shown)} older of {pairs.length - shown}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
