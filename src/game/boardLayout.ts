/**
 * Board graph — branching is via `next.length > 1` only (no split/merge tile types).
 * Coordinates are layout-space percentages (roughly 8–92).
 *
 * Mario Party–style journey in a Valorant aesthetic:
 * - Outer racetrack (~36) with regional pacing
 * - Mid shortcut ring (~14) + inner plaza (~8)
 * - Route choices only via `next[]` multiplicity
 * - Planar: concentric rings + radial connectors (no visual crossings)
 */

export type TileType =
  | "start"
  | "empty"
  | "normal"
  | "spike"
  | "shop"
  | "event"
  | "minigame"
  | "lucky"
  | "risk"
  | "ult-orb"
  | "special";

/** Legacy tile types from older saves — remapped on load. */
export type LegacyTileType = TileType | "split" | "merge";

export type BoardNode = {
  id: string;
  type: TileType;
  x: number;
  y: number;
  next: string[];
};

/**
 * ~58-tile planar network:
 * Safe → Prep → Danger → Recovery → Crossroads → Chaos → Safe
 * Clear START plaza; all players spawn there.
 */
export const boardLayout: BoardNode[] = [
  // ── Safe (NW approach) ───────────────────────────────────────
  { id: "start", type: "start", x: 21, y: 21, next: ["o1"] },
  { id: "o1", type: "normal", x: 26.5, y: 16.4, next: ["o2"] },
  { id: "o2", type: "normal", x: 32.7, y: 12.8, next: ["o3"] },
  { id: "o3", type: "lucky", x: 39.4, y: 10.4, next: ["o4"] },

  // ── Prep (N) ─────────────────────────────────────────────────
  { id: "o4", type: "spike", x: 46.4, y: 9.2, next: ["o5", "m2"] },
  { id: "o5", type: "normal", x: 53.6, y: 9.2, next: ["o6"] },
  { id: "o6", type: "shop", x: 60.6, y: 10.4, next: ["o7"] },
  { id: "o7", type: "normal", x: 67.3, y: 12.8, next: ["o8"] },
  { id: "o8", type: "event", x: 73.5, y: 16.4, next: ["o9"] },
  { id: "o9", type: "normal", x: 79, y: 21, next: ["o10"] },
  { id: "o10", type: "lucky", x: 83.6, y: 26.5, next: ["o11"] },

  // ── Danger (E) ───────────────────────────────────────────────
  { id: "o11", type: "event", x: 87.2, y: 32.7, next: ["o12"] },
  { id: "o12", type: "risk", x: 89.6, y: 39.4, next: ["o13"] },
  { id: "o13", type: "minigame", x: 90.8, y: 46.4, next: ["o14", "m6"] },
  { id: "o14", type: "normal", x: 90.8, y: 53.6, next: ["o15"] },
  { id: "o15", type: "spike", x: 89.6, y: 60.6, next: ["o16"] },
  { id: "o16", type: "risk", x: 87.2, y: 67.3, next: ["o17"] },
  { id: "o17", type: "event", x: 83.6, y: 73.5, next: ["o18"] },
  { id: "o18", type: "normal", x: 79, y: 79, next: ["o19"] },

  // ── Recovery (S) ─────────────────────────────────────────────
  { id: "o19", type: "normal", x: 73.5, y: 83.6, next: ["o20"] },
  { id: "o20", type: "shop", x: 67.3, y: 87.2, next: ["o21"] },
  { id: "o21", type: "lucky", x: 60.6, y: 89.6, next: ["o22"] },
  { id: "o22", type: "special", x: 53.6, y: 90.8, next: ["o23", "m9"] },
  { id: "o23", type: "normal", x: 46.4, y: 90.8, next: ["o24"] },
  { id: "o24", type: "event", x: 39.4, y: 89.6, next: ["o25"] },
  { id: "o25", type: "normal", x: 32.7, y: 87.2, next: ["o26"] },

  // ── Crossroads (SW) ──────────────────────────────────────────
  { id: "o26", type: "event", x: 26.5, y: 83.6, next: ["o27"] },
  { id: "o27", type: "shop", x: 21, y: 79, next: ["o28"] },
  { id: "o28", type: "normal", x: 16.4, y: 73.5, next: ["o29"] },
  { id: "o29", type: "ult-orb", x: 12.8, y: 67.3, next: ["o30"] },
  { id: "o30", type: "risk", x: 10.4, y: 60.6, next: ["o31"] },
  { id: "o31", type: "minigame", x: 9.2, y: 53.6, next: ["o32", "m13"] },

  // ── Chaos (W) → Safe ─────────────────────────────────────────
  { id: "o32", type: "event", x: 9.2, y: 46.4, next: ["o33"] },
  { id: "o33", type: "ult-orb", x: 10.4, y: 39.4, next: ["o34"] },
  { id: "o34", type: "special", x: 12.8, y: 32.7, next: ["o35"] },
  { id: "o35", type: "normal", x: 16.4, y: 26.5, next: ["start"] },

  // ── Mid shortcut ring (CW from NW) ───────────────────────────
  { id: "m1", type: "normal", x: 37, y: 27.5, next: ["m2"] },
  { id: "m2", type: "event", x: 48.1, y: 24.1, next: ["m3", "i1"] },
  { id: "m3", type: "normal", x: 59.5, y: 25.8, next: ["m4", "o7"] },
  { id: "m4", type: "shop", x: 69.1, y: 32.3, next: ["m5"] },
  { id: "m5", type: "lucky", x: 74.8, y: 42.3, next: ["m6", "i3"] },
  { id: "m6", type: "normal", x: 75.7, y: 53.9, next: ["m7"] },
  { id: "m7", type: "spike", x: 71.5, y: 64.6, next: ["m8", "o16"] },
  { id: "m8", type: "normal", x: 63, y: 72.5, next: ["m9"] },
  { id: "m9", type: "event", x: 51.9, y: 75.9, next: ["m10", "i5"] },
  { id: "m10", type: "normal", x: 40.5, y: 74.2, next: ["m11", "o25"] },
  { id: "m11", type: "minigame", x: 30.9, y: 67.7, next: ["m12"] },
  { id: "m12", type: "ult-orb", x: 25.2, y: 57.7, next: ["m13", "i7"] },
  { id: "m13", type: "normal", x: 24.3, y: 46.1, next: ["m14"] },
  { id: "m14", type: "normal", x: 28.5, y: 35.4, next: ["m1", "o34"] },

  // ── Inner plaza ──────────────────────────────────────────────
  { id: "i1", type: "normal", x: 45.9, y: 38.7, next: ["i2"] },
  { id: "i2", type: "event", x: 55.1, y: 39.1, next: ["i3", "m3"] },
  { id: "i3", type: "normal", x: 61.3, y: 45.9, next: ["i4"] },
  { id: "i4", type: "minigame", x: 60.9, y: 55.1, next: ["i5", "m6"] },
  { id: "i5", type: "normal", x: 54.1, y: 61.3, next: ["i6"] },
  { id: "i6", type: "normal", x: 44.9, y: 60.9, next: ["i7", "m10"] },
  { id: "i7", type: "normal", x: 38.7, y: 54.1, next: ["i8"] },
  { id: "i8", type: "normal", x: 39.1, y: 44.9, next: ["i1", "m13"] },
];

const LEGACY_POSITION_REMAP: Record<string, string> = {
  "top-1": "o1",
  "top-2": "o4",
  "top-split": "o4",
  "top-outer-1": "o7",
  "top-inner-1": "m1",
  "top-inner-2": "m3",
  "right-1": "o9",
  "right-2": "o12",
  "right-merge": "o13",
  "right-3": "o14",
  "bottom-1": "o16",
  "bottom-2": "o18",
  "bottom-3": "o19",
  "bottom-split": "o22",
  "bottom-outer-1": "o20",
  "bottom-inner-1": "m8",
  "bottom-inner-2": "m10",
  "left-3": "o24",
  "left-2": "o26",
  "left-merge": "o31",
  "left-1": "o34",
  // Prior concentric mid / inner ids
  "m-top-1": "m1",
  "m-top-2": "m2",
  "m-top-3": "m3",
  "m-right-1": "m4",
  "m-right-2": "m5",
  "m-right-3": "m7",
  "m-bot-1": "m8",
  "m-bot-2": "m9",
  "m-bot-3": "m10",
  "m-left-1": "m11",
  "m-left-2": "m12",
  "m-left-3": "m14",
  "inner-n": "i1",
  "inner-ne": "i2",
  "inner-e": "i3",
  "inner-se": "i4",
  "inner-s": "i5",
  "inner-sw": "i6",
  "inner-w": "i7",
  "inner-nw": "i8",
  "inner-hub": "i2",
  "inner-exit-ne": "i4",
  "inner-exit-sw": "i6",
  // Outer ids o30+ that shifted when the track grew
  o30: "o30",
};

const KNOWN_TILE_TYPES: ReadonlySet<string> = new Set([
  "start",
  "empty",
  "normal",
  "spike",
  "shop",
  "event",
  "minigame",
  "lucky",
  "risk",
  "ult-orb",
  "special",
]);

export function getNodeById(nodeId: string): BoardNode | undefined {
  return boardLayout.find((node) => node.id === nodeId);
}

/** Remap a saved position id onto the current board (legacy → new). */
export function migrateBoardPosition(nodeId: string | null | undefined): string {
  if (!nodeId) return "start";
  if (getNodeById(nodeId)) return nodeId;
  const remapped = LEGACY_POSITION_REMAP[nodeId];
  if (remapped && getNodeById(remapped)) return remapped;
  return "start";
}

/** Normalize legacy split/merge types if present on a node snapshot. */
export function migrateTileType(type: string): TileType {
  if (type === "split" || type === "merge") return "normal";
  if (KNOWN_TILE_TYPES.has(type)) return type as TileType;
  return "normal";
}

export function movePlayerBySteps(
  startNodeId: string,
  steps: number,
  preferredPath?: string[]
): string {
  let currentId = migrateBoardPosition(startNodeId);

  for (let i = 0; i < steps; i++) {
    const currentNode = getNodeById(currentId);
    if (!currentNode || currentNode.next.length === 0) break;

    if (currentNode.next.length === 1) {
      currentId = currentNode.next[0]!;
      continue;
    }

    const preferredNext = preferredPath?.find((id) =>
      currentNode.next.includes(id)
    );

    currentId = preferredNext ?? currentNode.next[0]!;
  }

  return currentId;
}

export function listBoardBranchPoints(): BoardNode[] {
  return boardLayout.filter((node) => node.next.length > 1);
}

/** Landmark ids used by the match-start camera overview. */
export function listBoardLandmarks(): { id: string; label: string }[] {
  const shops = boardLayout.filter((n) => n.type === "shop").map((n) => n.id);
  const spikes = boardLayout.filter((n) => n.type === "spike").map((n) => n.id);
  return [
    { id: "start", label: "START" },
    ...shops.slice(0, 2).map((id) => ({ id, label: "Shop" })),
    ...spikes.slice(0, 2).map((id) => ({ id, label: "Spike" })),
  ];
}
