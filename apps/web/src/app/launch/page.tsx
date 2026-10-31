// Owner: Person D — launch controls (condition toggle, start button, past runs) go here
import Link from "next/link";
import { SiteHeader } from "@/components/landing/site-header";

const CONDITIONS = [
  { name: "LABELED", detail: "Agents see which lab made every other agent." },
  { name: "BLIND", detail: "Agents see names only." },
] as const;

export default function LaunchPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">Launch a run</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Pick a condition and start a night in the market. Run controls and past runs will appear
            here.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {CONDITIONS.map((c) => (
            <li key={c.name} className="flex flex-col gap-2 rounded-lg border border-dashed bg-surface p-6">
              <span className="font-display text-2xl font-semibold tracking-wider text-primary">{c.name}</span>
              <span className="text-sm text-muted-foreground">{c.detail}</span>
              <span className="text-xs text-muted-foreground/70">Controls coming soon.</span>
            </li>
          ))}
        </ul>
        <Link href="/report" className="self-start text-sm text-foreground underline decoration-border decoration-2 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent">
          See the report card
        </Link>
      </main>
    </>
  );
}
