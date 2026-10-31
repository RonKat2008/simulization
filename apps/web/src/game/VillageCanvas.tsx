"use client";
// Owner: C. Mounts the Phaser village. Phaser is imported only inside useEffect,
// so this component is safe to render from server pages (no next/dynamic needed).
// Reads events + selection from useEventStore; clicking a sprite calls select().
//
// The "now happening" banner is DOM (not canvas text) so it stays legible when the canvas is
// scaled down on phones. The scene pushes one line per event through onNarrate().
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PHASES, ROUNDS } from "@simulization/shared";
import type { AgentInfo } from "./scene";
import { PHASE_LABEL, type Icon, type Narration } from "./narrate";
import { DUNGEON_SHEET, EMOTE_SHEET } from "./assets";

const NARROW_PX = 720; // below this canvas width the banner moves to the bottom edge
const PIXEL = "var(--font-pixel), monospace";

const btn = (on: boolean) => ({
  padding: "2px 8px",
  borderRadius: 4,
  border: 0,
  cursor: "pointer",
  background: on ? "#e2e8f0" : "rgba(30,41,59,0.8)",
  color: on ? "#0f172a" : "#cbd5e1",
});

/** The same Kenney frame the bubble uses, drawn from the sheet with CSS (2x, crisp). */
function SheetIcon({ icon, size }: { icon: Icon; size: number }) {
  const sheet = icon.sheet === "emotes" ? EMOTE_SHEET : DUNGEON_SHEET;
  const k = size / sheet.frameWidth;
  const col = icon.frame % sheet.columns;
  const row = Math.floor(icon.frame / sheet.columns);
  const style: CSSProperties = {
    width: size,
    height: size,
    flex: "none",
    backgroundImage: `url(${sheet.path})`,
    backgroundSize: `${sheet.columns * sheet.frameWidth * k}px ${sheet.rows * sheet.frameHeight * k}px`,
    backgroundPosition: `-${col * sheet.frameWidth * k}px -${row * sheet.frameHeight * k}px`,
    imageRendering: "pixelated",
  };
  return <span aria-hidden style={style} />;
}

/** Round + the four phases, current one lit. Narrow mode shows only the current phase name. */
function PhaseSteps({ n, narrow }: { n: Narration; narrow: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
      <span style={{ color: "#ffd98a", fontWeight: 700 }}>
        {n.round > 0 ? `Round ${n.round}/${ROUNDS}` : "Night"}
      </span>
      {narrow ? (
        n.phase ? <span style={{ color: "#d8def5" }}>· {PHASE_LABEL[n.phase]}</span> : null
      ) : (
        <span style={{ display: "inline-flex", gap: 3 }} aria-label={n.phase ? `Phase: ${PHASE_LABEL[n.phase]}` : undefined}>
          {PHASES.map((p) => {
            const on = p === n.phase;
            return (
              <span
                key={p}
                style={{
                  padding: "1px 6px",
                  borderRadius: 3,
                  fontSize: 12,
                  background: on ? "#ffd98a" : "rgba(216,222,245,0.08)",
                  color: on ? "#1b1f2b" : "#8591b8",
                  fontWeight: on ? 700 : 400,
                }}
              >
                {PHASE_LABEL[p]}
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}

function Banner({ n, narrow }: { n: Narration; narrow: boolean }) {
  const style: CSSProperties = {
    position: "absolute",
    left: 8,
    ...(narrow ? { right: 8, bottom: 8 } : { top: 8, right: 330 }),
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    padding: narrow ? "3px 8px" : "5px 10px",
    borderRadius: 6,
    background: "rgba(11,15,26,0.86)",
    border: `1px solid ${n.violation ? "#e5484d" : "#2a3560"}`,
    boxShadow: "0 2px 0 rgba(0,0,0,0.35)",
    color: "#eef1fa",
    font: `${narrow ? 11 : 14}px/1.25 ${PIXEL}`,
    pointerEvents: "none",
  };
  return (
    <div style={style} aria-label="Now happening">
      <PhaseSteps n={n} narrow={narrow} />
      <span aria-hidden style={{ width: 1, alignSelf: "stretch", background: "#2a3560", flex: "none" }} />
      {n.icon ? <SheetIcon icon={n.icon} size={narrow ? 16 : 22} /> : null}
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: n.violation ? "#ff8a8d" : "#eef1fa",
        }}
      >
        {n.sentence}
      </span>
    </div>
  );
}

export default function VillageCanvas({ agents }: { agents?: AgentInfo[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeedState] = useState(1);
  const [round, setRound] = useState(1);
  const [line, setLine] = useState<Narration | null>(null);
  const [narrow, setNarrow] = useState(false);
  const seek = (r: number) => {
    setRound(r);
    import("./scene").then((m) => m.seekRound(r));
  };

  useEffect(() => {
    let game: { destroy: (removeCanvas: boolean) => void } | null = null;
    let unsub: (() => void) | null = null;
    let dead = false;
    import("./scene").then(({ createGame, onNarrate }) => {
      if (dead || !ref.current) return;
      game = createGame(ref.current);
      unsub = onNarrate((n) => {
        setLine(n);
        if (n.round > 0) setRound(n.round); // R-buttons follow playback, not just the last seek
      });
    });
    return () => {
      dead = true;
      unsub?.();
      game?.destroy(true);
    };
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < NARROW_PX));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    import("./scene").then((m) => m.setAgentNames(agents));
  }, [agents]);

  useEffect(() => {
    import("./scene").then((m) => m.setSpeed(speed));
  }, [speed]);

  return (
    // Inline styles on purpose: works whether or not Tailwind is wired up.
    <div ref={boxRef} style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#0b0f1a" }}>
      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
      {line ? <Banner n={line} narrow={narrow} /> : null}
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
