// Owner: C. Named map coordinates in pixels; fill in once the tilemap is drawn.
export interface Spot {
  x: number;
  y: number;
}

export interface Spots {
  market: Spot | null;
  stalls: Spot[]; // 6
  tents: Spot[]; // 6
  shrine: Spot | null;
  stocks: Spot | null;
}

export const SPOTS: Spots = {
  market: null,
  stalls: [],
  tents: [],
  shrine: null,
  stocks: null,
};
