"use client";
import Link from "next/link";
import VillageCanvas from "@/game/VillageCanvas";
import { useRunSource } from "@/components/run/use-run-source";

/** The same village and recorded event source as the full replay. No model calls. */
export function VillagePreview() {
  const meta = useRunSource("featured");
  return <figure className="min-w-0 overflow-hidden rounded-lg border bg-surface">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-sm"><span className="font-medium">A recorded live experiment</span><span className="text-muted-foreground">18 merchants · 6 rounds</span></div>
    <VillageCanvas agents={meta.roster ?? undefined}/>
    <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-3 text-sm"><span className="text-muted-foreground">Real model decisions, played back from saved events.</span><Link href="/run/featured" className="min-h-8 py-1 font-medium text-primary underline underline-offset-4">Open full replay</Link></figcaption>
  </figure>;
}
