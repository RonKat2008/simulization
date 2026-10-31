"use client";
import Link from "next/link";
import { useState } from "react";
import { LaunchForm } from "./launch-form";
import { PastRuns } from "./past-runs";

const LINK =
  "underline decoration-border decoration-2 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent active:text-accent";

export function LaunchPanel() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <>
      <LaunchForm onStarted={() => setRefreshKey((k) => k + 1)} />
      <PastRuns refreshKey={refreshKey} />
      <section aria-labelledby="replay-heading" className="flex flex-col gap-3 rounded-lg border bg-surface p-5 sm:p-6">
        <h2 id="replay-heading" className="font-display text-2xl font-semibold">
          Replay a mock run
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Recorded fixtures for offline demos. No backend or model calls are used.
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li>
            <Link href="/run/mock" className={LINK}>Mock run (labeled)</Link>
          </li>
          <li>
            <Link href="/run/mock-blind" className={LINK}>Mock run (blind)</Link>
          </li>
          <li>
            <Link href="/report?mock=1" className={LINK}>Report card</Link>
          </li>
        </ul>
      </section>
    </>
  );
}
