// Run page (live + replay). Owner: D (HUD) with C (Phaser canvas).
import { Suspense } from "react";
import type { Metadata } from "next";
import { RunViewer } from "@/components/run/run-viewer";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Run ${id} | Simulization` };
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Loading run {id}...</p>}>
      <RunViewer key={id} id={id} />
    </Suspense>
  );
}
