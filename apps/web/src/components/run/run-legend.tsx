"use client";
import Link from "next/link";
import { useRun } from "./run-context";

export const SHORTCUTS: [string, string][] = [
  ["j / k", "next / previous event"],
  ["[ / ]", "step through merchants"],
  ["/", "search the log"],
  ["Enter or p", "show self-reported plan"],
  ["a / t", "select actor / target"],
  ["Esc", "deselect"],
  ["?", "show or hide this guide"],
];

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded-sm border border-b-2 bg-surface-raised px-1.5 py-px font-display text-[11px] text-foreground">{children}</kbd>;
}

function Chip({ tone, children }: { tone: string; children: string }) {
  return <span className={`rounded-sm border px-1.5 py-px text-[10px] uppercase tracking-wider ${tone}`}>{children}</span>;
}

/** Dismissible "what you're looking at" guide. BLIND never mentions company names or colors. */
export function RunLegend({ onClose }: { onClose: () => void }) {
  const { blind, condition, agents } = useRun();
  const merchants = agents.length;

  return (
    <section aria-labelledby="legend-title" className="border-b border-primary/30 bg-primary/5">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-2.5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="legend-title" className="font-display text-sm tracking-wide">
            Guide
            <Link
              href="/how-it-works"
              target="_blank"
              className="ml-3 rounded-sm font-sans text-xs font-normal tracking-normal text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              New here? How the game works<span className="sr-only"> (opens in a new tab)</span>
            </Link>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss guide"
            className="-m-1 rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary active:bg-border"
          >
            Hide ×
          </button>
        </div>
        <div className="grid gap-x-6 gap-y-2 text-xs leading-relaxed text-muted-foreground md:grid-cols-3">
          <p>
            <span className="text-foreground">{merchants > 0 ? `${merchants} AI merchants` : "AI merchants"}</span> trade, pact and sometimes cheat.{" "}
            {condition ? (
              blind ? (
                <>
                  <span className="text-accent">BLIND</span>: labels and colors hidden.
                </>
              ) : (
                <>
                  <span className="text-primary">LABELED</span>: squares mark the lab (A blue, B amber, C teal).
                </>
              )
            ) : null}
          </p>
          <p>
            <Chip tone="border-violation/70 bg-violation/10 text-violation">Red</Chip> = violation verified by the simulator.{" "}
            <Chip tone="border-accent/60 text-accent">Pink</Chip> = mentions a test.
          </p>
          <ul aria-label="Keyboard shortcuts" className="hidden flex-wrap content-start gap-x-3 gap-y-1.5 sm:flex">
            {SHORTCUTS.map(([k, d]) => (
              <li key={k} className="flex items-baseline gap-1.5">
                <Kbd>{k}</Kbd>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
