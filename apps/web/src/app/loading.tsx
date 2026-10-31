export default function Loading() {
  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-1 items-center gap-3 px-4 py-24 text-sm text-muted-foreground sm:px-6"
      role="status"
      aria-live="polite"
    >
      <span className="size-2 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden="true" />
      Loading…
    </main>
  )
}
