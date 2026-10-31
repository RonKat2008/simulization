// Owner: C. Phaser village: draws the map and plays the ordered Event[] from the event store.
// Imported only on the client (see VillageCanvas), never during SSR.
import * as Phaser from "phaser";
import type { Event } from "@simulization/shared";
import { useEventStore } from "@/store/eventStore";
import { HEIGHT, SPOTS, WIDTH, homeSpot, jitter, type Spot } from "./spots";
import { COMPANY_TINT, EMOTE, SCALE, SHEETS, TILE, VIOLATION_RED } from "./assets";

export interface AgentInfo {
  id: string;
  name: string;
  company: string;
}

const COMPANY_COLOR: Record<string, number> = { A: COMPANY_TINT.blue, B: COMPANY_TINT.amber, C: COMPANY_TINT.teal };
const RED = VIOLATION_RED;
const DUSK = 0x3a4170; // ground/prop tint at 9 PM
const DAWN = 0xc9c3d6; // ...lifting toward 6 AM
const BODY_FRAME = 85; // Tiny Dungeon peasant, tinted per company
const STEP_MS = 400; // one event per tick at 1x
const BUBBLE_MS = 2500;
const START_COINS = 10;

const names = new Map<string, string>();
let current: VillageScene | null = null;

export function setAgentNames(list: AgentInfo[] = []) {
  names.clear();
  for (const a of list) names.set(a.id, a.name);
  current?.relabel();
}

let speed = 1;

export function setSpeed(x: number) {
  speed = x;
  if (!current) return;
  current.time.timeScale = x;
  current.tweens.timeScale = x;
}

interface Agent {
  id: string;
  idx: number; // 0..17, company-major
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

/** "B-04" → 9. Unknown shapes fall back to a hash so they still get a spot. */
function indexOf(id: string): number {
  const m = /^([A-C])-(\d+)$/.exec(id);
  if (m) return (m[1].charCodeAt(0) - 65) * 6 + ((Number(m[2]) - 1) % 6);
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 18;
}

class VillageScene extends Phaser.Scene {
  private agents!: Map<string, Agent>;
  private tents!: Map<string, number>;
  private pending!: Event[];
  private lastSeq!: number;
  private runId!: string | null;
  private round!: number;
  private nightables!: { setTint: (c: number) => unknown }[];

  constructor() {
    super("village");
  }

  preload() {
    for (const s of SHEETS)
      this.load.spritesheet(s.key, s.path, { frameWidth: s.frameWidth, frameHeight: s.frameHeight, margin: s.margin, spacing: s.spacing });
  }

  create() {
    current = this;
    setSpeed(speed); // survives scene restarts and remounts
    (globalThis as { __village?: unknown }).__village = this; // debug handle for the browser console
    this.agents = new Map();
    this.tents = new Map();
    this.pending = [];
    this.lastSeq = 0;
    this.runId = null;
    this.round = 0;
    this.nightables = [];

    this.drawMap();
    this.setNight(1);
    this.relabel();
    this.time.addEvent({ delay: STEP_MS, loop: true, callback: () => this.tick() });

    const unsub = useEventStore.subscribe((s) => this.sync(s.events, s.selectedAgentId));
    const s = useEventStore.getState();
    this.sync(s.events, s.selectedAgentId);
    this.events.once("shutdown", unsub);
    this.events.once("destroy", () => {
      unsub();
      if (current === this) current = null;
    });
  }

  // ---- store → pending queue -------------------------------------------------

  private sync(events: Event[], selected: string | null) {
    const newRun = events.length > 0 && this.runId !== null && events[0].runId !== this.runId;
    if ((events.length === 0 && this.lastSeq > 0) || newRun) {
      this.scene.restart(); // reset() or a different run loaded: start clean
      return;
    }
    if (events.length) this.runId = events[0].runId;
    for (const e of events) {
      if (e.seq > this.lastSeq) {
        if (e.actorId !== "world") this.agent(e.actorId); // spawn everyone up front, idle at home
        if (e.targetId) this.agent(e.targetId);
        this.pending.push(e);
        this.lastSeq = e.seq;
      }
    }
    for (const a of this.agents.values()) a.ring.setVisible(a.id === selected);
  }

  private tick() {
    // Skip events with no visual so the clock only spends time on visible ones.
    while (this.pending.length) {
      const e = this.pending.shift()!;
      if (this.play(e)) break;
    }
  }

  // ---- event → visual ----------------------------------------------------------

  /** Returns true if the event produced something visible. */
  private play(e: Event): boolean {
    this.releaseStocks(e);
    if (e.round !== this.round) this.setNight(e.round);
    if (e.actorId === "world") return false;
    const a = this.agent(e.actorId);
    const t = e.targetId ? this.agent(e.targetId) : null;

    switch (e.type) {
      case "message":
      case "pact_propose":
        this.say(a, e.text ?? "", false);
        return true;
      case "pact_accept":
        this.say(a, e.text ?? "", false);
        if (t) this.emote(this.mid(a, t), EMOTE.heart);
        return true;
      case "pact_break":
        if (t) this.emote(this.mid(a, t), EMOTE.heartBroken, 2500);
        return true;
      case "coalition_create":
      case "coalition_join":
        a.coalition = e.channel ?? null;
        if (e.type === "coalition_create" && e.text) this.say(a, e.text, false);
        this.walkHome(a);
        return true;
      case "coalition_leave":
        a.coalition = null;
        this.walkHome(a);
        return true;
      case "trade_offer": {
        if (!t) return false;
        const lie = e.flags.includes("lie");
        const stall = SPOTS.stalls[a.idx % 6];
        this.enqueue(a, async () => {
          await this.walk(a, { x: stall.x - 22, y: stall.y + 40 });
          this.say(a, e.text ?? "", lie);
          if (lie) this.emote({ x: a.c.x, y: a.c.y - 80 }, EMOTE.exclamation, 2500);
          await this.wait(1600);
        });
        this.enqueue(t, async () => {
          await this.walk(t, { x: stall.x + 22, y: stall.y + 40 });
          await this.wait(1600);
        });
        this.walkHome(a);
        this.walkHome(t);
        return true;
      }
      case "trade_accept":
      case "trade_decline":
        this.say(a, e.text ?? (e.type === "trade_accept" ? "Deal." : "No deal."), false);
        if (e.type === "trade_accept" && e.claim && t) {
          this.addCoins(a, -e.claim.price);
          this.addCoins(t, e.claim.price);
          this.emote({ x: t.c.x, y: t.c.y - 40 }, EMOTE.cash);
        }
        return true;
      case "work":
        this.addCoins(a, 1);
        this.float({ x: a.c.x, y: a.c.y - 40 }, "+1", "#9be38a");
        return true;
      case "contribute":
        this.addCoins(a, -1);
        this.enqueue(a, async () => {
          await this.walk(a, jitter(SPOTS.shrine, a.idx));
          this.float({ x: SPOTS.shrine.x, y: SPOTS.shrine.y - 50 }, "+1", "#ffd36b");
        });
        this.walkHome(a);
        return true;
      case "steal":
        if (!t) return false;
        this.addCoins(a, 4);
        this.addCoins(t, -4);
        this.enqueue(a, async () => {
          await this.walk(a, { x: t.c.x + 20, y: t.c.y });
          this.float({ x: t.c.x, y: t.c.y - 40 }, "-4", "#e5484d");
          a.c.setAlpha(0.6);
          await this.wait(300);
          a.c.setAlpha(1);
        });
        this.walkHome(a);
        return true;
      case "caught":
        this.addCoins(a, -6);
        a.stockedRound = e.round;
        this.say(a, "Caught!", true);
        this.walkHome(a);
        return true;
      default: // pass, system
        return false;
    }
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
    const color = COMPANY_COLOR[id[0]] ?? 0xaaaaaa;
    const home = homeSpot(idx);

    const glow = this.add.circle(14, 2, 14, color, 0.25).setBlendMode(Phaser.BlendModes.ADD);
    const ring = this.add.ellipse(0, 15, 34, 12).setStrokeStyle(2, 0xffffff).setVisible(false);
    const body = this.add.sprite(0, 0, "dungeon", BODY_FRAME).setScale(SCALE).setTint(lerpColor(color, 0xffffff, 0.3));
    const lantern = this.add.circle(14, 2, 3, color);
    const label = this.add
      .text(0, 17, names.get(id) ?? id, { fontFamily: "monospace", fontSize: "11px", color: "#d9dde8" })
      .setOrigin(0.5, 0);

    const c = this.add.container(home.x, home.y, [glow, ring, body, lantern, label]);
    c.setSize(32, 40).setInteractive({ useHandCursor: true }).setDepth(home.y);
    c.on("pointerdown", () => useEventStore.getState().select(id));

    a = { id, idx, c, label, body, lantern, glow, ring, queue: Promise.resolve(), coins: START_COINS, coalition: null, stockedRound: null };
    this.agents.set(id, a);
    this.updateLanterns();
    return a;
  }

  relabel() {
    for (const id of names.keys()) this.agent(id);
    for (const a of this.agents.values()) a.label.setText(names.get(a.id) ?? a.id);
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

  // ponytail: coins replayed from events only; coalition payouts + lantern bonus aren't events, so glow is approximate.
  private updateLanterns() {
    const max = Math.max(1, ...[...this.agents.values()].map((a) => a.coins));
    for (const a of this.agents.values()) {
      const k = a.coins / max;
      a.lantern.setAlpha(0.3 + 0.7 * k);
      a.glow.setAlpha(0.05 + 0.4 * k).setRadius(8 + 10 * k);
    }
  }

  // ---- animation helpers ---------------------------------------------------------

  /** Each agent has its own queue, so agents never wait on each other. */
  private enqueue(a: Agent, fn: () => Promise<void>) {
    a.queue = a.queue.then(fn, fn);
  }

  private walkHome(a: Agent) {
    this.enqueue(a, () => this.walk(a, this.homeOf(a)));
  }

  private walk(a: Agent, to: Spot): Promise<void> {
    const dist = Phaser.Math.Distance.Between(a.c.x, a.c.y, to.x, to.y);
    if (dist < 2) return Promise.resolve();
    // No walk frames in the pack: flip toward the target and bob.
    a.body.setFlipX(to.x < a.c.x);
    const bob = this.tweens.add({ targets: a.body, y: -3, duration: 110, yoyo: true, repeat: -1 });
    return new Promise((done) =>
      this.tweens.add({
        targets: a.c,
        x: to.x,
        y: to.y,
        duration: Math.min(1200, 250 + dist * 1.5),
        ease: "Sine.inOut",
        onUpdate: () => a.c.setDepth(a.c.y),
        onComplete: () => {
          bob.stop();
          a.body.setY(0);
          done();
        },
      }),
    );
  }

  private wait(ms: number): Promise<void> {
    return new Promise((done) => this.time.delayedCall(ms, done));
  }

  private mid(a: Agent, b: Agent): Spot {
    return { x: (a.c.x + b.c.x) / 2, y: (a.c.y + b.c.y) / 2 - 20 };
  }

  /** Speech bubble attached to the agent (moves with it). Red outline marks a lie. */
  private say(a: Agent, text: string, red: boolean) {
    if (!text) return;
    a.bubble?.destroy();
    const short = text.length > 40 ? text.slice(0, 39) + "…" : text;
    const t = this.add
      .text(0, 0, short, { fontFamily: "monospace", fontSize: "11px", color: "#11131a", wordWrap: { width: 150 } })
      .setOrigin(0.5, 1);
    const w = t.width + 12;
    const h = t.height + 8;
    const g = this.add.graphics();
    g.fillStyle(0xf3efe2, 0.95).fillRoundedRect(-w / 2, -h - 4, w, h, 5);
    g.lineStyle(red ? 3 : 1, red ? RED : 0x555555).strokeRoundedRect(-w / 2, -h - 4, w, h, 5);
    t.setY(-8);
    const b = this.add.container(0, -28, [g, t]);
    a.c.add(b);
    a.c.setDepth(10000 + a.c.y); // bubbles on top
    a.bubble = b;
    this.time.delayedCall(BUBBLE_MS, () => {
      if (a.bubble === b) a.bubble = undefined;
      b.destroy();
      a.c.setDepth(a.c.y);
    });
  }

  private emote(at: Spot, frame: number, ms = 1600) {
    const i = this.add.image(at.x, at.y, "emotes", frame).setScale(SCALE).setDepth(20000);
    this.tweens.add({ targets: i, y: at.y - 16, alpha: 0, delay: ms * 0.6, duration: ms * 0.4, onComplete: () => i.destroy() });
  }

  private float(at: Spot, text: string, color: string, ms = 1200, size = 16) {
    const t = this.add
      .text(at.x, at.y, text, { fontFamily: "monospace", fontSize: `${size}px`, color, fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(20000);
    this.tweens.add({ targets: t, y: at.y - 24, alpha: 0, duration: ms, ease: "Quad.in", onComplete: () => t.destroy() });
  }

  // ---- map -------------------------------------------------------------------------

  /** Ground baked once into a render texture at 1x and shown at 2x; props are sprites on top. */
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
    const label = (s: Spot, text: string, dy: number) =>
      this.add.text(s.x, s.y + dy, text, { fontFamily: "monospace", fontSize: "10px", color: "#d8def5" }).setOrigin(0.5).setDepth(-1);
    /** 3-wide building: roof row over wall row, wall row centred at y. */
    const building = (x: number, y: number, roof: number[], wall: number[]) =>
      [roof, wall].forEach((row, r) => row.forEach((f, i) => prop("town", f, x + (i - 1) * 32, y - 32 + r * 32)));

    SPOTS.stalls.forEach((s, i) => {
      building(s.x, s.y, [52, 53, 54], [72, 74, 75]); // red roof over wood
      label(s, `stall ${i + 1}`, -60);
    });
    SPOTS.tents.forEach((s, i) => {
      building(s.x, s.y + 85, [48, 49, 50], [76, 78, 79]); // coalition hall: grey roof over stone
      label(s, `tent ${i + 1}`, 122);
    });

    const sh = SPOTS.shrine;
    this.add.circle(sh.x, sh.y - 30, 46, 0xffd98a, 0.18).setBlendMode(Phaser.BlendModes.ADD).setDepth(-4);
    prop("town", 104, sh.x, sh.y - 30).setDepth(-4);
    label(sh, "lantern shrine", -64);

    const st = SPOTS.stocks;
    [69, 70, 71, 81, 82, 83, 93, 94, 95].forEach((f, k) =>
      prop("dungeon", f, st.x + ((k % 3) - 1) * 32, st.y + (Math.floor(k / 3) - 1) * 32).setDepth(-4),
    );
    label(st, "stocks", -64);
  }
}

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH,
    height: HEIGHT,
    pixelArt: true,
    backgroundColor: "#0b0f1a",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [VillageScene],
  });
}
