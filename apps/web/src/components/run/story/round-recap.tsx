"use client";
// "Round 3 — 5 trades · 1 lie · 2 new pacts" plus up to three headline moments, shown when a round's
// reveal finishes. It collapses to a one-line chip on its own; reopening keeps it until closed.
import { useEffect, useState } from "react";
import { PHASE_LABEL } from "@/game/narrate";
import type { RoundRecapData } from "./moments";

const AUTO_COLLAPSE_MS = 9000;
const BAD_KINDS = new Set(["lie", "caught", "theft", "pact_break"]);

interface Props {
  recap: RoundRecapData;
  /** Collapsed state lives with the parent so a new round reopens the card. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The night is over: label it as the final round. */
  final?: boolean;
}

export function RoundRecap({ recap, open, onOpenChange, final }: Props) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!open || pinned) return;
    const t = setTimeout(() => onOpenChange(false), AUTO_COLLAPSE_MS);
    return () => clearTimeout(t);
  }, [open, pinned, onOpenChange, recap.round]);

  const summary = recap.counts.length ? null : "A quiet round: merchants mostly worked and fed the lantern.";
  const title = `Round ${recap.round}${final ? " (last)" : ""} recap`;

  if (!open)
    return (
      <button
        type="button"
        onClick={() => {
          setPinned(true);
          onOpenChange(true);
        }}
        className="flex min-w-0 max-w-full items-center gap-2 self-start rounded-md border bg-surface px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="font-medium text-foreground">{title}</span>
        <span className="min-w-0 truncate">{recap.counts.map((c) => c.label).join(" · ") || "quiet round"}</span>
        <span aria-hidden>▸</span>
      </button>
    );

  return (
    <section
      aria-label={title}
      className="min-w-0 rounded-md border border-primary/40 bg-surface-raised/60 p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm">
          <span className="font-display tracking-wide">Round {recap.round}</span>
          {final ? <span className="text-muted-foreground"> · the last round</span> : null}
          {recap.counts.length ? (
            <span className="ml-2 inline-flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              {recap.counts.map((c) => (
                <span key={c.label} className={c.bad ? "text-violation" : "text-foreground"}>
                  {c.label}
                </span>
              ))}
            </span>
          ) : null}
        </h3>
        <button
          type="button"
          onClick={() => {
            setPinned(false);
            onOpenChange(false);
          }}
          aria-label="Collapse round recap"
          className="-m-1 shrink-0 rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          Hide
        </button>
      </div>
      {summary ? <p className="mt-1.5 text-xs text-muted-foreground">{summary}</p> : null}
      {recap.headlines.length ? (
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {recap.headlines.map((m) => (
            <li key={m.id} className="flex min-w-0 items-baseline gap-2">
              <span aria-hidden className={`mt-1 size-1.5 shrink-0 self-start rounded-full ${BAD_KINDS.has(m.kind) ? "bg-violation" : "bg-primary"}`} />
              <span className={`min-w-0 break-words ${BAD_KINDS.has(m.kind) ? "text-violation" : ""}`}>{m.sentence}</span>
              <span className="ml-auto hidden shrink-0 text-[10px] uppercase tracking-wider text-subtle-foreground sm:inline">{PHASE_LABEL[m.phase]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
