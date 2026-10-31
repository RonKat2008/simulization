"use client";
import { memo, useId } from "react";
import type { Event } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { claimCheck, COMPANY_BG, eventVerb, FLAG_LABEL, FLAG_TONE, isViolation, PHASE_SHORT } from "./run-helpers";

function AgentRef({ id, company }: { id: string; company: string | undefined }) {
  const { label } = useRun();
  const select = useEventStore((s) => s.select);
  const on = useEventStore((s) => s.selectedAgentId === id);
  if (id === "world") return <span className="text-muted-foreground">World</span>;
  return (
    <button
      type="button"
      data-agent-ref
      onClick={(ev) => {
        ev.stopPropagation();
        select(id);
      }}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-sm px-1 font-display underline-offset-2 hover:underline ${on ? "bg-primary/20" : ""}`}
    >
      {company ? <span className={`size-2 ${COMPANY_BG[company] ?? "bg-muted-foreground/40"}`} aria-hidden="true" /> : null}
      {label(id)}
    </button>
  );
}

function ClaimLine({ e }: { e: Event }) {
  const {label}=useRun();
  const c = claimCheck(e);
  if (!c) return null;
  const lie = e.flags.includes("lie");
  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs tabular-nums">
      <span>{e.type === "trade_offer" ? `${label(e.actorId)} offered an item` : "The referenced offer described an item"} as quality {c.claimed}; its actual quality was {c.actual ?? "not recorded"}. <span className="text-muted-foreground">Observer-only check.</span></span>
      <span>
        claimed <b className="font-semibold">Q{c.claimed}</b>
      </span>
      <span>
        true <b className="font-semibold">{c.actual === null ? "unknown" : `Q${c.actual}`}</b>
      </span>
      {c.delta !== null && c.delta !== 0 ? (
        <span className={lie || c.misstated ? "text-violation" : "text-muted-foreground"}>
          {c.delta > 0 ? "+" : "−"}
          {Math.abs(c.delta)}
          {lie ? " LIE" : c.misstated ? " misstated" : ""}
        </span>
      ) : (
        <span className="text-muted-foreground">{c.actual === null ? "truth unavailable" : "accurate"}</span>
      )}
      <span className="text-muted-foreground">{c.price}c</span>
    </p>
  );
}

interface Props {
  e: Event;
  index: number;
  active: boolean;
  open: boolean;
  onToggle: (seq: number) => void;
  onActivate: (index: number) => void;
}

function EventRowImpl({ e, index, active, open, onToggle, onActivate }: Props) {
  const { shownCompany } = useRun();
  const planId = useId();
  const world = e.actorId === "world";
  const hasPlan = Boolean(e.privatePlan);
  const verb = eventVerb(e);
  const viol = isViolation(e);
  const speech = e.text && (e.type === "message" || e.type === "trade_offer" || e.type === "trade_accept" || e.type === "trade_decline");
  // System/caught text is narration, not an agent statement.
  const narration = !speech && e.text;

  return (
    <li
      id={`ev-${e.seq}`}
      data-row-index={index}
      tabIndex={active ? 0 : -1}
      onFocus={() => onActivate(index)}
      className={`border-b border-border/60 px-3 py-2 text-sm outline-none focus-visible:bg-primary/10 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary ${
        viol ? "border-l-2 border-l-violation bg-violation/5" : "border-l-2 border-l-transparent"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
        <span className="tabular-nums text-muted-foreground" title={`event #${e.seq}`}>
          R{e.round} {PHASE_SHORT[e.phase] ?? e.phase} #{e.seq}
        </span>
        <span className="rounded-sm bg-surface-raised px-1.5 py-px text-[10px] uppercase tracking-wider text-muted-foreground">
          {e.type.replaceAll("_", " ")}
        </span>
        {e.flags.map((f) => (
          <span key={f} className={`rounded-sm border px-1.5 py-px text-[10px] uppercase tracking-wider ${FLAG_TONE[f]}`}>
            {FLAG_LABEL[f]}
          </span>
        ))}
      </div>

      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <AgentRef id={e.actorId} company={world ? undefined : shownCompany(e.actorId)} />
        {e.targetId ? (
          <>
            <span className="text-muted-foreground" aria-label={verb}>{`→`}</span>
            <AgentRef id={e.targetId} company={shownCompany(e.targetId)} />
          </>
        ) : null}
        <span className="text-xs text-muted-foreground">{verb}</span>
      </p>

      {speech ? <p className="mt-1 break-words border-l-2 border-primary/40 pl-2">{e.text}</p> : null}
      {narration ? <p className="mt-1 break-words text-muted-foreground">{e.text}</p> : null}
      <ClaimLine e={e} />

      {hasPlan ? (
        <div className="mt-1.5">
          <button
            type="button"
            data-plan-toggle
            aria-expanded={open}
            aria-controls={planId}
            onClick={() => onToggle(e.seq)}
            className="text-xs text-accent underline-offset-2 hover:underline"
          >
            {open ? "Hide self-reported plan" : "Show self-reported plan"}
          </button>
          {open ? (
            <div id={planId} className="mt-1.5 grid gap-px bg-border sm:grid-cols-2">
              <div className="bg-surface p-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Recorded statement (channel-scoped)</p>
                <p className="break-words text-xs">{e.text ?? "(none: action only)"}</p>
              </div>
              <div className="bg-surface-raised p-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-accent">Self-reported plan · observer only</p>
                <p className="break-words text-xs">{e.privatePlan}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export const EventRow = memo(EventRowImpl);
