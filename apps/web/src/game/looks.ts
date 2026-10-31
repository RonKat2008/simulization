// Owner: C. Purely cosmetic agent looks (no effect on model behavior): a base Kenney frame plus
// skin/hair palette swaps, with the company color painted onto the outfit. Deterministic per agent id.
import type * as Phaser from "phaser";

// Tiny Dungeon humans: brown-haired, long hair, short hair, long-haired dress, headband, bald/bearded.
const FRAMES = [85, 88, 98, 99, 112, 86];
const SKIN: [string, string][] = [["f7c282", "e19a65"], ["fbd7b4", "e8b48c"], ["d99a5e", "b87a45"], ["a8683c", "86492a"], ["6e4228", "52301c"]];
const HAIR: [string, string][] = [["763b36", "bd6c4a"], ["1e1a24", "3a3446"], ["b8892f", "e8c35a"], ["a23d1d", "d9703a"], ["6b7280", "c0c6d0"]];
const KEEP = new Set(["3f2631", "262b44"]); // outline + eyes
const hex = (s: string) => [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
const key = (r: number, g: number, b: number) => [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

let sheet: ImageData | null = null;

/** Texture key for this agent's look (created once, reused across scene restarts). */
export function agentTexture(scene: Phaser.Scene, id: string, companyColor: number): string {
  // Keyed by color too: the same id can be shown LABELED (company outfit) and BLIND (neutral) in one session.
  const tex = `look-${id}-${companyColor.toString(16)}`;
  if (scene.textures.exists(tex)) return tex;
  if (!sheet) {
    const img = scene.textures.get("dungeon").getSourceImage() as CanvasImageSource;
    const c = document.createElement("canvas");
    c.width = 192;
    c.height = 176;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    sheet = g.getImageData(0, 0, 192, 176);
  }
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const frame = FRAMES[h % FRAMES.length];
  const skin = SKIN[(h >> 3) % SKIN.length];
  const hair = HAIR[(h >> 6) % HAIR.length];
  const map = new Map<string, string>([
    ["f7c282", skin[0]], ["e19a65", skin[1]], ["eaa56c", skin[1]],
    ["763b36", hair[0]], ["bd6c4a", hair[1]],
  ]);
  const [cr, cg, cb] = [(companyColor >> 16) & 255, (companyColor >> 8) & 255, companyColor & 255];

  const out = document.createElement("canvas");
  out.width = out.height = 16;
  const g = out.getContext("2d")!;
  const px = g.createImageData(16, 16);
  const fx = (frame % 12) * 16;
  const fy = Math.floor(frame / 12) * 16;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const s = ((fy + y) * 192 + fx + x) * 4;
      const d = (y * 16 + x) * 4;
      let [r, gg, b] = [sheet.data[s], sheet.data[s + 1], sheet.data[s + 2]];
      const a = sheet.data[s + 3];
      const k = key(r, gg, b);
      const isSkin = k === "f7c282" || k === "e19a65" || k === "eaa56c";
      const isHair = (k === "763b36" || k === "bd6c4a") && y <= 6; // below the head these colors are clothes
      if (a && (isSkin || isHair)) [r, gg, b] = hex(map.get(k)!);
      else if (a && !KEEP.has(k) && y >= 9) {
        // outfit: company color, keeping the original shading
        const lum = (0.3 * r + 0.59 * gg + 0.11 * b) / 255;
        const m = 0.5 + lum * 0.8;
        [r, gg, b] = [Math.min(255, cr * m), Math.min(255, cg * m), Math.min(255, cb * m)];
      }
      px.data.set([r, gg, b, a], d);
    }
  g.putImageData(px, 0, 0);
  scene.textures.addCanvas(tex, out);
  return tex;
}
