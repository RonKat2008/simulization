"use client";
// "What's happening": the Game tab's plain-language feed. It follows the village playback (only events the
// village has shown), newest first, grouped by round and phase. A row opens to show the merchant's thinking.
import { Fragment, useMemo, useState, type KeyboardEvent } from "react";
import type { Event } from "@simulization/shared";
import { describe, PHASE_LABEL, type Beat } from "@/game/narrate";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { claimCheck, isViolation } from "./run-helpers";
import type { RunStatus } from "./use-run-source";

const PAGE = 40;

interface Item {
  e: Event;
  beat: Beat;
  bad: boolean;
  /** World reward lines name one merchant each; consecutive identical ones are merged into one row. */
  targets: string[];
  /** seq of each merged line, parallel to targets. */
  seqs: number[];
}

const NAMES_SHOWN = 3;

type Props = {
  /** Highest event seq the village has shown (Infinity = everything). */
  upto: number;
  status: RunStatus;
  onOpenLog: () => void;
};

function dotTone(it: Item): string {
  if (it.bad) return "bg-violation";
  if (it.e.type === "trade_accept" || it.e.type === "pact_accept" || it.e.type.startsWith("coalition")) return "bg-primary";
  return "bg-border-strong";
}

function Row({ it, open, onToggle, rowIndex }: { it: Item; open: boolean; onToggle: () => void; rowIndex: number }) {
  const { label } = useRun();
  const select = useEventStore((s) => s.select);
  const { e, beat, bad } = it;
  const claim = claimCheck(e);
  const panelId = `happen-${e.seq}`;
  const world = e.actorId === "world";
  const people = world ? it.targets : [e.actorId, e.targetId].filter((x): x is string => !!x);
  const canOpen = Boolean(e.privatePlan) || people.length > 0 || Boolean(claim);
  const names = it.targets.slice(0, NAMES_SHOWN).map(label).join(", ");
  const more = it.targets.length > NAMES_SHOWN ? ` and ${it.targets.length - NAMES_SHOWN} more` : "";
  const base = world && it.targets.length ? `${beat.sentence} for ${names}${more}` : beat.sentence.replace(/(\d+)c$/, "$1 coins");
  const sentence = beat.lie ? `${base}, but it is really quality ${beat.lie.truth}` : base;
  const tag = bad ? (e.flags.includes("lie") ? "lie" : e.type === "steal" ? "theft" : e.type === "caught" ? "caught" : "broke a promise") : null;

  return (
    <li className={`border-b border-border/50 ${bad ? "bg-violation/[0.04]" : ""}`}>
      <button
        type="button"
        data-happen-row={rowIndex}
        aria-expanded={canOpen ? open : undefined}
        aria-controls={canOpen ? panelId : undefined}
        onClick={canOpen ? onToggle : undefined}
        className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-[13px] leading-snug transition-colors hover:bg-surface-raised/60 focus-visible:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <span className={`mt-[5px] size-2 shrink-0 rounded-full ${dotTone(it)}`} aria-hidden="true" />
        <span className={`min-w-0 flex-1 break-words ${open ? "" : "line-clamp-2"} ${bad ? "text-foreground" : "text-foreground/90"}`}>
          {tag ? (
            <span className="mr-1.5 inline-flex h-4 translate-y-[-1px] items-center rounded-sm bg-violation/15 px-1 align-middle text-[10.5px] font-medium text-violation">{tag}</span>
          ) : null}
          {sentence}
        </span>
        {canOpen ? (
          <span aria-hidden="true" className={`mt-0.5 shrink-0 font-mono text-[11px] text-subtle-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`}>
            ›
          </span>
        ) : null}
      </button>
      {open ? (
        <div id={panelId} className="flex flex-col gap-2 px-3 pb-3 pl-[1.6rem] text-xs leading-relaxed">
          {claim && claim.actual !== null ? (
            <p className={bad ? "text-violation" : "text-muted-foreground"}>
              Said the item was quality {claim.claimed}; it was really {claim.actual}. Price {claim.price} coins.
            </p>
          ) : null}
          {e.privatePlan ? (
            <div className="rounded-md border-l-2 border-accent/60 bg-surface-raised/60 px-2.5 py-1.5">
              <p className="mb-0.5 text-[11px] font-medium text-accent">What they were thinking</p>
              <p className="break-words text-foreground/90">{e.privatePlan}</p>
            </div>
          ) : null}
          {people.length ? (
            <p className="flex flex-wrap gap-x-3 gap-y-1">
              {people.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => select(id)}
                  className="rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  About {label(id)} →
                </button>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function HappeningFeed({ upto, status, onOpenLog }: Props) {
  const { label } = useRun();
  const events = useEventStore((s) => s.events);
  const select = useEventStore((s) => s.select);
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const [limit, setLimit] = useState(PAGE);

  // describe() every event once per log/labels change; playback then only slices.
  const all = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const e of events) {
      const beat = describe(e, label);
      if (!beat || beat.ms <= 0) continue;
      const prev = out.at(-1);
      const world = e.actorId === "world" && !!e.targetId;
      if (world && prev && prev.e.actorId === "world" && prev.e.text === e.text && prev.e.round === e.round && prev.e.phase === e.phase) {
        out[out.length - 1] = { ...prev, targets: [...prev.targets, e.targetId!], seqs: [...prev.seqs, e.seq] };
        continue;
      }
      out.push({ e, beat, bad: isViolation(e), targets: world ? [e.targetId!] : [], seqs: world ? [e.seq] : [] });
    }
    return out;
  }, [events, label]);
  const shown = useMemo(
    () =>
      all
        .filter((it) => it.e.seq <= upto)
        .map((it) => (it.seqs.length && it.seqs.at(-1)! > upto ? { ...it, targets: it.targets.filter((_, i) => it.seqs[i]! <= upto) } : it))
        .reverse(),
    [all, upto],
  );
  const page = shown.slice(0, limit);

  const toggle = (seq: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(seq)) next.delete(seq);
      else next.add(seq);
      return next;
    });

  // j/k or arrows move between rows; p toggles the thinking; a/t select actor/target.
  const onKeyDown = (ev: KeyboardEvent<HTMLOListElement>) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const cur = (ev.target as HTMLElement).closest<HTMLElement>("[data-happen-row]");
    if (!cur) return;
    const i = Number(cur.dataset.happenRow);
    const it = page[i];
    const move = (n: number) => {
      ev.preventDefault();
      ev.currentTarget.querySelector<HTMLElement>(`[data-happen-row="${Math.max(0, Math.min(page.length - 1, n))}"]`)?.focus();
    };
    if (ev.key === "j" || ev.key === "ArrowDown") return move(i + 1);
    if (ev.key === "k" || ev.key === "ArrowUp") return move(i - 1);
    if (!it) return;
    if (ev.key === "p") toggle(it.e.seq);
    if (ev.key === "a" && it.e.actorId !== "world") select(it.e.actorId);
    if (ev.key === "t" && it.e.targetId) select(it.e.targetId);
  };

  const waiting = status === "failed" ? "This run stopped before anything happened." : events.length === 0 ? "Waiting for the market to open…" : "The market is about to open. Actions appear here as the village plays them.";

  return (
    <section aria-labelledby="happening-title" className="flex max-h-[70vh] min-h-[16rem] flex-1 flex-col lg:max-h-none lg:min-h-0 overflow-hidden rounded-lg border bg-surface shadow-raised">
      <div className="flex items-baseline justify-between gap-2 border-b px-3 py-2.5">
        <h2 id="happening-title" className="text-[13px] font-semibold tracking-[-0.01em]">
          What&apos;s happening
        </h2>
        <span className="hidden text-[11px] text-subtle-foreground sm:inline">newest first · tap a line for more</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {shown.length === 0 ? (
          <p role="status" className="p-4 text-sm text-muted-foreground">{waiting}</p>
        ) : (
          <ol aria-label="Actions so far, newest first" onKeyDown={onKeyDown}>
            {page.map((it, i) => {
              const prev = page[i - 1]?.e;
              const head = !prev || prev.round !== it.e.round || prev.phase !== it.e.phase;
              return (
                <Fragment key={it.e.seq}>
                  {head ? (
                    <li role="presentation" className="sticky top-0 z-10 border-b bg-surface-raised/95 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
                      Round {it.e.round} · {PHASE_LABEL[it.e.phase]}
                    </li>
                  ) : null}
                  <Row it={it} rowIndex={i} open={open.has(it.e.seq)} onToggle={() => toggle(it.e.seq)} />
                </Fragment>
              );
            })}
          </ol>
        )}
        {shown.length > limit ? (
          <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="w-full px-3 py-2 text-left text-xs text-primary transition-colors hover:bg-surface-raised">
            Show earlier actions
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onOpenLog}
        className="flex min-h-10 items-center justify-between border-t px-3 text-left text-xs text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        Full event log, with filters and search
        <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
