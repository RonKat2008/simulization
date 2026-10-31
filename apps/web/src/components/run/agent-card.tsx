"use client";
import { useMemo, type ReactNode } from "react";
import { COMPANIES, type Event } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { COMPANY_BG } from "./run-helpers";

const RECENT_PLANS = 5;

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </div>
  );
}

function summarize(events: Event[], id: string) {
  const mine = events.filter((e) => e.actorId === id);
  const pacts = new Set<string>();
  let coalition: string | null = null;
  for (const e of events) {
    if (e.type === "pact_accept" && (e.actorId === id || e.targetId === id)) {
      pacts.add((e.actorId === id ? e.targetId : e.actorId) ?? "");
    }
    if (e.type === "pact_break" && (e.actorId === id || e.targetId === id)) {
      pacts.delete((e.actorId === id ? e.targetId : e.actorId) ?? "");
    }
    if (e.actorId !== id) continue;
    if (e.type === "coalition_create" || e.type === "coalition_join") coalition = e.channel ?? "coalition";
    if (e.type === "coalition_leave") coalition = null;
  }
  const offers = mine.filter((e) => e.type === "trade_offer" && e.claim);
  return {
    messages: mine.filter((e) => e.type === "message").length,
    offers,
    lies: mine.filter((e) => e.flags.includes("lie")).length,
    thefts: mine.filter((e) => e.type === "steal").length,
    caught: mine.filter((e) => e.type === "caught").length,
    brokenPacts: mine.filter((e) => e.type === "pact_break").length,
    evalAware: mine.filter((e) => e.flags.includes("eval_aware")).length,
    pacts: [...pacts].filter(Boolean),
    coalition,
    plans: mine.filter((e) => e.privatePlan).slice(-RECENT_PLANS).reverse(),
  };
}

export function AgentCard({ finalScores }: { finalScores: Record<string, number> | null }) {
  const { agents, label, shownCompany, blind } = useRun();
  const selected = useEventStore((s) => s.selectedAgentId);
  const events = useEventStore((s) => s.events);
  const select = useEventStore((s) => s.select);
  const info = useMemo(() => (selected ? summarize(events, selected) : null), [events, selected]);
  const agent = agents.find((a) => a.id === selected);
  const company = selected ? shownCompany(selected) : undefined;
  const lab = COMPANIES.find((c) => c.id === company);

  return (
    <section aria-labelledby="agent-title" className="rounded-lg border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 id="agent-title" className="font-display text-base tracking-wide">
          Agent card
        </h2>
        {selected ? (
          <button type="button" onClick={() => select(null)} className="text-xs text-muted-foreground transition-colors hover:text-accent">
            Close
          </button>
        ) : null}
      </div>
      {!selected || !info || !agent ? (
        <p className="p-4 text-sm text-muted-foreground">Select a merchant on the map, in the roster or in the feed to inspect it.</p>
      ) : (
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="bg-surface p-3">
            <h3 className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <span className="size-1.5 bg-primary" aria-hidden="true" /> Public
            </h3>
            <p className="mb-2 flex items-center gap-2 font-display text-lg">
              {company ? <span className={`size-2.5 ${COMPANY_BG[company] ?? "bg-muted-foreground"}`} aria-hidden="true" /> : null}
              {label(agent.id)}
            </p>
            <dl>
              {lab ? <Row k="Lab" v={lab.name} /> : <Row k="Lab" v={blind ? "hidden (BLIND)" : "unknown"} />}
              <Row k="Final score" v={finalScores?.[agent.id] ?? "in play"} />
              <Row k="Coalition" v={info.coalition ?? "none"} />
              <Row k="Pacts" v={info.pacts.length ? info.pacts.map(label).join(", ") : "none"} />
              <Row k="Messages sent" v={info.messages} />
              <Row k="Pacts broken" v={info.brokenPacts} />
              <Row k="Caught stealing" v={info.caught} />
            </dl>
          </div>
          <div className="bg-surface-raised p-3">
            <h3 className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-accent">
              <span className="size-1.5 bg-accent" aria-hidden="true" /> Private (hidden from other agents)
            </h3>
            <dl>
              <Row k="Lies told" v={<span className={info.lies ? "text-lab-b" : ""}>{info.lies}</span>} />
              <Row k="Thefts" v={<span className={info.thefts ? "text-violation" : ""}>{info.thefts}</span>} />
              <Row k="Eval-aware turns" v={info.evalAware} />
            </dl>
            {info.offers.length ? (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Goods offered (claimed vs true)</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {info.offers.map((o) => {
                    const lie = o.flags.includes("lie");
                    return (
                      <li key={o.seq} className={`rounded-sm border px-1.5 py-0.5 text-xs tabular-nums ${lie ? "border-lab-b/60 text-lab-b" : ""}`}>
                        {o.claim?.claimedQuality} / {o.groundTruth?.trueQuality ?? "?"}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">Recent private plans</p>
            {info.plans.length ? (
              <ul className="mt-1 space-y-1.5">
                {info.plans.map((p) => (
                  <li key={p.seq} className="border-l-2 border-accent/50 pl-2 text-xs leading-relaxed">
                    <span className="text-muted-foreground">R{p.round} {p.phase}: </span>
                    {p.privatePlan}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">No private notes recorded.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
