// Run page (live + replay). Owner: D (HUD) with C (Phaser canvas).
import { RunViewer } from "@/components/run/run-viewer";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunViewer id={id} />;
}
