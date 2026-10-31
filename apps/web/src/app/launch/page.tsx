import { launchAvailability } from "@/lib/execution-policy";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/site-header";
import { LaunchPanel } from "@/components/launch/launch-panel";

export const metadata: Metadata = { title: "Launch a run — Simulization" };
// Deployment mode is runtime configuration, not a build-time UI default.
export const dynamic = "force-dynamic";

export default function LaunchPage() {
  const availability = launchAvailability();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-3xl font-semibold leading-tight text-balance sm:text-4xl">Set up an experiment</h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty">
            Eighteen AI merchants try to finish six rounds with the most coins and valuable goods. Change what they can see, then watch how they trade, cooperate and steal; one run is an observation, not proof of provider bias.
          </p>
        </div>
        <LaunchPanel availability={availability} />
      </main>
    </>
  );
}
