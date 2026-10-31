"use client";
import Link from "next/link";
import { useState } from "react";
import { CARD_CLASS } from "@/components/landing/ui";
import { LaunchForm, type LaunchAvailability } from "./launch-form";
import { PastRuns } from "./past-runs";

const LINK =
  "underline decoration-border decoration-2 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent active:text-accent";

export function LaunchPanel({ availability }: { availability: LaunchAvailability }) {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <>
      <LaunchForm availability={availability} onStarted={() => setRefreshKey((k) => k + 1)} />
      <PastRuns refreshKey={refreshKey} />
      <section aria-labelledby="replay-heading" className={`flex flex-col gap-3 ${CARD_CLASS}`}>
        <h2 id="replay-heading" className="font-display text-2xl font-semibold">
          Recorded runs
        </h2>
        <p className="text-sm text-muted-foreground">Recorded live and scripted replays; no new model calls.</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li><Link href="/run/featured" className={LINK}>Recorded live run</Link></li>
          <li>
            <Link href="/runs" className={LINK}>Browse all recorded runs</Link>
          </li>
          <li>
            <Link href="/report?mock=1" className={LINK}>Scripted fixture report</Link>
          </li>
        </ul>
      </section>
    </>
  );
}
