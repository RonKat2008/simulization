"use client";
// Owner: C. Placeholder. Phaser touches window, so the real game module must be
// loaded via next/dynamic with { ssr: false } (import this component that way).
export default function VillageCanvas() {
  return <div id="village-canvas" className="h-full w-full" />;
}
