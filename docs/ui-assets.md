# UI assets

All packs are Kenney (https://kenney.nl), CC0 1.0; each folder under `apps/web/public/assets/` includes its `License.txt`. Total about 80 KB.

| Folder | Pack and source | Contents |
|---|---|---|
| `tiny-town/` | Tiny Town, https://kenney.nl/assets/tiny-town | `tilemap_packed.png`, 12x11 tiles of 16px |
| `tiny-dungeon/` | Tiny Dungeon, https://kenney.nl/assets/tiny-dungeon | `tilemap_packed.png`, 12x11; characters, bars, chests |
| `emotes/` | Emotes Pack, https://kenney.nl/assets/emotes-pack | `pixel_style1.png` (5x6, 16px, bubble baked in) + `.xml` names |
| `pixel-ui/` | Pixel UI Pack, https://kenney.nl/assets/pixel-ui-pack | `UIpackSheet_transparent.png`, 16px, 2px spacing |

Frame indices: `apps/web/src/game/assets.ts`. Entries marked `// verify` need a visual check.

## Who uses what
- **Person C (Phaser, `apps/web/src/game`)**: Tiny Town tiles, Tiny Dungeon character body (frame 85) tinted by company, emotes for speech bubble, "!", cracked heart, coins.
- **Person D (HUD, `src/app`, `src/hud`)**: Pixel UI sheet for panels and buttons (or plain CSS panels in the same palette), fonts below.

## Known gaps
- No lantern, tent or market-stall tiles. Compose stalls from awning roof tiles over wood wall; tents from the gable and roof tiles; draw the lantern as tile 94 (amber dome) plus a code-drawn additive glow circle.
- No walk frames in Tiny Dungeon. Fake a walk with a 2px bob tween plus `flipX`.
- Character is colored, not greyscale. `setTint` multiplies, so use light tints, or overlay a cloak and lantern colored rectangle for company identity.

## Fonts (Google Fonts, OFL; not downloaded)
- Headings: **Press Start 2P** (alt: Silkscreen, Pixelify Sans).
- Data and body: **Inter** or **IBM Plex Mono** for numbers and event feed.

## Night palette tokens
| Token | Hex |
|---|---|
| `--bg-night` (base) | `#0b1020` |
| `--bg-panel` | `#141b34` |
| `--border` | `#2a3560` |
| `--text` | `#d8def5` |
| `--text-dim` | `#8591b8` |
| `--company-blue` | `#5b8def` |
| `--company-amber` | `#f2a93b` |
| `--company-teal` | `#2fc4b2` |
| `--violation-red` (violations only) | `#e5484d` |
| `--lantern-glow` | `#ffd98a` |

## Phaser preload
```ts
import { SHEETS, COMPANY_TINT, SCALE } from "./assets";

preload() {
  for (const s of SHEETS) {
    this.load.spritesheet(s.key, s.path, {
      frameWidth: s.frameWidth, frameHeight: s.frameHeight,
      margin: s.margin, spacing: s.spacing,
    });
  }
}
create() {
  this.textures.get("town").setFilter(Phaser.Textures.FilterMode.NEAREST); // crisp pixels
  const a = this.add.sprite(100, 100, "dungeon", 85).setScale(SCALE).setTint(COMPANY_TINT.amber);
  this.add.sprite(100, 80, "emotes", 22).setScale(SCALE); // red "!"
}
```
Also set `pixelArt: true` in the Phaser game config.
