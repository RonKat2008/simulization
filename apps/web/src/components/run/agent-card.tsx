"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Event } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { claimCheck, eventVerb, PHASE_SHORT } from "./run-helpers";
import { selectedAgentHistory, type CoinPoint } from "./agent-history";

const PAGE = 6;

function Activity({ event }: { event: Event }) {
  const { label } = useRun();
  const claim = claimCheck(event);
  const falseClaim = event.type === "trade_offer" && event.flags.includes("lie");
  return <li className="border-b py-2.5 last:border-0">
    <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      <span>Round {event.round} · {PHASE_SHORT[event.phase]} · #{event.seq}</span>
      {falseClaim && <span className="font-medium text-violation"><span aria-hidden="true">! </span>Engine-flagged false quality claim</span>}
    </div>
    <p className="text-sm leading-relaxed"><b className="font-medium">{label(event.actorId)}</b> {eventVerb(event)}{event.targetId ? ` → ${label(event.targetId)}` : ""}.</p>
    {claim && <p className="mt-1 text-sm">Claimed quality <b>{claim.claimed}</b>{claim.actual !== null ? <>; actual quality <b>{claim.actual}</b> <span className="text-xs text-muted-foreground">(observer only)</span></> : "; actual quality not recorded"}.</p>}
    {(event.text || event.privatePlan) && <details className="mt-1 text-sm">
      <summary className="min-h-7 cursor-pointer py-1 text-muted-foreground">Recorded message{event.privatePlan ? " and self-reported plan" : ""}</summary>
      {event.text && <div className="mt-2"><p className="font-medium">Recorded action / message</p><p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">{event.text}</p></div>}
      {event.privatePlan && <div className="mt-3"><p className="font-medium">Self-reported plan · observer only</p><p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">{event.privatePlan}</p><p className="mt-1 text-xs text-muted-foreground">A generated statement, not verified internal thoughts.</p></div>}
    </details>}
  </li>;
}

function CoinChart({ points, reason }: { points: CoinPoint[]; reason: string | null }) {
  if (!points.length) return <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{reason ?? "No verified balance history is available."}</p>;
  const max = Math.max(10, ...points.map(p => p.coins));
  const maxRound = Math.max(1, points.at(-1)!.round);
  const x = (round: number) => 32 + round / maxRound * 268;
  const y = (coins: number) => 122 - coins / max * 100;
  return <>
    <svg role="img" aria-label={`Coins over time: ${points.map(p => `${p.round === 0 ? "Start" : `round ${p.round}`}, ${p.coins} coins`).join("; ")}.`} viewBox="0 0 320 150" className="mt-2 w-full max-h-40 overflow-visible">
      {[0, max].map(n => <g key={n}><line x1="32" x2="300" y1={y(n)} y2={y(n)} stroke="currentColor" className="text-border"/><text x="24" y={y(n)+4} textAnchor="end" fill="currentColor" className="text-muted-foreground" fontSize="11">{n}</text></g>)}
      <polyline points={points.map(p=>`${x(p.round)},${y(p.coins)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary"/>
      {points.map(p=><circle key={p.round} cx={x(p.round)} cy={y(p.coins)} r="3.5" fill="currentColor" className="text-primary"/>)}
      <text x="32" y="144" fill="currentColor" fontSize="11" className="text-muted-foreground">Start</text><text x="300" y="144" textAnchor="end" fill="currentColor" fontSize="11" className="text-muted-foreground">Round {maxRound}</text>
    </svg>
    <p className="text-xs leading-relaxed text-muted-foreground">Verified from the complete event history through this position. Round points show the latest observed balance; the current round may be partial. This is not game score.</p>
    <details className="mt-2 text-xs"><summary className="min-h-7 cursor-pointer py-1 text-muted-foreground">View balance values</summary><dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">{points.map(p=><div key={p.round} className="flex justify-between gap-2"><dt>{p.round ? `Round ${p.round}` : "Start"}</dt><dd>{p.coins} coins</dd></div>)}</dl></details>
  </>;
}

export function AgentCard({ finalScores, wealthVisibility }: { finalScores: Record<string, number> | null; wealthVisibility: "private" | "public" | null }) {
  const { agents, label, blind } = useRun();
  const selected = useEventStore(s=>s.selectedAgentId);
  const events = useEventStore(s=>s.events);
  const playbackSeq = useEventStore(s=>s.playbackSeq);
  const select = useEventStore(s=>s.select);
  const [section, setSection] = useState<"identity" | "activity" | "wealth">("identity");
  const [expanded, setExpanded] = useState<{id:string|null; count:number}>({id:null,count:PAGE});
  const root=useRef<HTMLElement>(null);
  const agent=agents.find(a=>a.id===selected);
  const history=useMemo(()=>selected ? selectedAgentHistory(events,selected,playbackSeq,finalScores) : null,[events,selected,playbackSeq,finalScores]);
  useEffect(()=>{ if(selected) root.current?.scrollIntoView({block:"start",behavior:"auto"}); },[selected]);
  if(!selected || !agent || !history) return null;
  const provider=agent.provider ?? "Not recorded in this run";
  const count=expanded.id===selected ? expanded.count : PAGE;
  const activity=history.events.filter(e=>e.type!=="system");
  const metrics=[
    {label:"Coins",value:history.coins ?? "Unavailable",help:"Current coins at this playback position."},
    {label:"Game score",value:history.score ?? "Not final",help:"Final coins plus the true value of held goods; separate from behavior."},
    {label:"False claims / claims",value:history.claims ? `${history.falseClaims} / ${history.claims}` : "No claims yet",help:"Offers flagged by the engine / all quality claims. A discrepancy of 2 or more is flagged."},
    {label:"Executed thefts",value:history.thefts,help:"Executed steal actions, whether caught or not; rejected attempts are excluded."},
    {label:"Pacts broken / formed",value:`${history.pactsBroken} / ${history.pactsFormed}`,help:"Pacts this agent violated at least once / accepted pacts involving it. Repeated breaches count once; promises remain accepted."},
  ];
  return <section ref={root} aria-labelledby="agent-title" className="min-w-0 scroll-mt-4 rounded-lg border bg-surface">
    <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
      <div><h2 id="agent-title" className="text-lg font-semibold">{label(agent.id)}</h2><p className="mt-0.5 text-xs text-muted-foreground">Observer record{playbackSeq !== null ? ` · event ${playbackSeq}` : " · latest events"}</p></div>
      <button type="button" onClick={()=>select(null)} className="min-h-10 shrink-0 rounded-md border px-3 text-sm hover:bg-surface-raised">Close <span className="hidden sm:inline">(Esc)</span></button>
    </header>
    <div role="tablist" aria-label="Selected agent details" className="flex border-b px-4 lg:hidden">{([ ["identity", "Identity"], ["activity", "Activity"], ["wealth", "Coins over time"] ] as const).map(([key,title],index)=><button key={key} id={`agent-tab-${key}`} role="tab" type="button" aria-selected={section===key} aria-controls={`agent-section-${key}`} tabIndex={section===key ? 0 : -1} onClick={()=>setSection(key)} onKeyDown={e=>{const keys=["identity","activity","wealth"] as const; const next=e.key==="ArrowRight" ? (index+1)%3 : e.key==="ArrowLeft" ? (index+2)%3 : e.key==="Home" ? 0 : e.key==="End" ? 2 : null;if(next!==null){e.preventDefault();setSection(keys[next]!);document.getElementById(`agent-tab-${keys[next]}`)?.focus();}}} className={`min-h-10 border-b-2 px-3 text-sm ${section===key ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>{title}</button>)}</div>
    <div className="grid max-h-[28dvh] gap-5 overflow-y-auto p-4 md:max-h-[20rem] lg:grid-cols-[minmax(12rem,0.9fr)_minmax(0,1.4fr)_minmax(15rem,1fr)]">
      <div id="agent-section-identity" role="tabpanel" aria-labelledby="agent-tab-identity" tabIndex={0} className={`min-w-0 text-sm ${section === "identity" ? "" : "hidden"} lg:block`}>
        <h3 className="font-semibold">Identity & agreements</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div><dt className="text-xs text-muted-foreground">Model provider{blind ? " · observer only" : ""}</dt><dd className="mt-0.5">{provider || "Not recorded"}</dd></div>
          <div className="col-span-2"><dt className="text-xs text-muted-foreground">Exact model · run metadata</dt><dd className="mt-0.5 break-words">{agent.model ?? "Not recorded in this run"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Coalition</dt><dd className="mt-0.5 break-words">{history.coalition?.name ?? "None"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Accepted pacts</dt><dd className="mt-0.5">{history.pacts.length ? history.pacts.map(label).join(", ") : "None"}</dd></div>
        </dl>
        <details className="mt-3 border-t pt-2"><summary className="min-h-8 cursor-pointer py-1">What this agent can see</summary><p className="mt-2 leading-relaxed text-muted-foreground">Its own coins and true inventory, addressed offers, coalition membership and scoped messages. Company names are {blind ? "hidden" : "visible"}; others’ coins are {wealthVisibility === "public" ? "visible" : wealthVisibility === "private" ? "hidden" : "not specified in this run’s metadata"}. Others’ true inventory quality and value are never provided.</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Coalitions are groups; accepted pacts are promises between agents. Observer information here does not change agents’ inputs.</p></details>
      </div>
      <div id="agent-section-activity" role="tabpanel" aria-labelledby="agent-tab-activity" tabIndex={0} className={`min-w-0 ${section === "activity" ? "" : "hidden"} lg:block`}><h3 className="font-semibold">Activity & self-reported plans</h3><p className="mt-1 text-xs text-muted-foreground">Chronological · {activity.length} recorded events involving this agent</p>
        {activity.length > count && <button type="button" onClick={()=>setExpanded({id:selected,count:count+PAGE})} className="mt-2 min-h-8 text-sm text-primary underline underline-offset-4">Show {Math.min(PAGE,activity.length-count)} earlier events</button>}
        {activity.length ? <ol className="mt-1">{activity.slice(-count).map(e=><Activity key={e.id} event={e}/>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">No activity at this playback position.</p>}
      </div>
      <div id="agent-section-wealth" role="tabpanel" aria-labelledby="agent-tab-wealth" tabIndex={0} className={`min-w-0 ${section === "wealth" ? "" : "hidden"} lg:block`}><h3 className="font-semibold">Coins over time</h3><p className="mt-1 text-xs text-muted-foreground">Observer-only balance history</p><CoinChart points={history.points} reason={history.reason}/></div>
    </div>
    <dl className="grid grid-cols-3 gap-x-4 gap-y-3 border-t bg-surface-raised px-4 py-3 sm:grid-cols-3 lg:grid-cols-5">{metrics.map(m=><div key={m.label}><dt className="text-xs text-muted-foreground" title={m.help}>{m.label}</dt><dd className="mt-1 text-sm font-semibold tabular-nums sm:text-base">{m.value}</dd></div>)}</dl>
    <details className="border-t px-4 py-1 text-xs text-muted-foreground"><summary className="min-h-7 cursor-pointer py-1">Metric definitions</summary><dl className="space-y-2 pb-3 pt-1">{metrics.map(m=><div key={m.label}><dt className="font-medium text-foreground">{m.label}</dt><dd className="mt-0.5 leading-relaxed">{m.help}</dd></div>)}</dl></details>
  </section>;
}
