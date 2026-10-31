/**
 * Asset sheet metadata + curated frame indices (Kenney, CC0).
 * Frame index = row * columns + col, counted from the top-left (Phaser spritesheet order).
 * Indices marked `// verify` should be eyeballed once in the running game.
 */

export interface SheetDef {
  readonly key: string;
  readonly path: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly margin: number;
  readonly spacing: number;
  readonly columns: number;
  readonly rows: number;
}

/** Tiny Town: 192x176, 12x11 tiles, no spacing. Draw at 2x. */
export const TOWN_SHEET: SheetDef = {
  key: "town", path: "/assets/tiny-town/tilemap_packed.png",
  frameWidth: 16, frameHeight: 16, margin: 0, spacing: 0, columns: 12, rows: 11,
};

/** Tiny Dungeon: 192x176, 12x11 tiles, no spacing. Characters live on rows 7-9. */
export const DUNGEON_SHEET: SheetDef = {
  key: "dungeon", path: "/assets/tiny-dungeon/tilemap_packed.png",
  frameWidth: 16, frameHeight: 16, margin: 0, spacing: 0, columns: 12, rows: 11,
};

/** Emotes pack, pixel_style1: 80x96, 5x6 frames of 16px (bubble baked in), no spacing. */
export const EMOTE_SHEET: SheetDef = {
  key: "emotes", path: "/assets/emotes/pixel_style1.png",
  frameWidth: 16, frameHeight: 16, margin: 0, spacing: 0, columns: 5, rows: 6,
};

/** Pixel UI pack: 538x592, 16px frames with 2px spacing (30 columns). For D's HUD / 9-slice. */
export const UI_SHEET: SheetDef = {
  key: "ui", path: "/assets/pixel-ui/UIpackSheet_transparent.png",
  frameWidth: 16, frameHeight: 16, margin: 0, spacing: 2, columns: 30, rows: 33,
};

export const SHEETS: readonly SheetDef[] = [TOWN_SHEET, DUNGEON_SHEET, EMOTE_SHEET, UI_SHEET];

/** Tiny Town frames (sheet key "town"). Tall objects (trees) are two stacked tiles. */
export const TOWN = {
  grass: 0,
  grassTufts: 1,
  grassFlowers: 2,
  dirt: 13,           // solid path interior
  dirtPlain: 25,      // verify (inner dirt fill)
  pathStrip: [39, 40, 41, 42],
  cobble: 43,         // mossy stone paving, good for market square
  pine: { top: 4, bottom: 16 },
  autumnTree: { top: 3, bottom: 15 },
  bush: 5,
  mushrooms: 29,
  fenceH: 81,         // verify
  fenceV: 47,         // verify
  fenceCornerNW: 44,  // verify
  fencePost: 69,      // verify
  sign: 83,
  handcart: 57,       // closest thing to a market stall prop
  target: 95,         // verify
  coin: 93,           // gold token (in-world coins)
  lantern: 94,        // verify: amber dome, no real lantern tile exists; draw glow in code
  // House: roof row + wall row + door row
  roofRed: [52, 53, 54], roofRedChimney: 55, roofRedGable: 67,
  roofGrey: [48, 49, 50], roofGreyChimney: 51, roofGreyGable: 63,
  wallWood: [72, 73], wallWoodDoorway: 74,
  wallStone: [76, 77], wallStoneDoorway: 78,
  door: [85, 86, 87], window: 84,
  // Stall = red roof strip (awning) above wallWood; Tent = roofRedGable + roofRed (no tent tile exists) // verify composition
  awning: [52, 53, 54],
  tentTop: 67, tentBase: 66, // verify
  stoneFloor: [96, 97, 98, 108, 109, 110],
  barrel: 130, bucketWater: 131,
} as const;

/** Tiny Dungeon frames (sheet key "dungeon"). Characters are static 1-frame sprites. */
export const DUNGEON = {
  // Villager bodies (tint-friendly: plain clothes, light skin). No walk frames in pack:
  // fake walking with a 2px y-bob / x-flip tween.
  body: 85,           // primary shared body (brown-haired peasant)
  bodyAlt: [86, 88, 97, 98], // verify alternates
  cloakWizard: 84,
  stocksBars: [67, 68, 79, 80], // verify: wooden/iron bars, use for the stocks
  stocksCage: [69, 70, 71, 81, 82, 83, 93, 94, 95], // 3x3 cage; verify
  chest: 89,
  torchWall: 29,      // verify: red banner / wall lamp
} as const;

/** Emote frames (sheet key "emotes"). Bubble is part of each frame. */
export const EMOTE = {
  bubbleBlank: 12,    // empty speech bubble
  bubbleDots: 8,      // "..." speaking/thinking
  exclamation: 22,    // red "!" violation marker
  exclamations: 17,   // verify
  alert: 24,          // verify: orange burst
  heartBroken: 21,    // cracked heart (lost trust)
  heart: 26,
  cash: 9,            // coins ($)
  cross: 23,          // red X
  question: 25,
  idea: 11,
  anger: 19,          // verify
  sleep: 20,
} as const;

/** Characters: company identity comes from tinting, red is reserved for violations. */
export const COMPANY_TINT = { blue: 0x5b8def, amber: 0xf2a93b, teal: 0x2fc4b2 } as const;
export const VIOLATION_RED = 0xe5484d;
export const TILE = 16;
export const SCALE = 2;
