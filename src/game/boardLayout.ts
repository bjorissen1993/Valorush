/**
 * Board graph — branching is via `next.length > 1` only (no split/merge tile types).
 * Coordinates are layout-space percentages (roughly 5–92).
 *
 * Mario Party–style asymmetric journey:
 * - START sits outside the main playfield on an NW approach spur
 * - Organic main circuit (kidney / SE lobe) — not concentric rings
 * - Irregular mid corridors + SE-offset inner plaza
 * - Shortcuts and intersections via `next[]` multiplicity
 * - Planar: no visual crossings of unconnected edges
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
 * ~58-tile asymmetric network:
 * Outside approach → Gate → North ridge → NE danger → SE lobe →
 * SW zigzag → West chaos → back to gate.
 * Inner plaza offset SE of center. START is spawn-only (no inbound).
 */
export const boardLayout: BoardNode[] = [
  // ── Outside approach (NW spur) — START clearly off the playfield ──
  { id: "start", type: "start", x: 5.5, y: 6, next: ["o1"] },
  { id: "o1", type: "normal", x: 10.5, y: 10, next: ["o2"] },
  { id: "o2", type: "normal", x: 16, y: 14.5, next: ["o3"] },
  { id: "o3", type: "lucky", x: 21.5, y: 19, next: ["o4"] },

  // ── Gate → northern ridge (irregular) ──────────────────────────
  { id: "o4", type: "spike", x: 28, y: 24.5, next: ["o5", "m1"] },
  { id: "o5", type: "normal", x: 33.5, y: 17, next: ["o6"] },
  { id: "o6", type: "shop", x: 42, y: 11, next: ["o7"] },
  { id: "o7", type: "normal", x: 52.5, y: 8.5, next: ["o8"] },
  { id: "o8", type: "event", x: 63, y: 10, next: ["o9"] },
  { id: "o9", type: "normal", x: 72, y: 13.5, next: ["o10"] },
  { id: "o10", type: "lucky", x: 79.5, y: 19.5, next: ["o11"] },

  // ── NE hook / Danger (east bulge) ──────────────────────────────
  { id: "o11", type: "event", x: 86, y: 27, next: ["o12"] },
  { id: "o12", type: "risk", x: 90.5, y: 37, next: ["o13"] },
  { id: "o13", type: "minigame", x: 91.5, y: 48.5, next: ["o14", "m5"] },
  { id: "o14", type: "normal", x: 88, y: 59, next: ["o15"] },
  { id: "o15", type: "spike", x: 83.5, y: 68, next: ["o16"] },
  { id: "o16", type: "risk", x: 79, y: 75, next: ["o17"] },

  // ── SE lobe (hangs lower / farther than SW) ────────────────────
  { id: "o17", type: "event", x: 84, y: 82.5, next: ["o18"] },
  { id: "o18", type: "normal", x: 75.5, y: 89, next: ["o19"] },
  { id: "o19", type: "normal", x: 65.5, y: 92, next: ["o20"] },
  { id: "o20", type: "shop", x: 55, y: 90.5, next: ["o21"] },
  { id: "o21", type: "lucky", x: 45.5, y: 87, next: ["o22"] },
  { id: "o22", type: "special", x: 37.5, y: 82.5, next: ["o23", "m8"] },

  // ── SW zigzag / Crossroads ─────────────────────────────────────
  { id: "o23", type: "normal", x: 30, y: 86.5, next: ["o24"] },
  { id: "o24", type: "event", x: 23, y: 81.5, next: ["o25"] },
  { id: "o25", type: "normal", x: 17.5, y: 74.5, next: ["o26"] },
  { id: "o26", type: "event", x: 13.5, y: 67, next: ["o27"] },
  { id: "o27", type: "shop", x: 10.5, y: 58.5, next: ["o28"] },

  // ── West chaos → close circuit at gate (START stays a spur) ────
  { id: "o28", type: "normal", x: 8.5, y: 49.5, next: ["o29"] },
  { id: "o29", type: "ult-orb", x: 8, y: 40.5, next: ["o30"] },
  { id: "o30", type: "risk", x: 9.5, y: 32, next: ["o31"] },
  { id: "o31", type: "minigame", x: 13, y: 25.5, next: ["o32", "m12"] },
  { id: "o32", type: "event", x: 17.5, y: 28.5, next: ["o33"] },
  { id: "o33", type: "ult-orb", x: 22, y: 31, next: ["o34"] },
  { id: "o34", type: "special", x: 25.5, y: 28, next: ["o35"] },
  { id: "o35", type: "normal", x: 26.5, y: 23.5, next: ["o4"] },

  // ── Mid corridors (irregular shortcuts — not a concentric ring) ─
  { id: "m1", type: "normal", x: 34, y: 31, next: ["m2"] },
  { id: "m2", type: "event", x: 44.5, y: 29, next: ["m3", "i1"] },
  { id: "m3", type: "normal", x: 55.5, y: 27, next: ["m4", "o8"] },
  { id: "m4", type: "shop", x: 66.5, y: 31, next: ["m5"] },
  { id: "m5", type: "lucky", x: 74.5, y: 43, next: ["m6", "i3"] },
  { id: "m6", type: "normal", x: 72.5, y: 54.5, next: ["m7"] },
  { id: "m7", type: "spike", x: 68, y: 64.5, next: ["m8", "o16"] },
  { id: "m8", type: "normal", x: 56, y: 70.5, next: ["m9"] },
  { id: "m9", type: "event", x: 44, y: 72.5, next: ["m10", "i5"] },
  { id: "m10", type: "normal", x: 33.5, y: 68.5, next: ["m11", "o25"] },
  { id: "m11", type: "minigame", x: 27.5, y: 58.5, next: ["m12"] },
  { id: "m12", type: "ult-orb", x: 25.5, y: 46.5, next: ["m13", "i7"] },
  { id: "m13", type: "normal", x: 27.5, y: 36.5, next: ["m14"] },
  { id: "m14", type: "normal", x: 30.5, y: 29, next: ["m1", "o35"] },

  // ── Inner plaza — offset SE of geometric center ────────────────
  { id: "i1", type: "normal", x: 48.5, y: 40.5, next: ["i2"] },
  { id: "i2", type: "event", x: 58.5, y: 38.5, next: ["i3", "m3"] },
  { id: "i3", type: "normal", x: 64.5, y: 46.5, next: ["i4"] },
  { id: "i4", type: "minigame", x: 62.5, y: 56.5, next: ["i5", "m6"] },
  { id: "i5", type: "normal", x: 52.5, y: 60.5, next: ["i6"] },
  { id: "i6", type: "normal", x: 44.5, y: 56.5, next: ["i7", "m10"] },
  { id: "i7", type: "normal", x: 40.5, y: 48.5, next: ["i8"] },
  { id: "i8", type: "normal", x: 42.5, y: 42.5, next: ["i1", "m13"] },
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
