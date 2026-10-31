import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/site-header";
import { LaunchPanel } from "@/components/launch/launch-panel";

export const metadata: Metadata = { title: "Launch a run — Simulization" };

export default function LaunchPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6 lg:py-20">
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">Launch a run</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Choose the information condition and a seed. Run the same seed under both conditions to
            compare in-group bias against ground truth.
          </p>
        </div>
        <LaunchPanel />
      </main>
    </>
  );
}
