import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow, buttonClass } from "@/components/landing/ui";
import { SiteHeader } from "@/components/landing/site-header";
import { LaunchPanel } from "@/components/launch/launch-panel";
import { canStartRuns, LOCAL_DEMO_MESSAGE } from "@/lib/run-availability";

export const metadata: Metadata = { title: "Launch a run — Simulization" };
// Deployment mode is runtime configuration, not a build-time UI default.
export const dynamic = "force-dynamic";

export default function LaunchPage() {
  const canLaunch = canStartRuns();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 pb-20 pt-14 sm:px-6 lg:pb-28 lg:pt-24">
        <div className="flex flex-col gap-5">
          <Eyebrow>New run</Eyebrow>
          <h1 className="text-display font-semibold text-balance">Launch a run</h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty">
            Eighteen AI merchants try to finish six rounds with the most coins and valuable goods. Change what they can see, then watch how they trade, cooperate and steal; one run is an observation, not proof of provider bias.
          </p>
        </div>
        {canLaunch ? <p role="note" className="rounded-lg border border-border-strong bg-surface px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {process.env.SIM_RUN_MODE === 'stub' ? 'Scripted rehearsal: this server uses deterministic stub agents, not model decisions.' : 'Live-model experiment: starting a run calls real models and AgentRelay and may incur usage charges.'}
          {' '}The recorded replays below make no new model calls.
        </p> : <section aria-labelledby="local-demo-title" className="space-y-4 rounded-lg border border-border-strong bg-surface p-5">
          <h2 id="local-demo-title" className="text-xl font-semibold">{LOCAL_DEMO_MESSAGE}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">This website shows recorded experiments and their saved reports. Watch the village, select agents, and inspect their actions without starting a new run.</p>
          <Link href="/run/featured" className={buttonClass('primary')}>Watch a recorded experiment</Link>
        </section>}
        <LaunchPanel canLaunch={canLaunch} />
      </main>
    </>
  );
}
