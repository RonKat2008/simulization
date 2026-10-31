// Owner: C (readability pass). Drawing helpers for the village: action bubbles, relationship arcs,
// the phase title card and the pixel font. Kept out of scene.ts so the event player stays readable.
import * as Phaser from "phaser";
import { VIOLATION_RED } from "./assets";
import type { Icon } from "./narrate";
import { WIDTH } from "./spots";

/** Pixelify Sans from the app layout (next/font exposes it as --font-pixel); monospace until resolved. */
export let PIXEL_FONT = "monospace";

export function resolvePixelFont(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const css = getComputedStyle(document.documentElement).getPropertyValue("--font-pixel").trim()
    || getComputedStyle(document.body).getPropertyValue("--font-pixel").trim();
  if (!css) return Promise.resolve();
  PIXEL_FONT = css;
  // Canvas text only picks up a webfont once it is loaded, so wait for it before (re)drawing labels.
  return document.fonts.load(`700 16px ${css}`).then(() => undefined, () => undefined);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

const INK = "#1b1f2b";
const PAPER = 0xfbf8ee;
const BUBBLE_FONT_PX = 16;
const ICON_SCALE = 1.5; // 16px frames -> 24px
const PAD = 6;

export interface BubbleOpts {
  icon: Icon | null;
  label: string;
  violation: boolean;
  /** Agent's world x, used to keep the bubble inside the canvas. */
  worldX: number;
}

/**
 * Action bubble: [icon] label, cream pill with a tail pointing at the speaker's head.
 * Returned container is positioned in the agent container's local space (above the head).
 */
export function makeBubble(scene: Phaser.Scene, o: BubbleOpts): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];
  const g = scene.add.graphics();
  parts.push(g);
  const iconW = o.icon ? 16 * ICON_SCALE : 0;
  const text = scene.add
    .text(0, 0, o.label, { fontFamily: PIXEL_FONT, fontSize: `${BUBBLE_FONT_PX}px`, fontStyle: "bold", color: o.violation ? "#b4161b" : INK })
    .setOrigin(0, 0.5);
  const w = PAD + iconW + (o.icon && o.label ? 4 : 0) + (o.label ? text.width : 0) + PAD;
  const h = Math.max(iconW, text.height) + 6;
  // Keep the pill on screen: shift it sideways, the tail stays over the head.
  const half = w / 2;
  const dx = Phaser.Math.Clamp(0, 6 + half - o.worldX, WIDTH - 6 - half - o.worldX);
  const left = dx - half;
  const top = -h;
  g.fillStyle(0x0b0f1a, 0.35).fillRoundedRect(left + 2, top + 3, w, h, 6); // drop shadow for depth
  g.fillStyle(PAPER, 1).fillRoundedRect(left, top, w, h, 6);
  g.fillTriangle(-5, -1, 5, -1, 0, 7);
  g.lineStyle(o.violation ? 3 : 2, o.violation ? VIOLATION_RED : 0x2a3150).strokeRoundedRect(left, top, w, h, 6);
  if (o.icon) parts.push(scene.add.image(left + PAD + iconW / 2, top + h / 2, o.icon.sheet, o.icon.frame).setScale(ICON_SCALE));
  text.setPosition(left + PAD + iconW + (o.icon ? 4 : 0), top + h / 2);
  parts.push(text);
  return scene.add.container(0, -22, parts);
}

/**
 * The referee's verdict on a lying offer: the claimed "Q9" struck through in red, then "→ Q6 LIE".
 * Replaces the bubble's contents in place so it keeps following the agent.
 */
export function lieBubble(scene: Phaser.Scene, claimed: number, truth: number, worldX: number): Phaser.GameObjects.Container {
  const b = makeBubble(scene, { icon: { sheet: "emotes", frame: 22 }, label: `Q${claimed} → Q${truth} LIE`, violation: true, worldX });
  // Strike through the "Qn" claim (the first token of the label).
  const text = b.list.find((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text);
  if (text) {
    const probe = scene.add.text(0, 0, `Q${claimed}`, { fontFamily: PIXEL_FONT, fontSize: `${BUBBLE_FONT_PX}px`, fontStyle: "bold" });
    const sw = probe.width;
    probe.destroy();
    const strike = scene.add.graphics().lineStyle(3, VIOLATION_RED).lineBetween(text.x - 2, text.y, text.x + sw + 2, text.y);
    b.add(strike);
  }
  return b;
}

/** A relationship arc between two moving points; the scene redraws it each frame. */
export interface Arc {
  g: Phaser.GameObjects.Graphics;
  from: () => Phaser.Types.Math.Vector2Like;
  to: () => Phaser.Types.Math.Vector2Like;
  color: number;
  born: number;
  life: number;
}

const ARC_DRAW_MS = 320;
const ARC_FADE_MS = 400;
const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(), new Phaser.Math.Vector2(), new Phaser.Math.Vector2());

/** Redraws an arc for scene time `now`; returns false once it has fully faded (caller destroys it). */
export function drawArc(a: Arc, now: number): boolean {
  const age = now - a.born;
  if (age > a.life) return false;
  const p = Phaser.Math.Clamp(age / ARC_DRAW_MS, 0, 1); // line grows from actor to target
  const fade = Phaser.Math.Clamp((a.life - age) / ARC_FADE_MS, 0, 1);
  const s = a.from();
  const e = a.to();
  const sy = s.y! - 10;
  const ey = e.y! - 10;
  const dist = Phaser.Math.Distance.Between(s.x!, sy, e.x!, ey);
  curve.p0.set(s.x!, sy);
  curve.p2.set(e.x!, ey);
  curve.p1.set((s.x! + e.x!) / 2, Math.min(sy, ey) - Math.max(30, dist * 0.25)); // lift into an arc
  const pts = curve.getPoints(24).slice(0, Math.max(2, Math.ceil(25 * p)));
  a.g.clear().setAlpha(fade);
  a.g.lineStyle(6, 0x0b0f1a, 0.55).strokePoints(pts); // dark under-stroke so it reads on any tile
  a.g.lineStyle(3, a.color, 1).strokePoints(pts);
  const head = pts[pts.length - 1];
  a.g.fillStyle(a.color, 1).fillCircle(head.x, head.y, 5);
  a.g.fillStyle(a.color, 0.9).fillCircle(s.x!, sy, 3);
  return true;
}

/** Big centered "ROUND 2 · TRADE" card when a phase begins (fades by itself). */
export function phaseCard(scene: Phaser.Scene, title: string, sub: string, reduced: boolean, ms: number) {
  const t = scene.add
    .text(0, -8, title, { fontFamily: PIXEL_FONT, fontSize: "44px", fontStyle: "bold", color: "#ffe9a8" })
    .setOrigin(0.5)
    .setShadow(0, 3, "#000000", 0, true, true);
  const s = scene.add.text(0, 30, sub, { fontFamily: PIXEL_FONT, fontSize: "18px", color: "#d8def5" }).setOrigin(0.5);
  const w = Math.max(t.width, s.width) + 56;
  const g = scene.add.graphics();
  g.fillStyle(0x0b0f1a, 0.82).fillRoundedRect(-w / 2, -48, w, 104, 10);
  g.lineStyle(2, 0xffd98a, 0.8).strokeRoundedRect(-w / 2, -48, w, 104, 10);
  const c = scene.add.container(WIDTH / 2, 330, [g, t, s]).setDepth(30000);
  if (!reduced) {
    c.setScale(0.85).setAlpha(0);
    scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 160, ease: "Back.out" });
  }
  scene.tweens.add({ targets: c, alpha: 0, delay: ms * 0.75, duration: ms * 0.25, onComplete: () => c.destroy() });
}
