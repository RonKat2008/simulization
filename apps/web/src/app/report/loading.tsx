/** Shown while the report reads Neon. Matches the page frame so nothing jumps when data arrives. */
export default function ReportLoading() {
  return (
    <main className="flex-1" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading report</span>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="h-8 w-3/4 max-w-xl animate-pulse rounded-md bg-surface-raised" />
        <div className="h-4 w-1/2 max-w-sm animate-pulse rounded-md bg-surface-raised" />
        <div className="mt-6 grid gap-px md:grid-cols-2">
          <div className="h-56 animate-pulse rounded-md bg-surface-raised" />
          <div className="h-56 animate-pulse rounded-md bg-surface-raised" />
        </div>
        <div className="h-40 animate-pulse rounded-md bg-surface-raised" />
      </div>
    </main>
  );
}
