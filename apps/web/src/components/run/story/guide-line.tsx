"use client";
// The collapsed form of the run guide: one line with the how-it-works link and a toggle for the full guide.
import Link from "next/link";

export function GuideLine({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="border-b bg-surface">
      <p className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-xs sm:px-6">
        <Link
          href="/how-it-works"
          target="_blank"
          className="rounded-sm text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          New here? How the game works<span className="sr-only"> (opens in a new tab)</span>
        </Link>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          Show guide and shortcuts
        </button>
      </p>
    </div>
  );
}
