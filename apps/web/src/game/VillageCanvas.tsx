"use client";
// Owner: C. Mounts the Phaser village. Phaser is imported only inside useEffect,
// so this component is safe to render from server pages (no next/dynamic needed).
// Reads events + selection from useEventStore; clicking a sprite calls select().
import { useEffect, useRef, useState } from "react";
import { ROUNDS } from "@simulization/shared";
import type { AgentInfo } from "./scene";

const btn = (on: boolean) => ({
  padding: "2px 8px",
  borderRadius: 4,
  border: 0,
  cursor: "pointer",
  background: on ? "#e2e8f0" : "rgba(30,41,59,0.8)",
  color: on ? "#0f172a" : "#cbd5e1",
});

export default function VillageCanvas({ agents }: { agents?: AgentInfo[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [speed, setSpeedState] = useState(1);
  const [round, setRound] = useState(1);
  const seek = (r: number) => {
    setRound(r);
    import("./scene").then((m) => m.seekRound(r));
  };

  useEffect(() => {
    let game: { destroy: (removeCanvas: boolean) => void } | null = null;
    let dead = false;
    import("./scene").then(({ createGame }) => {
      if (!dead && ref.current) game = createGame(ref.current);
    });
    return () => {
      dead = true;
      game?.destroy(true);
    };
  }, []);

  useEffect(() => {
    import("./scene").then((m) => m.setAgentNames(agents));
  }, [agents]);

  useEffect(() => {
    import("./scene").then((m) => m.setSpeed(speed));
  }, [speed]);

  return (
    // Inline styles on purpose: works whether or not Tailwind is wired up.
    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#0b0f1a" }}>
      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", right: 8, top: 8, display: "flex", gap: 4, font: "12px monospace" }}>
        {Array.from({ length: ROUNDS }, (_, i) => i + 1).map((r) => (
          <button key={r} title={`Replay from round ${r}`} onClick={() => seek(r)} style={btn(round === r)}>
            R{r}
          </button>
        ))}
        <span style={{ width: 8 }} />
        {[1, 2, 4].map((x) => (
          <button key={x} onClick={() => setSpeedState(x)} style={btn(speed === x)}>
            {x}x
          </button>
        ))}
      </div>
    </div>
  );
}
