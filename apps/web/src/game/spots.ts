// Owner: C. Named map coordinates in pixels on the 1280x720 canvas.
export interface Spot {
  x: number;
  y: number;
}

export const WIDTH = 1280;
export const HEIGHT = 720;

const row = (y: number): Spot[] => Array.from({ length: 6 }, (_, i) => ({ x: 240 + i * 160, y }));

export const SPOTS = {
  market: { x: 640, y: 380 },
  stalls: row(150), // 6, top row
  tents: row(585), // 6, bottom row (gather point; halls drawn below)
  shrine: { x: 1170, y: 380 },
  stocks: { x: 110, y: 380 },
};

/** Idle spot for agent #i (0..17): a ring around the market square. */
export function homeSpot(i: number): Spot {
  const a = (i / 18) * Math.PI * 2;
  return { x: SPOTS.market.x + Math.cos(a) * 230, y: SPOTS.market.y + Math.sin(a) * 120 };
}

/** Unique slot per agent index (0..17) in a 4x5 grid centred on the spot, so a crowd never stacks. */
export function jitter(s: Spot, k: number): Spot {
  return { x: s.x + ((k % 4) - 1.5) * 34, y: s.y + (Math.floor(k / 4) - 2) * 22 };
}
