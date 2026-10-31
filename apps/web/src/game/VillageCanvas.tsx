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
import { useEventStore } from "@/store/eventStore";

const NARROW_PX = 720; // below this canvas width the banner moves to the bottom edge

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
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    padding: narrow ? "3px 8px" : "5px 10px",
    background: "var(--surface)",
    borderTop: "1px solid var(--border)",
    color: "#eef1fa",
    font: "13px/1.4 var(--font-sans), sans-serif",
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
  const [paused, setPaused] = useState(false);
  const applied = useEventStore(s => s.playbackSeq === null ? s.events.at(-1) : s.events.findLast(e => e.seq <= s.playbackSeq!));
  const seek = (r: number) => {
    setRound(r);
    import("./scene").then((m) => m.seekRound(r));
  };

  useEffect(() => {
    let game: { destroy: (removeCanvas: boolean) => void; scale: { getParentBounds: () => boolean; refresh: () => unknown } } | null = null;
    let observer: ResizeObserver | null = null;
    let unsub: (() => void) | null = null;
    let dead = false;
    import("./scene").then(({ createGame, onNarrate }) => {
      if (dead || !ref.current) return;
      game = createGame(ref.current);
      observer = new ResizeObserver(([entry]) => {
        setNarrow(entry.contentRect.width < NARROW_PX);
        game?.scale.getParentBounds();
        game?.scale.refresh();
      });
      observer.observe(ref.current);
      unsub = onNarrate((n) => {
        setLine(n);
        if (n.round > 0) setRound(n.round); // R-buttons follow playback, not just the last seek
      });
    });
    return () => {
      dead = true;
      unsub?.();
      observer?.disconnect();
      game?.destroy(true);
    };
  }, []);

  useEffect(() => {
    import("./scene").then((m) => m.setAgentNames(agents));
  }, [agents]);

  useEffect(() => {
    import("./scene").then((m) => m.setSpeed(paused ? 0 : speed));
  }, [speed, paused]);

  return (
    <section aria-label="Village playback" className="min-w-0">
      <div ref={boxRef} style={{position:"relative",width:"100%",aspectRatio:"16 / 9",background:"#0b0f1a"}}>
        <div ref={ref} style={{position:"absolute",inset:0}} />
      </div>
      {line ? <Banner n={{...line, round: applied?.round ?? 1, phase: applied?.phase ?? null}} narrow={narrow} /> : null}
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t bg-surface px-3 py-2 text-sm">
        <label className="flex items-center gap-2 text-muted-foreground">Replay from
          <select aria-label="Replay from round" value={round} onChange={e=>seek(Number(e.target.value))} className="min-h-8 rounded-md border bg-surface-raised px-2 text-foreground focus-visible:outline-2 focus-visible:outline-primary">
            {Array.from({length:ROUNDS},(_,i)=>i+1).map(r=><option key={r} value={r}>Round {r}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1" role="group" aria-label="Playback controls">
          {[1,2,4].map(x=><button key={x} aria-label={`Playback speed ${x} times`} aria-pressed={speed===x} onClick={()=>setSpeedState(x)} className={`min-h-8 min-w-9 rounded-md px-2 tabular-nums focus-visible:outline-2 focus-visible:outline-primary ${speed===x ? "bg-surface-raised text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{x}×</button>)}
          <button aria-label={paused ? "Resume village playback" : "Pause village playback"} onClick={()=>setPaused(!paused)} className="ml-2 min-h-8 min-w-20 rounded-md border border-border-strong px-3 font-medium hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-primary">{paused ? "Resume" : "Pause"}</button>
        </div>
      </div>
    </section>
  );
}
