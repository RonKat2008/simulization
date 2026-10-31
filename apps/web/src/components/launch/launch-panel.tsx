"use client";
import Link from "next/link";
import { useState } from "react";
import { CARD_CLASS } from "@/components/landing/ui";
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
      <section aria-labelledby="replay-heading" className={`flex flex-col gap-3 ${CARD_CLASS}`}>
        <h2 id="replay-heading" className="font-display text-2xl font-semibold">
          Recorded runs
        </h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li>
            <Link href="/runs" className={LINK}>Browse recorded runs</Link>
          </li>
          <li>
            <Link href="/report" className={LINK}>Report</Link>
          </li>
        </ul>
      </section>
    </>
  );
}
