// Owner: C. Phaser village: draws the map and plays the ordered Event[] from the event store.
// Imported only on the client (see VillageCanvas), never during SSR.
//
// Readability pass (Escapists-style "see who is doing what"):
// - one event at a time, each held for a per-type beat (narrate.ts) instead of a fixed 400ms tick,
// - icon + ≤3-word action bubble over the actor, a gold spotlight under them, an arc to the target,
// - a "now happening" sentence emitted to VillageCanvas (DOM banner) and a title card per phase,
// - name labels with a dark backing that dodge each other,
// - BLIND-safe colors/looks/positions, and prefers-reduced-motion (no walking, hops or arcs).
import * as Phaser from "phaser";
import { LANTERN_GOAL, START_COINS, STEAL_AMOUNT, CAUGHT_PENALTY, COALITION_PAYOUT, LANTERN_BONUS, type Event } from "@simulization/shared";
import { contiguousCursor } from "@/components/run/event-progress";
import { useEventStore } from "@/store/eventStore";
import { HEIGHT, SPOTS, WIDTH, homeSpot, jitter, type Spot } from "./spots";
import { agentTexture } from "./looks";
import { COMPANY_TINT, EMOTE, SCALE, SHEETS, TILE } from "./assets";
import { describe, LINK_COLOR, PHASE_LABEL, type Beat, type Narration } from "./narrate";
import { drawArc, lieBubble, makeBubble, phaseCard, PIXEL_FONT, prefersReducedMotion, resolvePixelFont, type Arc } from "./fx";

export interface AgentInfo {
  id: string;
  name: string;
  company: string;
}

const COMPANY_COLOR: Record<string, number> = { A: COMPANY_TINT.blue, B: COMPANY_TINT.amber, C: COMPANY_TINT.teal };
const DUSK = 0x3a4170; // ground/prop tint at 9 PM
const DAWN = 0xc9c3d6; // ...lifting toward 6 AM
const IDLE_MS = 250; // poll interval while waiting for live events
const PHASE_CARD_MS = 1300; // pause on the "ROUND 2 · TRADE" card before the phase's first action
const LIE_REVEAL_MS = 800; // claim shown alone, then the referee's verdict
const BUBBLE_MS = 2600; // a bubble outlives its beat a little so the previous action stays readable (dimmed)
const LABEL_DY = 17; // default name-label offset below the sprite's feet
const LABEL_LAYOUT_MS = 100;
const LABEL_DEPTH = 9000; // labels sit above every sprite (and arcs), below bubbles (10000+)

const PHASE_HINT: Record<string, string> = {
  negotiate: "Merchants talk, make pacts and form coalitions",
  trade: "Offers go out; the referee checks every claimed quality",
  act: "Each merchant works, feeds the lantern, or steals",
  reveal: "Thieves may be caught; rewards are paid",
};

const names = new Map<string, string>();
const companies = new Map<string, string>(); // id -> company letter from the agents prop ("" in BLIND)
const blindIds = new Set<string>(); // company "" (BLIND view): no company color, ids may encode company
const slots = new Map<string, number>(); // id -> home slot 0..17
const NEUTRAL = 0xaaaaaa;
let current: VillageScene | null = null;
const register = (s: VillageScene | null) => {
  current = s;
};

const hashId = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};
const COMPANY_ID = /^([A-C])-(\d+)$/;

export function setAgentNames(list: AgentInfo[] = []) {
  names.clear();
  companies.clear();
  blindIds.clear();
  slots.clear();
  for (const a of list) {
    names.set(a.id, a.name);
    companies.set(a.id, a.company);
    if (a.company === "") blindIds.add(a.id);
  }
  // Home slots. LABELED runs with "A-01"-style ids keep C's company-major ring. Otherwise use roster
  // order, and in BLIND a hash shuffle so neighbours on the ring never hint at a shared company.
  const companyMajor = list.length > 0 && blindIds.size === 0 && list.every((a) => COMPANY_ID.test(a.id));
  if (!companyMajor) {
    const order = blindIds.size ? [...list].sort((p, q) => hashId(p.id) - hashId(q.id) || p.id.localeCompare(q.id)) : list;
    order.forEach((a, i) => slots.set(a.id, i % 18));
  }
  current?.relabel();
}

let speed = 1;

/** Company color for outfit/lantern. BLIND, or any agent we have no roster entry for, is neutral. */
function colorOf(id: string): number {
  if (blindIds.has(id)) return NEUTRAL;
  return COMPANY_COLOR[companies.get(id) ?? ""] ?? NEUTRAL;
}

const nameOf = (id: string) => names.get(id) ?? id;

export function setSpeed(x: number) {
  speed = x;
  if (!current) return;
  current.time.timeScale = x;
  current.tweens.timeScale = x;
}

let seekTo = 0;
let seekRunId: string | null = null;

/** Jump to the start of round r: replay earlier rounds instantly, animate from r on. */
export function seekRound(r: number) {
  seekTo = r;
  narrate({ round: r, phase: "negotiate", sentence: `Replaying from round ${r}…`, icon: null, violation: false });
  useEventStore.getState().setPlaybackSeq(0);
  current?.scene.restart();
}

// ---- "now happening" channel to the React banner -----------------------------------
const listeners = new Set<(n: Narration) => void>();
let lastNarration: Narration = { round: 0, phase: null, sentence: "Waiting for the market to open…", icon: null, violation: false };

/** Subscribe to the banner text; called immediately with the latest line. Returns an unsubscribe. */
export function onNarrate(cb: (n: Narration) => void): () => void {
  listeners.add(cb);
  cb(lastNarration);
  return () => listeners.delete(cb);
}

function narrate(n: Narration) {
  lastNarration = n;
  for (const cb of listeners) cb(n);
}

interface Agent {
  id: string;
  idx: number; // home slot 0..17
  /** Label offset from the agent, chosen by layoutLabels(); the label itself lives outside the container. */
  labelAt: { dx: number; dy: number };
  c: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  body: Phaser.GameObjects.Sprite;
  lantern: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Ellipse;
  bubble?: Phaser.GameObjects.Container;
  queue: Promise<void>;
  coins: number;
  coalition: string | null;
  stockedRound: number | null;
}

function lerpColor(a: number, b: number, t: number): number {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.ValueToColor(a), Phaser.Display.Color.ValueToColor(b), 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
}

/** Home slot: roster-based when known (see setAgentNames), else "B-04" → 9, else a hash. */
function indexOf(id: string): number {
  const s = slots.get(id);
  if (s !== undefined) return s;
  const m = COMPANY_ID.exec(id);
  if (m) return (m[1].charCodeAt(0) - 65) * 6 + ((Number(m[2]) - 1) % 6);
  return hashId(id) % 18;
}

class VillageScene extends Phaser.Scene {
  private agents!: Map<string, Agent>;
  private tents!: Map<string, number>;
  private pending!: Event[];
  private lastSeq!: number;
  private runId!: string | null;
  private round!: number;
  private fund!: number; // lantern fund, counted from contribute events (1 coin each)
  private fundText!: Phaser.GameObjects.Text;
  private fundG!: Phaser.GameObjects.Graphics;
  private nightables!: { setTint: (c: number) => unknown }[];
  private instant!: boolean; // seeking: apply state, skip animation
  private reduced!: boolean; // prefers-reduced-motion: no walking/hops/arcs, bubbles + banner stay
  private phaseKey!: string; // "round:phase" of the last played event, to detect phase starts
  private arcs!: Arc[];
  private focus!: Agent | null; // current actor (spotlight)
  private focusTarget!: Agent | null;
  private spot!: Phaser.GameObjects.Ellipse;
  private spotTarget!: Phaser.GameObjects.Ellipse;
  private lastBubble?: Phaser.GameObjects.Container;
  private labelClock!: number;
  private clock!: number; // scene ms scaled by playback speed (time.now is not), drives arc lifetimes

  constructor() {
    super("village");
  }

  preload() {
    for (const s of SHEETS)
      this.load.spritesheet(s.key, s.path, { frameWidth: s.frameWidth, frameHeight: s.frameHeight, margin: s.margin, spacing: s.spacing });
  }

  create() {
    register(this);
    const store = useEventStore.getState();
    const activeRun = store.runId ?? store.events[0]?.runId ?? null;
    if (activeRun !== seekRunId) seekTo = 0;
    seekRunId = activeRun;
    setSpeed(speed); // survives scene restarts and remounts
    this.agents = new Map();
    this.tents = new Map();
    this.pending = [];
    this.lastSeq = 0;
    this.runId = null;
    this.round = 0;
    this.fund = 0;
    this.nightables = [];
    this.instant = false;
    this.reduced = prefersReducedMotion();
    this.phaseKey = "";
    this.arcs = [];
    this.focus = null;
    this.focusTarget = null;
    this.lastBubble = undefined;
    this.labelClock = 0;
    this.clock = 0;
    narrate({ round: Math.max(1, seekTo), phase: "negotiate", sentence: seekTo > 1 ? `Ready to replay round ${seekTo}.` : "Ready to replay the first actions.", icon: null, violation: false });
    useEventStore.getState().setPlaybackSeq(0);
    this.game.canvas.dataset.playbackSeq = "0";

    this.drawMap();
    this.setNight(1);
    // Spotlight under the current actor (warm, additive) and a thin ring under its target.
    this.spot = this.add.ellipse(0, 0, 56, 22, 0xffd98a, 0.6).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.spotTarget = this.add.ellipse(0, 0, 44, 16).setStrokeStyle(2, 0xffd98a, 0.75).setVisible(false);
    if (!this.reduced) this.tweens.add({ targets: this.spot, alpha: 0.3, duration: 520, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.relabel();
    void resolvePixelFont().then(() => this.sys.isActive() && this.relabel());
    this.schedule(IDLE_MS);

    const motion = typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : undefined;
    const onMotion = () => (this.reduced = prefersReducedMotion());
    motion?.addEventListener?.("change", onMotion);

    const unsub = useEventStore.subscribe((s, prev) => {
      // Cursor updates come from this scene; do not feed them back into its ingestion loop.
      if (s.events !== prev.events || s.selectedAgentId !== prev.selectedAgentId) this.sync(s.events, s.selectedAgentId);
    });
    const s = useEventStore.getState();
    this.sync(s.events, s.selectedAgentId);
    const cleanup = () => {
      unsub();
      motion?.removeEventListener?.("change", onMotion);
    };
    this.events.once("shutdown", cleanup);
    this.events.once("destroy", () => {
      cleanup();
      if (current === this) register(null);
    });
  }

  update(time: number, delta: number) {
    // Spotlight follows the actor; arcs follow both ends while they walk.
    const f = this.focus;
    this.spot.setVisible(!!f);
    if (f) this.spot.setPosition(f.c.x, f.c.y + 14).setDepth(f.c.depth - 0.5);
    const t = this.focusTarget;
    this.spotTarget.setVisible(!!t);
    if (t) this.spotTarget.setPosition(t.c.x, t.c.y + 14).setDepth(t.c.depth - 0.5);
    for (const a of this.agents.values()) {
      a.label.setPosition(Math.round(a.c.x + a.labelAt.dx), Math.round(a.c.y + a.labelAt.dy));
      a.label.setAlpha(a.c.alpha);
    }
    this.clock += delta * this.time.timeScale;
    const now = this.clock;
    this.arcs = this.arcs.filter((a) => drawArc(a, now) || (a.g.destroy(), false));
    this.labelClock += delta;
    if (this.labelClock >= LABEL_LAYOUT_MS) {
      this.labelClock = 0;
      this.layoutLabels();
    }
    void time;
  }

  // ---- store → pending queue -------------------------------------------------

  private sync(events: Event[], selected: string | null) {
    const newRun = events.length > 0 && this.runId !== null && events[0].runId !== this.runId;
    if ((events.length === 0 && this.lastSeq > 0) || newRun) {
      seekTo = 0;
      this.scene.restart(); // reset() or a different run loaded: start clean
      return;
    }
    if (events.length) this.runId = events[0].runId;
    const through = contiguousCursor(events);
    let appliedSeq: number | undefined;
    for (const e of events) {
      if (e.seq > through) break;
      if (e.seq > this.lastSeq) {
        if (e.actorId !== "world") this.agent(e.actorId); // spawn everyone up front, idle at home
        if (e.targetId) this.agent(e.targetId);
        this.lastSeq = e.seq;
        if (e.round >= seekTo) {
          this.pending.push(e);
          continue;
        }
        this.instant = true;
        this.play(e);
        this.phaseKey = `${e.round}:${e.phase}`;
        this.instant = false;
        appliedSeq = e.seq;
      }
    }
    if (appliedSeq !== undefined) this.setPlaybackSeq(appliedSeq);
    this.game.canvas.dataset.acceptedSeq = String(this.lastSeq);
    this.game.canvas.dataset.reducedMotion = String(prefersReducedMotion());
    this.game.canvas.dataset.runId = this.runId ?? "";
    for (const a of this.agents.values()) a.ring.setVisible(a.id === selected);
  }

  private schedule(ms: number) {
    this.time.delayedCall(ms, () => this.tick());
  }

  /**
   * One action at a time: play the next visible event, then wait for its beat before the next.
   * Uses scene time, so the 1x/2x/4x speed control (time.timeScale) applies automatically.
   */
  private tick() {
    while (this.pending.length) {
      const e = this.pending.shift()!;
      const lead = this.enterPhase(e);
      if (lead > 0) {
        this.time.delayedCall(lead, () => {
          const ms = this.play(e);
          this.setPlaybackSeq(e.seq);
          this.schedule(Math.max(50, ms));
        });
        return;
      }
      const ms = this.play(e);
      this.setPlaybackSeq(e.seq);
      if (ms > 0) return this.schedule(ms);
    }
    this.schedule(IDLE_MS);
  }

  /** On the first event of a new phase, show a title card and pause briefly. Returns the pause in ms. */
  private enterPhase(e: Event): number {
    const key = `${e.round}:${e.phase}`;
    if (key === this.phaseKey) return 0;
    this.phaseKey = key;
    if (e.round < 1) return 0;
    if (e.round !== this.round) this.setNight(e.round);
    const label = PHASE_LABEL[e.phase];
    phaseCard(this, `ROUND ${e.round} · ${label.toUpperCase()}`, PHASE_HINT[e.phase] ?? "", this.reduced, PHASE_CARD_MS);
    this.setFocus(null, null);
    narrate({ round: e.round, phase: e.phase, sentence: PHASE_HINT[e.phase] ?? `${label} begins`, icon: null, violation: false });
    return PHASE_CARD_MS;
  }

  private setPlaybackSeq(seq: number) {
    this.game.canvas.dataset.playbackSeq = String(seq);
    useEventStore.getState().setPlaybackSeq(seq);
  }

  // ---- event → visual ----------------------------------------------------------

  /** Applies the event's state + motion, shows its bubble/arc/banner. Returns how long to dwell (0 = nothing visible). */
  private play(e: Event): number {
    this.releaseStocks(e);
    if (e.round !== this.round) this.setNight(e.round);
    const beat = describe(e, nameOf);
    if (e.actorId === "world") {
      if (e.type === "system" && e.targetId) {
        if (e.text === `Coalition reward: ${COALITION_PAYOUT} coins.`) this.addCoins(this.agent(e.targetId), COALITION_PAYOUT);
        else if (e.text === `Lantern reward: ${LANTERN_BONUS} coins.`) this.addCoins(this.agent(e.targetId), LANTERN_BONUS);
      }
      if (!beat || this.instant) return 0;
      this.setFocus(null, null);
      narrate({ round: e.round, phase: e.phase, sentence: beat.sentence, icon: null, violation: false });
      return beat.ms;
    }
    const a = this.agent(e.actorId);
    const t = e.targetId ? this.agent(e.targetId) : null;

    switch (e.type) {
      case "pact_accept":
        if (t) {
          this.emote(this.mid(a, t), EMOTE.heart);
          this.hop(a);
          this.hop(t);
        }
        break;
      case "pact_break":
        if (t) this.emote(this.mid(a, t), EMOTE.heartBroken, 2500);
        break;
      case "coalition_create":
      case "coalition_join":
        a.coalition = e.channel ?? null;
        this.walkHome(a);
        break;
      case "coalition_leave":
        a.coalition = null;
        this.walkHome(a);
        break;
      case "trade_offer": {
        if (!t) return 0;
        const stall = SPOTS.stalls[a.idx % 6];
        this.enqueue(a, async () => {
          await this.walk(a, { x: stall.x - 22, y: stall.y + 40 });
          await this.hopNow(a);
          await this.wait(900);
        });
        this.enqueue(t, async () => {
          await this.walk(t, { x: stall.x + 22, y: stall.y + 40 });
          await this.hopNow(t);
          await this.wait(900);
        });
        this.walkHome(a);
        this.walkHome(t);
        break;
      }
      case "trade_accept":
        if (e.claim && t) {
          this.addCoins(a, -e.claim.price);
          this.addCoins(t, e.claim.price);
          this.emote({ x: t.c.x, y: t.c.y - 40 }, EMOTE.cash);
          this.hop(a);
          this.hop(t);
        }
        break;
      case "work":
        this.addCoins(a, 1);
        this.float({ x: a.c.x + 18, y: a.c.y - 30 }, "+1", "#9be38a");
        break;
      case "contribute":
        this.addCoins(a, -1);
        this.fund++;
        this.refreshFund();
        this.enqueue(a, async () => {
          await this.walk(a, jitter(SPOTS.shrine, a.idx));
          this.float({ x: SPOTS.shrine.x, y: SPOTS.shrine.y - 50 }, "+1", "#ffd36b");
        });
        this.walkHome(a);
        break;
      case "steal":
        if (!t) return 0;
        // The engine caps theft by the target's balance and records the actual amount.
        const stolen = /^Stole (\d+) coins\.$/.exec(e.text ?? "");
        const amount = stolen ? Number(stolen[1]) : Math.min(STEAL_AMOUNT, t.coins);
        this.addCoins(a, amount);
        this.addCoins(t, -amount);
        this.enqueue(a, async () => {
          await this.walk(a, { x: t.c.x + 20, y: t.c.y });
          this.float({ x: t.c.x, y: t.c.y - 40 }, `-${amount}`, "#e5484d");
          a.c.setAlpha(0.6);
          await this.wait(300);
          a.c.setAlpha(1);
        });
        this.walkHome(a);
        break;
      case "caught":
        const fine = /^Fined (\d+) coins;/.exec(e.text ?? "");
        this.addCoins(a, -(fine ? Number(fine[1]) : Math.min(CAUGHT_PENALTY, a.coins)));
        a.stockedRound = e.round;
        this.emote({ x: a.c.x, y: a.c.y - 70 }, EMOTE.exclamation, 2200);
        this.walkHome(a); // home is now the stocks
        break;
      default: // message, pact_propose, trade_decline, pass, ...: bubble only (or nothing)
        break;
    }
    if (!beat || this.instant) return 0;
    this.show(e, a, t, beat);
    return beat.ms;
  }

  /** The readable part: spotlight, bubble, relationship arc, banner line. */
  private show(e: Event, a: Agent, t: Agent | null, beat: Beat) {
    this.setFocus(a, t);
    if (beat.icon || beat.label) {
      const b = this.bubble(a, beat);
      if (beat.lie) {
        const { claimed, truth, sentence } = beat.lie;
        this.time.delayedCall(LIE_REVEAL_MS, () => {
          if (a.bubble !== b) return;
          const nb = lieBubble(this, claimed, truth, a.c.x);
          this.attachBubble(a, nb);
          this.emote({ x: a.c.x, y: a.c.y - 78 }, EMOTE.exclamation, 1800);
          narrate({ round: e.round, phase: e.phase, sentence, icon: { sheet: "emotes", frame: EMOTE.exclamation }, violation: true });
        });
      }
    }
    if (beat.link && t && !this.reduced) {
      const g = this.add.graphics().setDepth(5000); // over sprites, under bubbles
      this.arcs.push({ g, from: () => a.c, to: () => t.c, color: LINK_COLOR[beat.link], born: this.clock, life: Math.max(1100, beat.ms + 300) });
    }
    narrate({ round: e.round, phase: e.phase, sentence: beat.sentence, icon: beat.icon, violation: beat.violation && !beat.lie });
  }

  private setFocus(a: Agent | null, t: Agent | null) {
    const old = [this.focus, this.focusTarget];
    this.focus = a;
    this.focusTarget = t && t !== a ? t : null;
    for (const x of [...old, this.focus, this.focusTarget]) if (x) this.styleLabel(x);
  }

  /** Darkness lifts a step per round, 9 PM → 6 AM. */
  private setNight(round: number) {
    this.round = round;
    const k = Phaser.Math.Clamp((round - 1) / 5, 0, 1);
    const tint = lerpColor(DUSK, DAWN, k * k);
    for (const o of this.nightables) o.setTint(tint);
  }

  /** Caught in round r → in the stocks through round r+1's act phase. */
  private releaseStocks(e: Event) {
    for (const a of this.agents.values()) {
      const r = a.stockedRound;
      if (r !== null && (e.round > r + 1 || (e.round === r + 1 && e.phase === "reveal"))) {
        a.stockedRound = null;
        this.walkHome(a);
      }
    }
  }

  // ---- agents --------------------------------------------------------------------

  private agent(id: string): Agent {
    let a = this.agents.get(id);
    if (a) return a;
    const idx = indexOf(id);
    const color = colorOf(id);
    const home = homeSpot(idx);

    const glow = this.add.circle(14, 2, 14, color, 0.25).setBlendMode(Phaser.BlendModes.ADD);
    const ring = this.add.ellipse(0, 15, 34, 12).setStrokeStyle(2, 0xffffff).setVisible(false);
    const body = this.add.sprite(0, 0, agentTexture(this, id, color)).setScale(SCALE);
    const lantern = this.add.circle(14, 2, 3, color);
    // Name plate: pixel font on a dark backing so it reads on grass, dirt and at night.
    const label = this.add
      .text(home.x, home.y + LABEL_DY, nameOf(id), {
        fontFamily: PIXEL_FONT, fontSize: "15px", color: "#eef1fa",
        backgroundColor: "rgba(8,10,18,0.78)", padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5, 0)
      .setDepth(LABEL_DEPTH);

    const c = this.add.container(home.x, home.y, [glow, ring, body, lantern]);
    c.setSize(32, 40).setInteractive({ useHandCursor: true }).setDepth(home.y);
    c.on("pointerdown", () => useEventStore.getState().select(id));

    a = { id, idx, labelAt: { dx: 0, dy: LABEL_DY }, c, label, body, lantern, glow, ring, queue: Promise.resolve(), coins: START_COINS, coalition: null, stockedRound: null };
    this.agents.set(id, a);
    this.updateLanterns();
    return a;
  }

  /** Re-applies names, colors, looks and home slots (roster can arrive after agents spawned). */
  relabel() {
    for (const id of names.keys()) this.agent(id);
    for (const a of this.agents.values()) {
      a.label.setText(nameOf(a.id)).setFontFamily(PIXEL_FONT);
      const color = colorOf(a.id);
      // Look texture is keyed by color, so a BLIND view never reuses a company-colored outfit.
      a.body.setTexture(agentTexture(this, a.id, color));
      a.lantern.setFillStyle(color);
      a.glow.setFillStyle(color, 0.25);
      const idx = indexOf(a.id);
      if (idx !== a.idx) {
        a.idx = idx;
        const h = this.homeOf(a);
        a.c.setPosition(h.x, h.y).setDepth(this.depthOf(a));
      }
    }
  }

  private styleLabel(a: Agent) {
    const on = a === this.focus || a === this.focusTarget;
    a.label.setColor(a === this.focus ? "#ffe08a" : on ? "#fff4cf" : "#eef1fa");
  }

  /**
   * Greedy de-overlap: actor/target first, then top-to-bottom. Each label takes the first slot
   * (below, right, left, further below) that doesn't hit another label or a sprite.
   */
  private layoutLabels() {
    type R = { x0: number; x1: number; y0: number; y1: number };
    const hit = (p: R, q: R) => p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
    const list = [...this.agents.values()];
    const placed: R[] = list.map((a) => ({ x0: a.c.x - 12, x1: a.c.x + 12, y0: a.c.y - 16, y1: a.c.y + 15 }));
    const rank = (a: Agent) => (a === this.focus ? 0 : a === this.focusTarget ? 1 : 2);
    list.sort((p, q) => rank(p) - rank(q) || p.c.y - q.c.y);
    for (const a of list) {
      const w = a.label.width;
      const h = a.label.height;
      const side = w / 2 + 16;
      const slotsTried = [
        { dx: 0, dy: LABEL_DY }, { dx: side, dy: -h / 2 }, { dx: -side, dy: -h / 2 }, { dx: 0, dy: LABEL_DY + h + 1 },
      ];
      const rect = (o: { dx: number; dy: number }): R => ({
        x0: a.c.x + o.dx - w / 2, x1: a.c.x + o.dx + w / 2, y0: a.c.y + o.dy, y1: a.c.y + o.dy + h,
      });
      const at = slotsTried.find((o) => !placed.some((p) => hit(p, rect(o)))) ?? slotsTried[0];
      a.labelAt = at;
      placed.push(rect(at));
    }
  }

  private homeOf(a: Agent): Spot {
    if (a.stockedRound !== null) return jitter(SPOTS.stocks, a.idx);
    if (a.coalition) {
      if (!this.tents.has(a.coalition)) this.tents.set(a.coalition, this.tents.size % 6);
      return jitter(SPOTS.tents[this.tents.get(a.coalition)!], a.idx);
    }
    return homeSpot(a.idx);
  }

  private addCoins(a: Agent, d: number) {
    a.coins = Math.max(0, a.coins + d);
    this.updateLanterns();
  }

  // Relative coin balance reconstructed from applied actions and recorded world payouts.
  private updateLanterns() {
    const max = Math.max(1, ...[...this.agents.values()].map((a) => a.coins));
    for (const a of this.agents.values()) {
      const k = a.coins / max;
      a.lantern.setAlpha(0.3 + 0.7 * k);
      a.glow.setAlpha(0.05 + 0.4 * k).setRadius(8 + 10 * k);
    }
  }

  // ---- animation helpers ---------------------------------------------------------

  /** Agents with a bubble draw above everyone so the bubble is never hidden. */
  private depthOf(a: Agent): number {
    return a.bubble ? 10000 + a.c.y : a.c.y;
  }

  /** Each agent has its own queue, so agents never wait on each other. */
  private enqueue(a: Agent, fn: () => Promise<void>) {
    if (this.instant) return;
    a.queue = a.queue.then(fn, fn);
  }

  private walkHome(a: Agent) {
    if (this.instant) {
      const h = this.homeOf(a);
      a.c.setPosition(h.x, h.y).setDepth(this.depthOf(a));
      return;
    }
    this.enqueue(a, () => this.walk(a, this.homeOf(a)));
  }

  private walk(a: Agent, to: Spot): Promise<void> {
    const dist = Phaser.Math.Distance.Between(a.c.x, a.c.y, to.x, to.y);
    if (dist < 2) return Promise.resolve();
    if (this.reduced) {
      // Reduced motion: no walking, just appear at the destination.
      a.c.setPosition(to.x, to.y);
      a.c.setDepth(this.depthOf(a));
      return Promise.resolve();
    }
    // No walk frames in the pack: flip toward the target and waddle (tilt side to side + bob).
    a.body.setFlipX(to.x < a.c.x);
    const bob = this.tweens.add({ targets: a.body, y: -3, duration: 110, yoyo: true, repeat: -1 });
    a.body.setAngle(-9);
    const tilt = this.tweens.add({ targets: a.body, angle: 9, duration: 140, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    return new Promise((done) =>
      this.tweens.add({
        targets: a.c,
        x: to.x,
        y: to.y,
        duration: Math.min(1200, 250 + dist * 1.5),
        ease: "Sine.inOut",
        onUpdate: () => a.c.setDepth(this.depthOf(a)),
        onComplete: () => {
          bob.stop();
          tilt.stop();
          a.body.setY(0).setAngle(0);
          done();
        },
      }),
    );
  }

  /** Little double hop for when agents interact. Queued so it never fights a walk. */
  private hopNow(a: Agent): Promise<void> {
    if (this.reduced) return Promise.resolve();
    return new Promise((done) =>
      this.tweens.add({ targets: a.body, y: -9, duration: 120, yoyo: true, repeat: 1, ease: "Quad.out", onComplete: () => { a.body.setY(0); done(); } }),
    );
  }

  private hop(a: Agent) {
    this.enqueue(a, () => this.hopNow(a));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((done) => this.time.delayedCall(ms, done));
  }

  private mid(a: Agent, b: Agent): Spot {
    return { x: (a.c.x + b.c.x) / 2, y: (a.c.y + b.c.y) / 2 - 20 };
  }

  /** Action bubble attached to the agent (moves with it). The previous action's bubble dims. */
  private bubble(a: Agent, beat: Beat): Phaser.GameObjects.Container {
    // A lying offer looks honest at first; the red verdict replaces it after LIE_REVEAL_MS.
    const b = makeBubble(this, { icon: beat.icon, label: beat.label, violation: beat.violation && !beat.lie, worldX: a.c.x });
    this.attachBubble(a, b);
    if (!this.reduced) {
      b.setScale(0.6);
      this.tweens.add({ targets: b, scale: 1, duration: 140, ease: "Back.out" });
    }
    return b;
  }

  private attachBubble(a: Agent, b: Phaser.GameObjects.Container) {
    if (this.lastBubble && this.lastBubble !== a.bubble && this.lastBubble.active) this.lastBubble.setAlpha(0.55);
    a.bubble?.destroy();
    a.c.add(b);
    // An older bubble that would sit under the new one is removed, so the current action is never covered.
    const nb = b.getBounds();
    for (const o of this.agents.values()) {
      if (o === a || !o.bubble) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(nb, o.bubble.getBounds())) {
        o.bubble.destroy();
        o.bubble = undefined;
        o.c.setDepth(this.depthOf(o));
      }
    }
    a.bubble = b;
    this.lastBubble = b;
    a.c.setDepth(this.depthOf(a));
    this.time.delayedCall(BUBBLE_MS, () => {
      if (a.bubble === b) a.bubble = undefined;
      b.destroy();
      a.c.setDepth(this.depthOf(a));
    });
  }

  private emote(at: Spot, frame: number, ms = 1600) {
    if (this.instant) return;
    const i = this.add.image(at.x, at.y, "emotes", frame).setScale(SCALE).setDepth(20000);
    this.tweens.add({ targets: i, y: this.reduced ? at.y : at.y - 16, alpha: 0, delay: ms * 0.6, duration: ms * 0.4, onComplete: () => i.destroy() });
  }

  private float(at: Spot, text: string, color: string, ms = 1200, size = 18) {
    if (this.instant) return;
    const t = this.add
      .text(at.x, at.y, text, { fontFamily: PIXEL_FONT, fontSize: `${size}px`, color, fontStyle: "bold", stroke: "#0b0f1a", strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(20000);
    this.tweens.add({ targets: t, y: this.reduced ? at.y : at.y - 24, alpha: 0, duration: ms, ease: "Quad.in", onComplete: () => t.destroy() });
  }

  // ---- map -------------------------------------------------------------------------

  /** Ground baked once into a render texture at 1x and shown at 2x; props are sprites on top. */
  /** Shrine counter: "FUND n/30" with a progress bar that turns gold at the goal. */
  private refreshFund() {
    const sh = SPOTS.shrine;
    const done = this.fund >= LANTERN_GOAL;
    this.fundText.setText(`FUND ${this.fund}/${LANTERN_GOAL}`).setColor(done ? "#ffe9b0" : "#ffd36b");
    this.fundG.clear().fillStyle(0x05070d, 0.85).fillRect(sh.x - 62, sh.y - 108, 124, 10);
    this.fundG.fillStyle(done ? 0xffe27a : 0xb8892f).fillRect(sh.x - 60, sh.y - 106, 120 * Math.min(1, this.fund / LANTERN_GOAL), 6);
  }

  private drawMap() {
    const cols = WIDTH / (TILE * SCALE); // 40
    const rows = Math.ceil(HEIGHT / (TILE * SCALE)); // 23
    const rt = this.add.renderTexture(0, 0, cols * TILE, rows * TILE).setOrigin(0).setScale(SCALE).setDepth(-10);
    this.nightables.push(rt);
    const tile = (f: number, tx: number, ty: number) => rt.drawFrame("town", f, tx * TILE, ty * TILE);
    const fill = (f: number, x0: number, y0: number, x1: number, y1: number) => {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tile(f, x, y);
    };
    const hash = (x: number, y: number) => (x * 7919 + y * 104729) % 97;

    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) tile(hash(x, y) < 2 ? 2 : hash(x, y) < 20 ? 1 : 0, x, y);

    const DIRT = 25;
    fill(DIRT, 5, 6, 34, 6); // stall lane
    fill(DIRT, 5, 17, 34, 17); // hall lane
    fill(DIRT, 3, 11, 36, 12); // stocks - shrine
    fill(DIRT, 19, 6, 20, 17); // north - south
    fill(DIRT, 11, 8, 28, 15); // market square

    // trees along the top and bottom edges
    const trees = [4, 16, 28, 3, 15, 5, 29];
    for (let x = 0; x < cols; x++) for (const y of [0, 1, 22]) if (hash(x, y) % 3 === 0) tile(trees[hash(y, x) % trees.length], x, y);

    const prop = (sheet: string, f: number, x: number, y: number) => {
      const i = this.add.image(x, y, sheet, f).setScale(SCALE).setDepth(y);
      this.nightables.push(i);
      return i;
    };
    const label = (s: Spot, text: string, dy: number, size = 12, color = "#d8def5", wrap = 0) =>
      this.add
        .text(s.x, s.y + dy, text, { fontFamily: "monospace", fontSize: `${size}px`, color, align: "center", stroke: "#05070d", strokeThickness: 3, wordWrap: wrap ? { width: wrap } : undefined })
        .setOrigin(0.5)
        .setDepth(-1);
    /** 3-wide building: roof row over wall row, wall row centred at y. */
    const building = (x: number, y: number, roof: number[], wall: number[]) =>
      [roof, wall].forEach((row, r) => row.forEach((f, i) => prop("town", f, x + (i - 1) * 32, y - 32 + r * 32)));

    SPOTS.stalls.forEach((s, i) => {
      building(s.x, s.y, [52, 53, 54], [72, 74, 75]); // red roof over wood
      label(s, `Stall ${i + 1}`, -64);
    });
    SPOTS.tents.forEach((s, i) => {
      building(s.x, s.y + 85, [48, 49, 50], [76, 78, 79]); // coalition hall: grey roof over stone
      label(s, `Hall ${i + 1}`, 104);
    });

    const sh = SPOTS.shrine;
    this.add.circle(sh.x, sh.y - 30, 46, 0xffd98a, 0.18).setBlendMode(Phaser.BlendModes.ADD).setDepth(-4);
    prop("town", 104, sh.x, sh.y - 30).setDepth(-4);
    label(sh, "LANTERN SHRINE\nshared fund: 30 coins gives everyone a bonus", -78, 11, "#ffe9b0", 150);
    this.fundText = label(sh, "", -122, 14, "#ffd36b").setDepth(5);
    this.fundG = this.add.graphics().setDepth(5);
    this.refreshFund();

    const st = SPOTS.stocks;
    [69, 70, 71, 81, 82, 83, 93, 94, 95].forEach((f, k) =>
      prop("dungeon", f, st.x + ((k % 3) - 1) * 32, st.y + (Math.floor(k / 3) - 1) * 32).setDepth(-4),
    );
    label(st, "THE STOCKS\ncaught thieves wait here", -78, 11, "#ffb3b6", 150);
    label({ x: 640, y: 62 }, "MARKET STALLS: goods are bought and sold here", 0, 12, "#ffd9a8");
    label({ x: 640, y: 708 }, "COALITION HALLS: teams of agents who pay each member 2 coins a round", 0, 12, "#bcd0ff");
  }
}

export function createGame(parent: HTMLElement): Phaser.Game {
  narrate({ round: 1, phase: "negotiate", sentence: "Waiting for the market to open…", icon: null, violation: false });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH,
    height: HEIGHT,
    pixelArt: true,
    backgroundColor: "#0b0f1a",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [VillageScene],
  });
  // pixelArt makes the browser scale the canvas with nearest-neighbour. Below 1280px wide that drops
  // pixel rows and makes text ragged, so let the browser smooth the downscale; keep it crisp at >= 1x.
  const crispness = () => {
    const w = game.canvas?.getBoundingClientRect().width ?? WIDTH;
    if (game.canvas) game.canvas.style.imageRendering = w < WIDTH - 1 ? "auto" : "pixelated";
  };
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
    // FIT uses cached parent bounds; refresh alone keeps the mobile size.
    game.scale.getParentBounds();
    game.scale.refresh();
    crispness();
  }) : null;
  game.events.once("ready", () => {
    crispness();
    ro?.observe(parent);
    game.scale.on("resize", crispness);
  });
  game.events.once("destroy", () => ro?.disconnect());
  return game;
}
