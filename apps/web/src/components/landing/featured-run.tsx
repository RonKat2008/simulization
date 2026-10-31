/**
 * Slot for a recorded run video. Set FEATURED_VIDEO_SRC to a path under /public
 * (e.g. "/videos/featured-run.webm") to render it; null renders nothing.
 */
export const FEATURED_VIDEO_SRC: string | null = null

export function FeaturedRun() {
  if (!FEATURED_VIDEO_SRC) return null
  return (
    <section aria-labelledby="featured-run-title" className="border-b">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12 sm:px-6">
        <h2 id="featured-run-title" className="font-display text-2xl font-semibold">
          Watch a recorded run
        </h2>
        <video
          className="aspect-video w-full rounded-md border bg-surface"
          src={FEATURED_VIDEO_SRC}
          controls
          playsInline
          preload="metadata"
        />
      </div>
    </section>
  )
}
