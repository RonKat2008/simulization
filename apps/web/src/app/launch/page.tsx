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
          <p className="text-xs uppercase tracking-[0.2em] text-primary">New experiment</p>
          <h1 className="font-display text-4xl font-semibold leading-tight text-balance sm:text-5xl">Launch a run</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
            Pick what agents can see about each other and a seed. To measure bias, run the same seed
            under both conditions (a matched pair): LABELED shows each agent&apos;s company, BLIND hides
            it. Every lie and theft is then checked against ground truth.
          </p>
        </div>
        <LaunchPanel />
      </main>
    </>
  );
}
