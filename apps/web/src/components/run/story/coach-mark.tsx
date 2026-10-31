"use client";
// First-visit "what am I looking at": three short steps, Skip, remembered in localStorage.
import { useState } from "react";
import Link from "next/link";
import { useStoredFlag } from "../run-prefs";

const STEPS = [
  { title: "Each figure is an AI merchant", body: "" },
  { title: "Bubbles show what they're doing", body: "One action at a time: talking, making pacts, trading, working or stealing." },
  { title: "Red means the referee caught a lie", body: "The simulator knows every good's true quality, so it checks every claim." },
] as const;

export function CoachMark({ blind, merchants }: { blind: boolean; merchants: number }) {
  const done = useStoredFlag("story-coach-done", false);
  const [step, setStep] = useState(0);
  if (!done.ready || done.value) return null;

  const s = STEPS[step]!;
  const last = step === STEPS.length - 1;
  const who = `${merchants || 18} of them, built by three AI companies`;
  const body = step > 0 ? s.body : blind ? `${who}. In this run they can't see who made whom.` : `${who}, trade through one night.`;

  return (
    <aside aria-label="Quick intro" className="flex min-w-0 flex-col gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
      <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {step + 1}/{STEPS.length}
      </p>
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{s.title}.</span> <span className="text-muted-foreground">{body}</span>
      </p>
      <div className="flex shrink-0 items-center gap-3 text-xs">
        <Link href="/how-it-works" target="_blank" className="text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary">
          How it works<span className="sr-only"> (opens in a new tab)</span>
        </Link>
        <button type="button" onClick={() => done.set(true)} className="text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
          Skip
        </button>
        <button
          type="button"
          onClick={() => (last ? done.set(true) : setStep(step + 1))}
          className="rounded-sm bg-primary px-2.5 py-1 font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {last ? "Got it" : "Next"}
        </button>
      </div>
    </aside>
  );
}
