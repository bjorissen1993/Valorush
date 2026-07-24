/**
 * Board graph — branching is via `next.length > 1` only (no split/merge tile types).
 * Coordinates are layout-space percentages (roughly 8–92).
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
 * ~50-tile network with outer loop, mid shortcuts, and inner cross.
 * Every node has ≥1 exit; graph is strongly connected from start.
 */
export const boardLayout: BoardNode[] = [
  // ── Outer top (L→R) ──────────────────────────────────────────
  { id: "start", type: "start", x: 10, y: 10, next: ["o1"] },
  { id: "o1", type: "normal", x: 20, y: 10, next: ["o2"] },
  { id: "o2", type: "event", x: 30, y: 10, next: ["o3"] },
  { id: "o3", type: "normal", x: 40, y: 10, next: ["o4"] },
  { id: "o4", type: "spike", x: 50, y: 10, next: ["o5", "m-top-1"] },
  { id: "o5", type: "normal", x: 60, y: 10, next: ["o6"] },
  { id: "o6", type: "shop", x: 70, y: 10, next: ["o7"] },
  { id: "o7", type: "normal", x: 80, y: 10, next: ["o8"] },
  { id: "o8", type: "event", x: 90, y: 10, next: ["o9"] },

  // ── Outer right (T→B) ────────────────────────────────────────
  { id: "o9", type: "normal", x: 90, y: 20, next: ["o10"] },
  { id: "o10", type: "minigame", x: 90, y: 30, next: ["o11", "m-right-1"] },
  { id: "o11", type: "normal", x: 90, y: 40, next: ["o12"] },
  { id: "o12", type: "event", x: 90, y: 50, next: ["o13"] },
  { id: "o13", type: "normal", x: 90, y: 60, next: ["o14"] },
  { id: "o14", type: "shop", x: 90, y: 70, next: ["o15"] },
  { id: "o15", type: "normal", x: 90, y: 80, next: ["o16"] },

  // ── Outer bottom (R→L) ───────────────────────────────────────
  { id: "o16", type: "spike", x: 80, y: 90, next: ["o17", "m-bot-1"] },
  { id: "o17", type: "normal", x: 70, y: 90, next: ["o18"] },
  { id: "o18", type: "event", x: 60, y: 90, next: ["o19"] },
  { id: "o19", type: "normal", x: 50, y: 90, next: ["o20"] },
  { id: "o20", type: "minigame", x: 40, y: 90, next: ["o21"] },
  { id: "o21", type: "normal", x: 30, y: 90, next: ["o22"] },
  { id: "o22", type: "shop", x: 20, y: 90, next: ["o23"] },
  { id: "o23", type: "normal", x: 10, y: 90, next: ["o24"] },

  // ── Outer left (B→T) ─────────────────────────────────────────
  { id: "o24", type: "event", x: 10, y: 80, next: ["o25"] },
  { id: "o25", type: "normal", x: 10, y: 70, next: ["o26", "m-left-1"] },
  { id: "o26", type: "spike", x: 10, y: 60, next: ["o27"] },
  { id: "o27", type: "normal", x: 10, y: 50, next: ["o28"] },
  { id: "o28", type: "minigame", x: 10, y: 40, next: ["o29"] },
  { id: "o29", type: "normal", x: 10, y: 30, next: ["o30"] },
  { id: "o30", type: "event", x: 10, y: 20, next: ["start"] },

  // ── Mid top shortcut (from o4 → joins o12) ────────────────────
  { id: "m-top-1", type: "normal", x: 50, y: 22, next: ["m-top-2"] },
  { id: "m-top-2", type: "event", x: 58, y: 30, next: ["m-top-3", "inner-n"] },
  { id: "m-top-3", type: "normal", x: 70, y: 38, next: ["o12"] },

  // ── Mid right shortcut (from o10 → joins o16) ─────────────────
  { id: "m-right-1", type: "normal", x: 78, y: 38, next: ["m-right-2"] },
  { id: "m-right-2", type: "shop", x: 72, y: 50, next: ["m-right-3", "inner-e"] },
  { id: "m-right-3", type: "normal", x: 78, y: 62, next: ["o16"] },

  // ── Mid bottom shortcut (from o16 → joins o25) ────────────────
  { id: "m-bot-1", type: "normal", x: 70, y: 78, next: ["m-bot-2"] },
  { id: "m-bot-2", type: "event", x: 55, y: 72, next: ["m-bot-3", "inner-s"] },
  { id: "m-bot-3", type: "spike", x: 35, y: 72, next: ["o25"] },

  // ── Mid left shortcut (from o25 → joins o4 via inner) ─────────
  { id: "m-left-1", type: "normal", x: 22, y: 58, next: ["m-left-2"] },
  { id: "m-left-2", type: "minigame", x: 28, y: 48, next: ["m-left-3", "inner-w"] },
  { id: "m-left-3", type: "normal", x: 28, y: 30, next: ["o4"] },

  // ── Inner hub (cross — loops via mids) ────────────────────────
  { id: "inner-n", type: "normal", x: 50, y: 40, next: ["inner-hub"] },
  { id: "inner-e", type: "event", x: 62, y: 50, next: ["inner-hub"] },
  { id: "inner-s", type: "normal", x: 50, y: 60, next: ["inner-hub"] },
  { id: "inner-w", type: "shop", x: 38, y: 50, next: ["inner-hub"] },
  { id: "inner-hub", type: "event", x: 50, y: 50, next: ["inner-exit-ne", "inner-exit-sw"] },
  { id: "inner-exit-ne", type: "normal", x: 62, y: 38, next: ["o10"] },
  { id: "inner-exit-sw", type: "normal", x: 38, y: 62, next: ["o22"] },
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
  "bottom-split": "o16",
  "bottom-outer-1": "o22",
  "bottom-inner-1": "m-bot-1",
  "bottom-inner-2": "m-bot-3",
  "left-3": "o24",
  "left-2": "o26",
  "left-merge": "o27",
  "left-1": "o29",
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
