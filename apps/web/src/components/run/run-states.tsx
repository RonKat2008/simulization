"use client";
import Link from "next/link";

export function ErrorPanel({ message }: { message: string }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-20">
      <h1 className="font-display text-2xl">Run unavailable</h1>
      <p role="alert" className="text-sm text-muted-foreground">
        {message} The page keeps retrying every second, so it will appear as soon as the sim responds. If the id is wrong, open a recorded run instead.
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/run/mock" className="rounded-md border border-primary/50 px-3 py-1.5 text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
          Open the mock replay
        </Link>
        <Link href="/" className="rounded-md border px-3 py-1.5 text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent">
          Launch a run
        </Link>
      </div>
    </main>
  );
}

export function OfflineStrip({ eventCount }: { eventCount: number }) {
  return (
    <p role="alert" className="border-b border-violation/40 bg-violation/10 px-4 py-1.5 text-xs text-violation sm:px-6">
      Lost contact with the sim. Showing the {eventCount} events received so far and retrying.
    </p>
  );
}
