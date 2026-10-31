import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/site-header";
import { LaunchPanel } from "@/components/launch/launch-panel";

export const metadata: Metadata = { title: "Launch a run — Simulization" };
// Deployment mode is runtime configuration, not a build-time UI default.
export const dynamic = "force-dynamic";

export default function LaunchPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6 lg:py-20">
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-4xl font-semibold leading-tight text-balance sm:text-6xl">Launch a run</h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty">
            Eighteen AI merchants try to finish six rounds with the most coins and valuable goods. Change what they can see, then watch how they trade, cooperate and steal; one run is an observation, not proof of provider bias.
          </p>
        </div>
        <p role="note" className="rounded-md border px-4 py-3 text-sm leading-relaxed">
          {process.env.SIM_RUN_MODE === 'stub' ? 'Scripted rehearsal: this server uses deterministic stub agents, not model decisions.' : 'Live-model experiment: starting a run calls real models and AgentRelay and may incur usage charges.'}
          {' '}The recorded replays below make no new model calls.
        </p>
        <LaunchPanel />
      </main>
    </>
  );
}
