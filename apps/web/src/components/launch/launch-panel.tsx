"use client";
import Link from "next/link";
import { useState } from "react";
import { CARD_CLASS } from "@/components/landing/ui";
import { LaunchForm } from "./launch-form";
import { PastRuns } from "./past-runs";

const LINK =
  "text-foreground underline decoration-border-strong underline-offset-4 transition-colors duration-150 hover:text-primary hover:decoration-primary";

export function LaunchPanel({ canLaunch = true }: { canLaunch?: boolean }) {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <>
      {canLaunch && <LaunchForm onStarted={() => setRefreshKey((k) => k + 1)} />}
      <PastRuns refreshKey={refreshKey} />
      <section aria-labelledby="replay-heading" className={`flex flex-col gap-3 ${CARD_CLASS}`}>
        <h2 id="replay-heading" className="text-lg font-semibold">
          Recorded runs
        </h2>
        <p className="text-sm text-muted-foreground">Recorded live and scripted replays; no new model calls.</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li><Link href="/run/featured" className={LINK}>Recorded live run</Link></li>
          <li>
            <Link href="/runs" className={LINK}>Browse recorded runs</Link>
          </li>
          <li>
            <Link href="/report?mock=1" className={LINK}>Mock report</Link>
          </li>
        </ul>
      </section>
    </>
  );
}
