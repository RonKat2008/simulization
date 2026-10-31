"use client";
import Link from "next/link";
import { useRun } from "./run-context";

export const SHORTCUTS: [string, string][] = [
  ["[ / ]", "step through merchants"],
  ["Tab", "move between controls"],
  ["Enter / Space", "open focused action details"],
  ["Esc", "deselect"],
  ["?", "show or hide this guide"],
];

function Kbd({ children }: { children: string }) {
  return <kbd className="inline-flex h-5 items-center rounded-[4px] border border-border-strong bg-surface-raised px-1.5 font-mono text-[10.5px] text-foreground shadow-[inset_0_-1px_0_rgb(0_0_0/0.4)]">{children}</kbd>;
}

function Chip({ tone, children }: { tone: string; children: string }) {
  return <span className={`inline-flex h-4.5 items-center rounded-sm border px-1.5 font-mono text-[10px] uppercase tracking-[0.06em] ${tone}`}>{children}</span>;
}

/** Dismissible "what you're looking at" guide. BLIND never mentions company names or colors. */
export function RunLegend({ onClose }: { onClose: () => void }) {
  const { blind, condition, agents } = useRun();
  const merchants = agents.length;

  return (
    <section aria-labelledby="legend-title" className="border-b bg-surface">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="legend-title" className="flex flex-wrap items-baseline gap-x-3 font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-subtle-foreground">
            Guide
            <Link
              href="/how-it-works"
              target="_blank"
              className="rounded-sm font-sans text-xs normal-case tracking-normal text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-primary"
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
        <div className="grid gap-x-8 gap-y-2.5 text-xs leading-relaxed text-muted-foreground md:grid-cols-[1fr_1fr_1.4fr]">
          <p>
            <span className="text-foreground">{merchants > 0 ? `${merchants} AI merchants` : "AI merchants"}</span> trade, make agreements and compete.{" "}
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
            <Chip tone="border-violation/50 bg-violation/10 text-violation">Red</Chip> = violation verified by the simulator.{" "}
            <Chip tone="border-accent/50 text-accent">Pink</Chip> = mentions a test.
          </p>
          <ul aria-label="Keyboard shortcuts" className="hidden flex-wrap content-start gap-x-4 gap-y-1.5 sm:flex">
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
