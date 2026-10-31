// Run page (live + replay). Owner: D (HUD) with C (Phaser canvas).
export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="p-6">Run {id} (placeholder)</main>;
}
