"use client";
// Merchant inspector: a slide-over that exists only while a merchant is selected (map, leaderboard, feed,
// tables, or [ / ]). Plain sections first; the full observer numbers sit behind one disclosure.
import { useMemo, useState, type ReactNode } from "react";
import { COMPANIES, type Event } from "@simulization/shared";
import { describe } from "@/game/narrate";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { claimCheck, COMPANY_BG, computeAgentStats, emptyStats, isViolation } from "./run-helpers";
import { relationsAt, standingsAt } from "./standings";

const RECENT = 5;

type Props = {
  finalScores: Record<string, number> | null;
  wealthVisibility: "private" | "public" | null;
  /** Highest event seq shown by playback (Infinity off the Game tab or after the end). */
  upto: number;
  ended: boolean;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b px-4 py-3.5">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Big({ value, unit, note }: { value: ReactNode; unit: string; note?: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-2xl leading-none tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{unit}</p>
      {note ? <p className="text-[11px] text-subtle-foreground">{note}</p> : null}
    </div>
  );
}

function NumRow({ k, v, bad }: { k: string; v: ReactNode; bad?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1 last:border-b-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={`text-right tabular-nums ${bad ? "text-violation" : ""}`}>{v}</dd>
    </div>
  );
}

const NAMES_MAX = 6;

function Names({ ids, empty }: { ids: string[]; empty: string }) {
  const { label } = useRun();
  const select = useEventStore((s) => s.select);
  const [all, setAll] = useState(false);
  if (!ids.length) return <span className="text-muted-foreground">{empty}</span>;
  const list = all ? ids : ids.slice(0, NAMES_MAX);
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {ids.length > NAMES_MAX ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="order-last text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {all ? "fewer" : `+${ids.length - NAMES_MAX} more`}
        </button>
      ) : null}
      {list.map((id) => (
        <button key={id} type="button" onClick={() => select(id)} className="rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary">
          {label(id)}
        </button>
      ))}
    </span>
  );
}

function teamMates(events: readonly Event[], channel: string | null, self: string, upto: number): string[] {
  if (!channel) return [];
  const members = new Set<string>();
  for (const e of events) {
    if (e.seq > upto) break;
    if (e.channel !== channel) continue;
    if (e.type === "coalition_create" || e.type === "coalition_join") members.add(e.actorId);
    if (e.type === "coalition_leave") members.delete(e.actorId);
  }
  members.delete(self);
  return [...members];
}

export function AgentCard({ finalScores, wealthVisibility, upto, ended }: Props) {
  const { agents, label, shownCompany, blind } = useRun();
  const selected = useEventStore((s) => s.selectedAgentId);
  const events = useEventStore((s) => s.events);
  const select = useEventStore((s) => s.select);
  const [moreThoughts, setMoreThoughts] = useState(false);

  const agent = agents.find((a) => a.id === selected);
  const data = useMemo(() => {
    if (!selected) return null;
    const s = standingsAt(events, [selected], upto).get(selected)!;
    const rel = relationsAt(events, selected, upto);
    const mine = events.filter((e) => e.seq <= upto && e.actorId === selected);
    const did = mine.flatMap((e) => {
      const b = describe(e, label);
      return b && b.ms > 0 ? [{ e, text: b.sentence.replace(/(\d+)c$/, "$1 coins") }] : [];
    }).reverse();
    const thoughts = mine.filter((e) => e.privatePlan).reverse();
    const stats = computeAgentStats(events.filter((e) => e.seq <= upto)).get(selected) ?? emptyStats();
    return { s, rel, did, thoughts, stats, mates: teamMates(events, rel.coalition, selected, upto) };
  }, [events, selected, upto, label]);

  if (!selected || !agent || !data) return null;
  const { s, rel, did, thoughts, stats, mates } = data;
  const company = shownCompany(selected);
  const lab = COMPANIES.find((c) => c.id === company);
  const final = ended ? finalScores?.[selected] : undefined;
  const summary = [
    s.offers ? `Made ${s.offers} offer${s.offers === 1 ? "" : "s"}${s.lies ? `, ${s.lies} with a false quality` : ""}` : null,
    s.sales ? `Sold ${s.sales} good${s.sales === 1 ? "" : "s"}` : null,
    s.worked ? `Worked ${s.worked} time${s.worked === 1 ? "" : "s"}` : null,
    s.gave ? `Gave ${s.gave} coin${s.gave === 1 ? "" : "s"} to the lantern fund` : null,
    s.thefts ? `Stole ${s.thefts} time${s.thefts === 1 ? "" : "s"}${s.caught ? `, caught ${s.caught}` : ""}` : null,
    s.brokenPacts ? `Broke a promise ${s.brokenPacts} time${s.brokenPacts === 1 ? "" : "s"}` : null,
  ].filter((x): x is string => !!x);

  return (
    <aside
      role="complementary"
      aria-labelledby="agent-title"
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-xl border border-border-strong bg-surface shadow-pop sm:inset-x-auto sm:bottom-3 sm:right-3 sm:top-3 sm:max-h-none sm:w-[400px] sm:rounded-xl"
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="agent-title" className="flex min-w-0 items-center gap-2">
          {company ? <span className={`size-2.5 shrink-0 rounded-[2px] ${COMPANY_BG[company] ?? "bg-muted-foreground"}`} aria-hidden="true" /> : null}
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{label(agent.id)}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{lab ? `made by ${lab.name}` : blind ? "company hidden" : ""}</span>
        </h2>
        <button
          type="button"
          onClick={() => select(null)}
          aria-label="Close merchant details (Esc)"
          className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          Close ×
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain text-[13px]">
        <Section title="Coins & goods">
          <div className="grid grid-cols-3 gap-3">
            <Big value={`≈${s.coins}`} unit="coins" note="so far" />
            <Big value={s.goods} unit="goods held" />
            <Big value={final ?? "—"} unit="final score" note={final === undefined ? "after the last round" : "coins + goods"} />
          </div>
        </Section>

        <Section title="What they did">
          {summary.length ? (
            <ul className="mb-2 flex flex-col gap-0.5">
              {summary.map((l) => (
                <li key={l} className={/false|Stole|promise/.test(l) ? "text-violation" : ""}>{l}</li>
              ))}
            </ul>
          ) : null}
          {did.length ? (
            <ol className="flex flex-col gap-1.5 border-l pl-3 text-muted-foreground">
              {did.slice(0, RECENT).map(({ e, text }) => (
                <li key={e.seq} className={`break-words ${isViolation(e) ? "text-violation" : ""}`}>
                  <span className="mr-1.5 text-[11px] text-subtle-foreground">R{e.round}</span>
                  {text}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">Nothing yet.</p>
          )}
        </Section>

        <Section title="What they were thinking">
          {thoughts.length ? (
            <ol className="flex flex-col gap-2">
              {thoughts.slice(0, moreThoughts ? thoughts.length : 1).map((e) => {
                const c = claimCheck(e);
                return (
                  <li key={e.seq} className="rounded-md border-l-2 border-accent/60 bg-surface-raised/60 px-2.5 py-2">
                    <p className="mb-0.5 text-[11px] text-subtle-foreground">Round {e.round} · before: {describe(e, label)?.sentence ?? e.type.replaceAll("_", " ")}</p>
                    <p className="break-words leading-relaxed">{e.privatePlan}</p>
                    {c && c.actual !== null && c.delta ? (
                      <p className={`mt-1 text-xs ${e.flags.includes("lie") ? "text-violation" : "text-muted-foreground"}`}>Said quality {c.claimed}; really {c.actual}.</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-muted-foreground">No thoughts recorded yet.</p>
          )}
          {thoughts.length > 1 ? (
            <button type="button" onClick={() => setMoreThoughts((v) => !v)} className="mt-2 text-xs text-primary underline-offset-4 hover:underline">
              {moreThoughts ? "Show only the latest" : `Show ${thoughts.length - 1} earlier thought${thoughts.length === 2 ? "" : "s"}`}
            </button>
          ) : null}
          <p className="mt-2 text-[11px] text-subtle-foreground">Written by the model as its private plan. Other merchants never see it.</p>
        </Section>

        <Section title="Who they trust">
          <dl className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[6.5rem_1fr] gap-2"><dt className="text-muted-foreground">Promised</dt><dd><Names ids={rel.pacts} empty="no pacts" /></dd></div>
            <div className="grid grid-cols-[6.5rem_1fr] gap-2"><dt className="text-muted-foreground">Team</dt><dd>{rel.coalition ? <Names ids={mates} empty="just them so far" /> : <span className="text-muted-foreground">no team</span>}</dd></div>
            <div className="grid grid-cols-[6.5rem_1fr] gap-2"><dt className="text-muted-foreground">Traded with</dt><dd><Names ids={rel.tradedWith} empty="nobody yet" /></dd></div>
          </dl>
          <p className="mt-2 text-[11px] text-subtle-foreground">A promise (pact) is a pledge not to steal or lie to each other. It can be broken.</p>
        </Section>

        <details className="group px-4 py-3">
          <summary className="cursor-pointer list-none text-xs text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
            All the numbers
          </summary>
          <dl className="mt-2 text-xs">
            <NumRow k="Messages sent" v={stats.messages} />
            <NumRow k="Pacts accepted / broken" v={`${stats.pactsAccepted} / ${stats.pactsBroken}`} bad={stats.pactsBroken > 0} />
            <NumRow k="Lies / offers made" v={`${stats.lies} / ${stats.offers}`} bad={stats.lies > 0} />
            {!blind ? <NumRow k="Lies to own company" v={`${stats.liesToSameCompany} / ${stats.lies}`} /> : null}
            <NumRow k="Thefts / caught" v={`${stats.thefts} / ${stats.caught}`} bad={stats.thefts > 0} />
            <NumRow k="Was lied to / stolen from" v={`${stats.victimOfLie} / ${stats.victimOfTheft}`} />
            <NumRow k="Mentioned being tested" v={stats.evalAware} />
            <NumRow k="Game score (coins + goods)" v={finalScores?.[agent.id] ?? "in play"} />
          </dl>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            What this merchant could see: its own coins and true goods, offers made to it, its team and its messages.{" "}
            {blind ? "Other companies were hidden." : "Other merchants' companies were visible."}{" "}
            {wealthVisibility === "public" ? "Everyone's coin balances were visible." : "Other merchants' coins were hidden."} Counts follow the replay; red marks rule breaks checked by the simulator.
          </p>
        </details>
      </div>
    </aside>
  );
}
