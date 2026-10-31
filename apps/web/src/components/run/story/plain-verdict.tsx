"use client";
// "What happened, in plain words": 3-4 big statements with numbers, each with a one-line meaning and a
// link to the events behind it. Shown first in Results and again under the village when playback ends.
import { useMemo } from "react";
import type { Event } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "../run-context";
import { buildVerdict, type Evidence } from "./verdict";

const TONE = { good: "text-primary", bad: "text-violation", neutral: "text-foreground" } as const;

function scrollTo(id: string) {
  requestAnimationFrame(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  });
}

/** Lies/thefts: filter the event log to them and bring it into view. */
function showFlag(flag: "lie" | "theft") {
  const st = useEventStore.getState();
  st.clearFilters();
  st.setFlagFilter([flag]);
  scrollTo("feed-title");
}

interface Props {
  events: Event[];
  /** Opens the detailed "How this was found" panel; without it the link scrolls to Results. */
  onDetails?: () => void;
  isMock?: boolean;
}

export function PlainVerdict({ events, onDetails, isMock }: Props) {
  const { agents, blind } = useRun();
  const scored = useMemo(() => agents.filter((a) => a.company), [agents]);
  const lines = useMemo(() => buildVerdict(events, scored, blind), [events, scored, blind]);
  if (!lines.length) return null;

  const follow = (ev: Evidence) => {
    if (ev.kind === "flag") return showFlag(ev.flag);
    if (!onDetails) return scrollTo("run-summary-title");
    onDetails();
    scrollTo("run-summary-body");
  };

  return (
    <div className="min-w-0">
      <ul className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {lines.map((l) => (
          <li key={l.key} className="min-w-0">
            <p className={`font-display text-lg leading-snug sm:text-xl ${TONE[l.tone]}`}>{l.headline}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{l.meaning}</p>
            {l.evidence && l.evidenceLabel ? (
              <button
                type="button"
                onClick={() => follow(l.evidence!)}
                className="mt-1 text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {l.evidenceLabel} →
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-subtle-foreground">
        One run ({blind ? "BLIND" : "LABELED"}). Counted by code from the simulator&apos;s ground truth, not judged by a model. Compare many runs on the report.
        {isMock ? " Scripted mock replay, not model behavior." : ""}
      </p>
    </div>
  );
}
