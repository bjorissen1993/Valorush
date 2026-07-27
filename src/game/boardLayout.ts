/**
 * Board graph — rectangular outer loop + central hub cross (Paint sketch).
 * Branching is via multiple exits only (no split/merge tile types).
 * Coordinates are layout-space percentages (roughly 5–92).
 *
 * - START: NW spur into the top-left of the clockwise outer track
 * - Outer rectangle (rounded TL / BR): clockwise L→R → T→B → R→L → B→T
 * - Mid roads from each side midpoint into a central hub (one-way, toggled)
 * - Doors on the four hub approaches; open pair syncs with mid-road mode
 * - Portals at BL / TR corners; buttons in BL / TR inner quadrants
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
  | "special"
  | "portal"
  | "button";

/** Legacy tile types from older saves — remapped on load. */
export type LegacyTileType = TileType | "split" | "merge";

/** Mid-road travel axis relative to the hub. */
export type MidRoadAxis = "vertical" | "horizontal";

/**
 * Direction of a mid-road edge:
 * - `in`  = toward the hub (outer → center)
 * - `out` = toward the outer track (center → outer)
 */
export type MidRoadDir = "in" | "out";

/**
 * Global mid-road / door mode (button toggle).
 * Mode A (`vertical_in`): N/S inward, E/W outward — vertical doors open.
 * Mode B (`horizontal_in`): E/W inward, N/S outward — horizontal doors open.
 */
export type MidRoadMode = "vertical_in" | "horizontal_in";

export const DEFAULT_MID_ROAD_MODE: MidRoadMode = "vertical_in";

export type MidEdge = {
  to: string;
  axis: MidRoadAxis;
  dir: MidRoadDir;
};

export type BoardNode = {
  id: string;
  type: TileType;
  x: number;
  y: number;
  /** Always-on directed exits (outer loop, spurs, button returns). */
  next: string[];
  /** Mode-gated mid-road exits (one-way; filtered by MidRoadMode). */
  midEdges?: MidEdge[];
};

/** Credits to teleport between the two portal tiles — see economy.PORTAL_CREDIT_COST. */

export const PORTAL_PAIR: Readonly<Record<string, string>> = {
  "portal-tr": "portal-bl",
  "portal-bl": "portal-tr",
};

export const BUTTON_TILE_IDS = ["btn-tr", "btn-bl"] as const;
export const DOOR_TILE_IDS = ["dn", "de", "ds", "dw"] as const;

export function isMidEdgeActive(edge: MidEdge, mode: MidRoadMode): boolean {
  if (mode === "vertical_in") {
    return (
      (edge.axis === "vertical" && edge.dir === "in") ||
      (edge.axis === "horizontal" && edge.dir === "out")
    );
  }
  return (
    (edge.axis === "horizontal" && edge.dir === "in") ||
    (edge.axis === "vertical" && edge.dir === "out")
  );
}

export function toggleMidRoadMode(mode: MidRoadMode): MidRoadMode {
  return mode === "vertical_in" ? "horizontal_in" : "vertical_in";
}

/** Vertical doors open in Mode A (vertical inward); horizontal in Mode B. */
export function areVerticalDoorsOpen(mode: MidRoadMode): boolean {
  return mode === "vertical_in";
}

export function areHorizontalDoorsOpen(mode: MidRoadMode): boolean {
  return mode === "horizontal_in";
}

export function getDoorAxis(nodeId: string): MidRoadAxis | null {
  if (nodeId === "dn" || nodeId === "ds") return "vertical";
  if (nodeId === "de" || nodeId === "dw") return "horizontal";
  return null;
}

export function isDoorOpen(nodeId: string, mode: MidRoadMode): boolean {
  const axis = getDoorAxis(nodeId);
  if (!axis) return false;
  return axis === "vertical"
    ? areVerticalDoorsOpen(mode)
    : areHorizontalDoorsOpen(mode);
}

/**
 * Effective directed exits for movement / pathfinding under the current mode.
 */
export function getNodeExits(
  nodeId: string,
  mode: MidRoadMode = DEFAULT_MID_ROAD_MODE
): string[] {
  const node = getNodeById(nodeId);
  if (!node) return [];
  const exits = [...node.next];
  for (const edge of node.midEdges ?? []) {
    if (isMidEdgeActive(edge, mode)) {
      exits.push(edge.to);
    }
  }
  return exits;
}

/** All physical undirected connections (for drawing / ultimates / planarity). */
export function listPhysicalEdges(
  nodes: BoardNode[] = boardLayout
): { from: string; to: string }[] {
  const seen = new Set<string>();
  const edges: { from: string; to: string }[] = [];
  const add = (a: string, b: string) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from: a, to: b });
  };
  for (const node of nodes) {
    for (const nextId of node.next) add(node.id, nextId);
    for (const edge of node.midEdges ?? []) add(node.id, edge.to);
  }
  return edges;
}

/** Active directed mid-road edges for arrow rendering. */
export function listActiveMidEdges(
  mode: MidRoadMode,
  nodes: BoardNode[] = boardLayout
): { from: string; to: string; axis: MidRoadAxis; dir: MidRoadDir }[] {
  const result: {
    from: string;
    to: string;
    axis: MidRoadAxis;
    dir: MidRoadDir;
  }[] = [];
  for (const node of nodes) {
    for (const edge of node.midEdges ?? []) {
      if (isMidEdgeActive(edge, mode)) {
        result.push({
          from: node.id,
          to: edge.to,
          axis: edge.axis,
          dir: edge.dir,
        });
      }
    }
  }
  return result;
}

/**
 * ~56-tile rectangular-cross network matching the Paint sketch.
 * Outer clockwise loop + START spur + 4 mid roads + hub + 2 portals + 2 buttons.
 */
export const boardLayout: BoardNode[] = [
  // ── START spur (NW, slightly outside) ──────────────────────────
  { id: "start", type: "start", x: 5, y: 5, next: ["s1"] },
  { id: "s1", type: "normal", x: 11, y: 10, next: ["ot1"] },

  // ── Outer TOP (L→R), rounded TL ────────────────────────────────
  { id: "ot1", type: "normal", x: 18, y: 14, next: ["ot2"] },
  { id: "ot2", type: "lucky", x: 26, y: 12, next: ["ot3"] },
  { id: "ot3", type: "normal", x: 34, y: 12, next: ["ot4"] },
  { id: "ot4", type: "event", x: 42, y: 12, next: ["ot5"] },
  {
    id: "ot5",
    type: "normal",
    x: 50,
    y: 12,
    next: ["ot6"],
    midEdges: [{ to: "mn1", axis: "vertical", dir: "in" }],
  },
  { id: "ot6", type: "shop", x: 58, y: 12, next: ["ot7"] },
  { id: "ot7", type: "normal", x: 66, y: 12, next: ["ot8", "btn-tr"] },
  { id: "ot8", type: "event", x: 74, y: 14, next: ["portal-tr"] },
  { id: "portal-tr", type: "portal", x: 84, y: 18, next: ["or1"] },

  // ── Outer RIGHT (T→B) ──────────────────────────────────────────
  { id: "or1", type: "normal", x: 88, y: 26, next: ["or2"] },
  { id: "or2", type: "risk", x: 90, y: 34, next: ["or3"] },
  { id: "or3", type: "ult-orb", x: 90, y: 42, next: ["or4"] },
  {
    id: "or4",
    type: "minigame",
    x: 90,
    y: 50,
    next: ["or5"],
    midEdges: [{ to: "me1", axis: "horizontal", dir: "in" }],
  },
  { id: "or5", type: "normal", x: 90, y: 58, next: ["or6"] },
  { id: "or6", type: "spike", x: 88, y: 66, next: ["or7"] },
  { id: "or7", type: "event", x: 86, y: 74, next: ["ob1"] },

  // ── Outer BOTTOM (R→L), rounded BR ─────────────────────────────
  { id: "ob1", type: "normal", x: 78, y: 86, next: ["ob2"] },
  { id: "ob2", type: "lucky", x: 70, y: 90, next: ["ob3"] },
  { id: "ob3", type: "shop", x: 62, y: 90, next: ["ob4"] },
  { id: "ob4", type: "normal", x: 56, y: 90, next: ["ob5"] },
  {
    id: "ob5",
    type: "event",
    x: 50,
    y: 90,
    next: ["ob6"],
    midEdges: [{ to: "ms1", axis: "vertical", dir: "in" }],
  },
  { id: "ob6", type: "normal", x: 42, y: 90, next: ["ob7"] },
  { id: "ob7", type: "risk", x: 34, y: 88, next: ["ob8", "btn-bl"] },
  { id: "ob8", type: "normal", x: 26, y: 86, next: ["portal-bl"] },
  { id: "portal-bl", type: "portal", x: 16, y: 82, next: ["ol1"] },

  // ── Outer LEFT (B→T) → close at ot1 (START stays a spur) ───────
  { id: "ol1", type: "ult-orb", x: 12, y: 74, next: ["ol2"] },
  { id: "ol2", type: "normal", x: 10, y: 66, next: ["ol3"] },
  { id: "ol3", type: "event", x: 10, y: 58, next: ["ol4"] },
  {
    id: "ol4",
    type: "minigame",
    x: 10,
    y: 50,
    next: ["ol5"],
    midEdges: [{ to: "mw1", axis: "horizontal", dir: "in" }],
  },
  { id: "ol5", type: "normal", x: 10, y: 42, next: ["ol6"] },
  { id: "ol6", type: "shop", x: 12, y: 34, next: ["ol7"] },
  { id: "ol7", type: "spike", x: 14, y: 26, next: ["ol8"] },
  { id: "ol8", type: "special", x: 16, y: 18, next: ["ot1"] },

  // ── Buttons (inner quadrant spurs; always reachable) ───────────
  { id: "btn-tr", type: "button", x: 68, y: 28, next: ["ot8"] },
  { id: "btn-bl", type: "button", x: 32, y: 72, next: ["ob8"] },

  // ── North mid road (outer → hub = in) ──────────────────────────
  {
    id: "mn1",
    type: "normal",
    x: 50,
    y: 22,
    next: [],
    midEdges: [
      { to: "ot5", axis: "vertical", dir: "out" },
      { to: "mn2", axis: "vertical", dir: "in" },
    ],
  },
  {
    id: "mn2",
    type: "event",
    x: 50,
    y: 30,
    next: [],
    midEdges: [
      { to: "mn1", axis: "vertical", dir: "out" },
      { to: "dn", axis: "vertical", dir: "in" },
    ],
  },
  {
    id: "dn",
    type: "normal",
    x: 50,
    y: 38,
    next: [],
    midEdges: [
      { to: "mn2", axis: "vertical", dir: "out" },
      { to: "hub", axis: "vertical", dir: "in" },
    ],
  },

  // ── East mid road ──────────────────────────────────────────────
  {
    id: "me1",
    type: "normal",
    x: 78,
    y: 50,
    next: [],
    midEdges: [
      { to: "or4", axis: "horizontal", dir: "out" },
      { to: "me2", axis: "horizontal", dir: "in" },
    ],
  },
  {
    id: "me2",
    type: "lucky",
    x: 70,
    y: 50,
    next: [],
    midEdges: [
      { to: "me1", axis: "horizontal", dir: "out" },
      { to: "de", axis: "horizontal", dir: "in" },
    ],
  },
  {
    id: "de",
    type: "normal",
    x: 62,
    y: 50,
    next: [],
    midEdges: [
      { to: "me2", axis: "horizontal", dir: "out" },
      { to: "hub", axis: "horizontal", dir: "in" },
    ],
  },

  // ── South mid road ─────────────────────────────────────────────
  {
    id: "ms1",
    type: "normal",
    x: 50,
    y: 78,
    next: [],
    midEdges: [
      { to: "ob5", axis: "vertical", dir: "out" },
      { to: "ms2", axis: "vertical", dir: "in" },
    ],
  },
  {
    id: "ms2",
    type: "risk",
    x: 50,
    y: 70,
    next: [],
    midEdges: [
      { to: "ms1", axis: "vertical", dir: "out" },
      { to: "ds", axis: "vertical", dir: "in" },
    ],
  },
  {
    id: "ds",
    type: "normal",
    x: 50,
    y: 62,
    next: [],
    midEdges: [
      { to: "ms2", axis: "vertical", dir: "out" },
      { to: "hub", axis: "vertical", dir: "in" },
    ],
  },

  // ── West mid road ──────────────────────────────────────────────
  {
    id: "mw1",
    type: "ult-orb",
    x: 22,
    y: 50,
    next: [],
    midEdges: [
      { to: "ol4", axis: "horizontal", dir: "out" },
      { to: "mw2", axis: "horizontal", dir: "in" },
    ],
  },
  {
    id: "mw2",
    type: "normal",
    x: 30,
    y: 50,
    next: [],
    midEdges: [
      { to: "mw1", axis: "horizontal", dir: "out" },
      { to: "dw", axis: "horizontal", dir: "in" },
    ],
  },
  {
    id: "dw",
    type: "normal",
    x: 38,
    y: 50,
    next: [],
    midEdges: [
      { to: "mw2", axis: "horizontal", dir: "out" },
      { to: "hub", axis: "horizontal", dir: "in" },
    ],
  },

  // ── Central hub ────────────────────────────────────────────────
  {
    id: "hub",
    type: "special",
    x: 50,
    y: 50,
    next: [],
    midEdges: [
      { to: "dn", axis: "vertical", dir: "out" },
      { to: "ds", axis: "vertical", dir: "out" },
      { to: "de", axis: "horizontal", dir: "out" },
      { to: "dw", axis: "horizontal", dir: "out" },
    ],
  },
];

const LEGACY_POSITION_REMAP: Record<string, string> = {
  "top-1": "ot1",
  "top-2": "ot5",
  "top-split": "ot5",
  "top-outer-1": "ot6",
  "top-inner-1": "mn1",
  "top-inner-2": "mn2",
  "right-1": "or1",
  "right-2": "or4",
  "right-merge": "or4",
  "right-3": "or6",
  "bottom-1": "ob1",
  "bottom-2": "ob3",
  "bottom-3": "ob5",
  "bottom-split": "ob5",
  "bottom-outer-1": "ob3",
  "bottom-inner-1": "ms1",
  "bottom-inner-2": "ms2",
  "left-3": "ol1",
  "left-2": "ol4",
  "left-merge": "ol4",
  "left-1": "ol8",
  "m-top-1": "mn1",
  "m-top-2": "mn2",
  "m-top-3": "dn",
  "m-right-1": "me1",
  "m-right-2": "me2",
  "m-right-3": "de",
  "m-bot-1": "ms1",
  "m-bot-2": "ms2",
  "m-bot-3": "ds",
  "m-left-1": "mw1",
  "m-left-2": "mw2",
  "m-left-3": "dw",
  "inner-n": "dn",
  "inner-ne": "de",
  "inner-e": "de",
  "inner-se": "ds",
  "inner-s": "ds",
  "inner-sw": "dw",
  "inner-w": "dw",
  "inner-nw": "dn",
  "inner-hub": "hub",
  "inner-exit-ne": "de",
  "inner-exit-sw": "dw",
  // Prior asymmetric outer / mid ids
  o1: "s1",
  o2: "ot1",
  o3: "ot2",
  o4: "ot5",
  o5: "ot3",
  o6: "ot6",
  o7: "ot7",
  o8: "ot8",
  o9: "or1",
  o10: "or2",
  o11: "or3",
  o12: "or4",
  o13: "or4",
  o14: "or5",
  o15: "or6",
  o16: "or7",
  o17: "ob1",
  o18: "ob2",
  o19: "ob3",
  o20: "ob3",
  o21: "ob4",
  o22: "ob5",
  o23: "ob6",
  o24: "ob7",
  o25: "ob8",
  o26: "portal-bl",
  o27: "ol1",
  o28: "ol2",
  o29: "ol3",
  o30: "ol4",
  o31: "ol4",
  o32: "ol5",
  o33: "ol6",
  o34: "ol7",
  o35: "ol8",
  m1: "mn1",
  m2: "mn2",
  m3: "dn",
  m4: "me1",
  m5: "me2",
  m6: "de",
  m7: "ms1",
  m8: "ms1",
  m9: "ms2",
  m10: "ds",
  m11: "mw1",
  m12: "mw2",
  m13: "dw",
  m14: "mn1",
  i1: "dn",
  i2: "hub",
  i3: "de",
  i4: "ds",
  i5: "ds",
  i6: "dw",
  i7: "dw",
  i8: "dn",
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
  "portal",
  "button",
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
  preferredPath?: string[],
  mode: MidRoadMode = DEFAULT_MID_ROAD_MODE
): string {
  let currentId = migrateBoardPosition(startNodeId);

  for (let i = 0; i < steps; i++) {
    const exits = getNodeExits(currentId, mode);
    if (exits.length === 0) break;

    if (exits.length === 1) {
      currentId = exits[0]!;
      continue;
    }

    const preferredNext = preferredPath?.find((id) => exits.includes(id));
    currentId = preferredNext ?? exits[0]!;
  }

  return currentId;
}

export function listBoardBranchPoints(
  mode: MidRoadMode = DEFAULT_MID_ROAD_MODE
): BoardNode[] {
  return boardLayout.filter((node) => getNodeExits(node.id, mode).length > 1);
}

/** Landmark ids used by the match-start camera overview. */
export function listBoardLandmarks(): { id: string; label: string }[] {
  const shops = boardLayout.filter((n) => n.type === "shop").map((n) => n.id);
  const spikes = boardLayout.filter((n) => n.type === "spike").map((n) => n.id);
  const portals = boardLayout
    .filter((n) => n.type === "portal")
    .map((n) => n.id);
  return [
    { id: "start", label: "START" },
    { id: "hub", label: "Hub" },
    ...portals.slice(0, 2).map((id) => ({ id, label: "Portal" })),
    ...shops.slice(0, 2).map((id) => ({ id, label: "Shop" })),
    ...spikes.slice(0, 1).map((id) => ({ id, label: "Spike" })),
  ];
}
