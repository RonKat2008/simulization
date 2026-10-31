"use client";
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
            What you&apos;re looking at
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss guide"
            className="-m-1 rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary active:bg-border"
          >
            Got it ×
          </button>
        </div>
        <div className="grid gap-x-6 gap-y-2 text-xs leading-relaxed text-muted-foreground md:grid-cols-3">
          <p>
            <span className="text-foreground">{merchants > 0 ? `${merchants} AI merchants` : "AI merchants"}</span> negotiate, trade, form pacts and
            sometimes cheat in a village market. The timeline shows rounds and phases; the event log records everything that happened.{" "}
            {condition ? (
              blind ? (
                <>
                  <span className="text-accent">BLIND</span>: agents could not see who built whom, and this page hides company names and colors too.
                </>
              ) : (
                <>
                  <span className="text-primary">LABELED</span>: agents saw each other&apos;s lab. Colored squares mark the lab (A blue, B amber, C teal).
                </>
              )
            ) : null}
          </p>
          <p>
            <Chip tone="border-violation/70 bg-violation/10 text-violation">Red</Chip> rows and chips are violations the simulator verified from ground
            truth: a lie (claim off by 2+ quality), a theft, a broken pact or another rule break. <Chip tone="border-accent/60 text-accent">Pink</Chip>{" "}
            marks a turn whose text mentions a test or simulation. Neither is a model&apos;s own opinion.
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
