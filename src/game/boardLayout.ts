/**
 * Board graph — branching is via `next.length > 1` only (no split/merge tile types).
 * Coordinates are layout-space percentages (roughly 8–92).
 *
 * Layout approach (Mario Party–style journey):
 * - Outer racetrack (~31) meanders as a rounded oval with gentle bulges
 * - Mid loop (~12) sits as an offset elliptical shortcut ring
 * - Inner loop (~8) is a compact central plaza circuit
 * - Route choices only at cardinal connectors via `next[]`
 * - Graph stays planar: edges follow ring perimeters or short radials
 *   so unconnected roads never cross visually
 */

export type TileType =
  | "start"
  | "empty"
  | "normal"
  | "spike"
  | "shop"
  | "event"
  | "minigame";

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
 * ~51-tile planar network with winding organic placement:
 * - Clear START plaza at the NW approach (players always begin here)
 * - Multiple loops + branch choices at outer/mid/inner connectors
 */
export const boardLayout: BoardNode[] = [
  // ── Outer approach & top meander (L→R) ───────────────────────
  // START sits slightly off the track as a bright plaza entry.
  { id: "start", type: "start", x: 12, y: 18, next: ["o1"] },
  { id: "o1", type: "normal", x: 20, y: 12, next: ["o2"] },
  { id: "o2", type: "event", x: 29, y: 9, next: ["o3"] },
  { id: "o3", type: "normal", x: 39, y: 11, next: ["o4"] },
  // Branch: stay on outer OR drop into mid-top
  { id: "o4", type: "spike", x: 50, y: 8, next: ["o5", "m-top-2"] },
  { id: "o5", type: "normal", x: 61, y: 11, next: ["o6"] },
  { id: "o6", type: "shop", x: 71, y: 9, next: ["o7"] },
  { id: "o7", type: "normal", x: 80, y: 13, next: ["o8"] },
  { id: "o8", type: "event", x: 88, y: 18, next: ["o9"] },

  // ── Outer right meander (T→B) ────────────────────────────────
  { id: "o9", type: "normal", x: 92, y: 26, next: ["o10"] },
  { id: "o10", type: "minigame", x: 90, y: 35, next: ["o11"] },
  { id: "o11", type: "normal", x: 93, y: 43, next: ["o12"] },
  // Branch: stay on outer OR enter mid-right
  { id: "o12", type: "event", x: 91, y: 50, next: ["o13", "m-right-2"] },
  { id: "o13", type: "normal", x: 93, y: 58, next: ["o14"] },
  { id: "o14", type: "shop", x: 90, y: 67, next: ["o15"] },
  { id: "o15", type: "normal", x: 88, y: 76, next: ["o16"] },

  // ── Outer bottom meander (R→L) ───────────────────────────────
  { id: "o16", type: "spike", x: 82, y: 85, next: ["o17"] },
  { id: "o17", type: "normal", x: 72, y: 90, next: ["o18"] },
  { id: "o18", type: "event", x: 61, y: 88, next: ["o19"] },
  // Branch: stay on outer OR enter mid-bottom
  { id: "o19", type: "normal", x: 50, y: 92, next: ["o20", "m-bot-2"] },
  { id: "o20", type: "minigame", x: 39, y: 88, next: ["o21"] },
  { id: "o21", type: "normal", x: 28, y: 90, next: ["o22"] },
  { id: "o22", type: "shop", x: 18, y: 85, next: ["o23"] },
  { id: "o23", type: "normal", x: 11, y: 78, next: ["o24"] },

  // ── Outer left meander (B→T) ─────────────────────────────────
  { id: "o24", type: "event", x: 8, y: 69, next: ["o25"] },
  { id: "o25", type: "normal", x: 11, y: 60, next: ["o26"] },
  { id: "o26", type: "spike", x: 8, y: 54, next: ["o27"] },
  // Branch: stay on outer OR enter mid-left
  { id: "o27", type: "normal", x: 9, y: 50, next: ["o28", "m-left-2"] },
  { id: "o28", type: "minigame", x: 8, y: 42, next: ["o29"] },
  { id: "o29", type: "normal", x: 11, y: 33, next: ["o30"] },
  { id: "o30", type: "event", x: 10, y: 24, next: ["start"] },

  // ── Mid ring (offset ellipse, CW from NW) ────────────────────
  { id: "m-top-1", type: "normal", x: 36, y: 29, next: ["m-top-2"] },
  // Branch: continue mid OR drop into inner plaza
  { id: "m-top-2", type: "event", x: 50, y: 26, next: ["m-top-3", "inner-n"] },
  // Exit option back to outer NE
  { id: "m-top-3", type: "normal", x: 64, y: 29, next: ["m-right-1", "o8"] },

  { id: "m-right-1", type: "normal", x: 71, y: 36, next: ["m-right-2"] },
  { id: "m-right-2", type: "shop", x: 74, y: 50, next: ["m-right-3", "inner-e"] },
  { id: "m-right-3", type: "normal", x: 71, y: 64, next: ["m-bot-1", "o15"] },

  { id: "m-bot-1", type: "normal", x: 64, y: 71, next: ["m-bot-2"] },
  { id: "m-bot-2", type: "event", x: 50, y: 74, next: ["m-bot-3", "inner-s"] },
  { id: "m-bot-3", type: "spike", x: 36, y: 71, next: ["m-left-1", "o23"] },

  { id: "m-left-1", type: "normal", x: 29, y: 64, next: ["m-left-2"] },
  { id: "m-left-2", type: "minigame", x: 26, y: 50, next: ["m-left-3", "inner-w"] },
  { id: "m-left-3", type: "normal", x: 29, y: 36, next: ["m-top-1", "o30"] },

  // ── Inner plaza loop (compact oval, CW from north) ───────────
  { id: "inner-n", type: "normal", x: 44, y: 40, next: ["inner-ne"] },
  // Exit back to mid-top
  { id: "inner-ne", type: "event", x: 50, y: 38, next: ["inner-e", "m-top-3"] },
  { id: "inner-e", type: "normal", x: 56, y: 40, next: ["inner-se"] },
  { id: "inner-se", type: "shop", x: 58, y: 48, next: ["inner-s", "m-right-3"] },
  { id: "inner-s", type: "normal", x: 56, y: 56, next: ["inner-sw"] },
  { id: "inner-sw", type: "event", x: 50, y: 58, next: ["inner-w", "m-bot-3"] },
  { id: "inner-w", type: "normal", x: 44, y: 56, next: ["inner-nw"] },
  { id: "inner-nw", type: "minigame", x: 42, y: 48, next: ["inner-n", "m-left-3"] },
];

const LEGACY_POSITION_REMAP: Record<string, string> = {
  "top-1": "o1",
  "top-2": "o4",
  "top-split": "o4",
  "top-outer-1": "o7",
  "top-inner-1": "m-top-1",
  "top-inner-2": "m-top-3",
  "right-1": "o9",
  "right-2": "o12",
  "right-merge": "o12",
  "right-3": "o14",
  "bottom-1": "o16",
  "bottom-2": "o18",
  "bottom-3": "o19",
  "bottom-split": "o19",
  "bottom-outer-1": "o22",
  "bottom-inner-1": "m-bot-1",
  "bottom-inner-2": "m-bot-3",
  "left-3": "o24",
  "left-2": "o26",
  "left-merge": "o27",
  "left-1": "o29",
  // Previous expansion hub ids
  "inner-hub": "inner-ne",
  "inner-exit-ne": "inner-se",
  "inner-exit-sw": "inner-sw",
};

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
  if (
    type === "start" ||
    type === "empty" ||
    type === "normal" ||
    type === "spike" ||
    type === "shop" ||
    type === "event" ||
    type === "minigame"
  ) {
    return type;
  }
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
