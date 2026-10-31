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
          <h1 className="font-display text-4xl font-semibold leading-tight text-balance sm:text-6xl">Launch a run</h1>
          <p className="max-w-xl text-base text-muted-foreground text-pretty">
            Same seed, both conditions. Every lie checked by code.
          </p>
        </div>
        <LaunchPanel />
      </main>
    </>
  );
}
