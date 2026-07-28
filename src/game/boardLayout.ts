/**
 * ValoRush Kingdom board — Mario Party–style organic loops with per-gate splits.
 *
 * - Large outer loop + smaller inner loop around the Kingdom Facility
 * - ~5 gates on split shortcuts (left OR right branch open; never blocks the map)
 * - Gate Buttons flip a single gate; portals at TR / BL on the outer loop
 * - Coordinates are layout-space percentages (roughly 6–94)
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

export type GateId = "g1" | "g2" | "g3" | "g4" | "g5";
export type GateBranch = "left" | "right";
export type GateStates = Record<GateId, GateBranch>;

export const GATE_IDS: readonly GateId[] = [
  "g1",
  "g2",
  "g3",
  "g4",
  "g5",
] as const;

export const DEFAULT_GATE_STATES: GateStates = {
  g1: "left",
  g2: "right",
  g3: "left",
  g4: "right",
  g5: "left",
};

/** @deprecated Prefer GateStates — kept for old online snapshots. */
export type MidRoadMode = "vertical_in" | "horizontal_in";
export const DEFAULT_MID_ROAD_MODE: MidRoadMode = "vertical_in";

export type GateEdge = {
  to: string;
  gateId: GateId;
  branch: GateBranch;
};

export type BoardNode = {
  id: string;
  type: TileType;
  x: number;
  y: number;
  /** Always-on directed exits (loops, spurs, kingdom spokes). */
  next: string[];
  /** Gate-filtered exits — active only when that gate's branch matches. */
  gateEdges?: GateEdge[];
  /** Button tiles: which gate this switch controls. */
  controlsGate?: GateId;
};

/** Credits to teleport between the two portal tiles — see economy.PORTAL_CREDIT_COST. */

export const PORTAL_PAIR: Readonly<Record<string, string>> = {
  "portal-tr": "portal-bl",
  "portal-bl": "portal-tr",
};

export const BUTTON_TILE_IDS = [
  "btn-g1",
  "btn-g2",
  "btn-g3",
  "btn-g4",
  "btn-g5",
] as const;

export const GATE_LABELS: Readonly<Record<GateId, string>> = {
  g1: "North Gate",
  g2: "East Gate",
  g3: "South Gate",
  g4: "West Gate",
  g5: "Canyon Gate",
};

export function createDefaultGateStates(): GateStates {
  return { ...DEFAULT_GATE_STATES };
}

export function migrateGateStates(
  raw?: Partial<GateStates> | null,
  legacyMode?: MidRoadMode | null
): GateStates {
  const base = createDefaultGateStates();
  if (raw && typeof raw === "object") {
    for (const id of GATE_IDS) {
      const value = raw[id];
      if (value === "left" || value === "right") base[id] = value;
    }
    return base;
  }
  // Old A/B mid-road mode → staggered defaults (still fully traversable).
  if (legacyMode === "horizontal_in") {
    return { g1: "right", g2: "left", g3: "right", g4: "left", g5: "right" };
  }
  return base;
}

export function isGateEdgeActive(
  edge: GateEdge,
  states: GateStates
): boolean {
  return states[edge.gateId] === edge.branch;
}

export function toggleGate(
  states: GateStates,
  gateId: GateId
): GateStates {
  return {
    ...states,
    [gateId]: states[gateId] === "left" ? "right" : "left",
  };
}

/** @deprecated Use toggleGate. */
export function toggleMidRoadMode(mode: MidRoadMode): MidRoadMode {
  return mode === "vertical_in" ? "horizontal_in" : "vertical_in";
}

export function getGateControlledByButton(
  nodeId: string
): GateId | null {
  return getNodeById(nodeId)?.controlsGate ?? null;
}

export function isBranchOpen(
  gateId: GateId,
  branch: GateBranch,
  states: GateStates
): boolean {
  return states[gateId] === branch;
}

/**
 * Effective directed exits for movement / pathfinding under current gate states.
 */
export function getNodeExits(
  nodeId: string,
  modeOrStates: GateStates | MidRoadMode = DEFAULT_GATE_STATES
): string[] {
  const states =
    typeof modeOrStates === "string"
      ? migrateGateStates(null, modeOrStates)
      : modeOrStates;
  const node = getNodeById(nodeId);
  if (!node) return [];
  const exits = [...node.next];
  for (const edge of node.gateEdges ?? []) {
    if (isGateEdgeActive(edge, states)) {
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
    for (const edge of node.gateEdges ?? []) add(node.id, edge.to);
  }
  return edges;
}

/** Active gated edges for open-branch highlighting. */
export function listActiveGateEdges(
  states: GateStates,
  nodes: BoardNode[] = boardLayout
): { from: string; to: string; gateId: GateId; branch: GateBranch }[] {
  const result: {
    from: string;
    to: string;
    gateId: GateId;
    branch: GateBranch;
  }[] = [];
  for (const node of nodes) {
    for (const edge of node.gateEdges ?? []) {
      if (isGateEdgeActive(edge, states)) {
        result.push({
          from: node.id,
          to: edge.to,
          gateId: edge.gateId,
          branch: edge.branch,
        });
      }
    }
  }
  return result;
}

/** Closed gated edges — draw barrier / dimmed road. */
export function listClosedGateEdges(
  states: GateStates,
  nodes: BoardNode[] = boardLayout
): { from: string; to: string; gateId: GateId; branch: GateBranch }[] {
  const result: {
    from: string;
    to: string;
    gateId: GateId;
    branch: GateBranch;
  }[] = [];
  for (const node of nodes) {
    for (const edge of node.gateEdges ?? []) {
      if (!isGateEdgeActive(edge, states)) {
        result.push({
          from: node.id,
          to: edge.to,
          gateId: edge.gateId,
          branch: edge.branch,
        });
      }
    }
  }
  return result;
}

/** @deprecated Prefer listActiveGateEdges. */
export function listActiveMidEdges(
  modeOrStates: MidRoadMode | GateStates,
  nodes: BoardNode[] = boardLayout
) {
  const states =
    typeof modeOrStates === "string"
      ? migrateGateStates(null, modeOrStates)
      : modeOrStates;
  return listActiveGateEdges(states, nodes).map((e) => ({
    from: e.from,
    to: e.to,
    axis: "vertical" as const,
    dir: "in" as const,
  }));
}

/** @deprecated Doors replaced by per-gate branch barriers. */
export const DOOR_TILE_IDS: readonly string[] = [];

export function isDoorOpen(
  _nodeId: string,
  _mode: MidRoadMode | GateStates
): boolean {
  return false;
}

// ── Layout construction ─────────────────────────────────────────────

type MutableNode = BoardNode & { next: string[]; gateEdges: GateEdge[] };

function n(
  id: string,
  type: TileType,
  x: number,
  y: number,
  extra?: Partial<BoardNode>
): MutableNode {
  return {
    id,
    type,
    x,
    y,
    next: [],
    gateEdges: [],
    ...extra,
    // ensure arrays after spread
    ...(extra?.next ? { next: [...extra.next] } : {}),
    ...(extra?.gateEdges ? { gateEdges: [...extra.gateEdges] } : {}),
  };
}

function linkBoth(a: MutableNode, b: MutableNode) {
  if (!a.next.includes(b.id)) a.next.push(b.id);
  if (!b.next.includes(a.id)) b.next.push(a.id);
}

function gateBoth(
  a: MutableNode,
  b: MutableNode,
  gateId: GateId,
  branch: GateBranch
) {
  if (!a.gateEdges.some((e) => e.to === b.id && e.gateId === gateId)) {
    a.gateEdges.push({ to: b.id, gateId, branch });
  }
  if (!b.gateEdges.some((e) => e.to === a.id && e.gateId === gateId)) {
    b.gateEdges.push({ to: a.id, gateId, branch });
  }
}

function buildKingdomBoard(): BoardNode[] {
  const byId = new Map<string, MutableNode>();
  const add = (node: MutableNode) => {
    byId.set(node.id, node);
    return node;
  };

  // ── START spur (NW) ──────────────────────────────────────────────
  const start = add(n("start", "start", 7, 8));
  const s1 = add(n("s1", "normal", 13, 14));

  // ── Outer loop (clockwise order; linked bidirectionally) ─────────
  const outer = [
    add(n("o0", "normal", 20, 12)),
    add(n("o0b", "normal", 25, 10)),
    add(n("o1", "lucky", 30, 9)),
    add(n("o2", "normal", 40, 8)),
    add(n("o3", "event", 50, 9)), // G1 fork
    add(n("o4", "normal", 60, 8)),
    add(n("o4b", "normal", 65, 9)),
    add(n("o5", "shop", 70, 11)),
    add(n("o6", "normal", 78, 15)),
    add(n("portal-tr", "portal", 87, 20)),
    add(n("o7", "event", 91, 30)),
    add(n("o8", "normal", 93, 40)),
    add(n("o9", "minigame", 92, 50)), // G2 fork
    add(n("o10", "normal", 91, 60)),
    add(n("o10b", "normal", 89, 65)),
    add(n("o11", "spike", 87, 70)),
    add(n("o12", "risk", 80, 80)),
    add(n("o13", "shop", 70, 88)),
    add(n("o14", "normal", 58, 92)), // G3 fork
    add(n("o15", "event", 46, 92)),
    add(n("o16", "normal", 34, 89)), // G5 fork
    add(n("o17", "lucky", 24, 84)),
    add(n("o17b", "normal", 19, 80)),
    add(n("portal-bl", "portal", 14, 76)),
    add(n("o18", "ult-orb", 9, 66)),
    add(n("o19", "normal", 8, 54)), // G4 fork
    add(n("o20", "event", 9, 42)),
    add(n("o21", "shop", 12, 32)),
    add(n("o21b", "normal", 14, 27)),
    add(n("o22", "spike", 16, 22)),
    add(n("o22b", "normal", 17, 18)),
    add(n("o23", "special", 18, 16)),
  ];

  for (let i = 0; i < outer.length; i += 1) {
    linkBoth(outer[i]!, outer[(i + 1) % outer.length]!);
  }
  linkBoth(start, s1);
  linkBoth(s1, outer[0]!);

  // ── Inner loop around Kingdom Facility ───────────────────────────
  const inner = [
    add(n("i0", "normal", 50, 33)),
    add(n("i1", "lucky", 61, 37)),
    add(n("i2", "event", 67, 48)),
    add(n("i3", "normal", 61, 59)),
    add(n("i4", "minigame", 50, 64)),
    add(n("i5", "risk", 39, 59)),
    add(n("i6", "ult-orb", 33, 48)),
    add(n("i7", "normal", 39, 37)),
  ];
  for (let i = 0; i < inner.length; i += 1) {
    linkBoth(inner[i]!, inner[(i + 1) % inner.length]!);
  }

  const kingdom = add(n("kingdom", "special", 50, 48));
  linkBoth(kingdom, inner[0]!); // N
  linkBoth(kingdom, inner[2]!); // E
  linkBoth(kingdom, inner[4]!); // S
  linkBoth(kingdom, inner[6]!); // W

  // ── Gate branch tiles ────────────────────────────────────────────
  // Fork↔branch is gated; branch↔inner is always on so closed lanes stay
  // reachable from the inner ring (no dead ends / orphans).
  const o3 = byId.get("o3")!;
  const o4 = byId.get("o4")!;
  const o5 = byId.get("o5")!;
  const o9 = byId.get("o9")!;
  const o10 = byId.get("o10")!;
  const o14 = byId.get("o14")!;
  const o15 = byId.get("o15")!;
  const o16 = byId.get("o16")!;
  const o19 = byId.get("o19")!;
  const o20 = byId.get("o20")!;

  // G1 North: o3 → left/right → i0 / i7
  const g1L = add(n("g1L", "normal", 50, 21));
  const g1R = add(n("g1R", "event", 42, 20));
  gateBoth(o3, g1L, "g1", "left");
  linkBoth(g1L, inner[0]!);
  gateBoth(o3, g1R, "g1", "right");
  linkBoth(g1R, inner[7]!);

  // G2 East: o9 → left/right → i2 / i1
  const g2L = add(n("g2L", "normal", 80, 54));
  const g2R = add(n("g2R", "lucky", 78, 40));
  gateBoth(o9, g2L, "g2", "left");
  linkBoth(g2L, inner[2]!);
  gateBoth(o9, g2R, "g2", "right");
  linkBoth(g2R, inner[1]!);

  // G3 South: o14 → left/right → i4 / i3
  const g3L = add(n("g3L", "normal", 52, 78));
  const g3R = add(n("g3R", "risk", 64, 78));
  gateBoth(o14, g3L, "g3", "left");
  linkBoth(g3L, inner[4]!);
  gateBoth(o14, g3R, "g3", "right");
  linkBoth(g3R, inner[3]!);

  // G4 West: o19 → left/right → i6 / i5
  const g4L = add(n("g4L", "normal", 20, 52));
  const g4R = add(n("g4R", "event", 20, 60));
  gateBoth(o19, g4L, "g4", "left");
  linkBoth(g4L, inner[6]!);
  gateBoth(o19, g4R, "g4", "right");
  linkBoth(g4R, inner[5]!);

  // G5 Canyon (SW): o16 → left/right → i5 / i4
  const g5L = add(n("g5L", "normal", 30, 74));
  const g5R = add(n("g5R", "ult-orb", 40, 76));
  gateBoth(o16, g5L, "g5", "left");
  linkBoth(g5L, inner[5]!);
  gateBoth(o16, g5R, "g5", "right");
  linkBoth(g5R, inner[4]!);

  // ── Gate Buttons (spurs off outer; always reconnect) ─────────────
  const btn1 = add(
    n("btn-g1", "button", 54, 18, { controlsGate: "g1" })
  );
  const btn2 = add(
    n("btn-g2", "button", 84, 56, { controlsGate: "g2" })
  );
  const btn3 = add(
    n("btn-g3", "button", 54, 84, { controlsGate: "g3" })
  );
  const btn4 = add(
    n("btn-g4", "button", 16, 46, { controlsGate: "g4" })
  );
  const btn5 = add(
    n("btn-g5", "button", 28, 82, { controlsGate: "g5" })
  );
  linkBoth(btn1, o4);
  linkBoth(btn2, o10);
  linkBoth(btn3, o15);
  linkBoth(btn4, o20);
  linkBoth(btn5, o16);

  return [...byId.values()].map((node) => {
    const out: BoardNode = {
      id: node.id,
      type: node.type,
      x: node.x,
      y: node.y,
      next: [...node.next],
    };
    if (node.gateEdges.length > 0) out.gateEdges = [...node.gateEdges];
    if (node.controlsGate) out.controlsGate = node.controlsGate;
    return out;
  });
}

/**
 * ~58-tile organic Kingdom board:
 * outer loop + inner ring + Kingdom Facility + 5 gated shortcuts + 2 portals + 5 buttons.
 */
export const boardLayout: BoardNode[] = buildKingdomBoard();

const LEGACY_POSITION_REMAP: Record<string, string> = {
  "inner-n": "i0",
  "inner-ne": "i2",
  "inner-e": "i2",
  "inner-se": "i3",
  "inner-s": "i4",
  "inner-sw": "i5",
  "inner-w": "i6",
  "inner-nw": "i7",
  "inner-hub": "kingdom",
  "inner-exit-ne": "i2",
  "inner-exit-sw": "i6",
  de: "i2",
  dn: "i0",
  ds: "i4",
  dw: "i6",
  hub: "kingdom",
  "m-top-2": "g1L",
  mn2: "g1L",
  "top-split": "o3",
  ot5: "o3",
  "btn-tr": "btn-g1",
  "btn-bl": "btn-g3",
  "portal-tr": "portal-tr",
  "portal-bl": "portal-bl",
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
  states: GateStates = DEFAULT_GATE_STATES
): string {
  let currentId = migrateBoardPosition(startNodeId);

  for (let i = 0; i < steps; i++) {
    const exits = getNodeExits(currentId, states);
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
  states: GateStates = DEFAULT_GATE_STATES
): BoardNode[] {
  return boardLayout.filter((node) => getNodeExits(node.id, states).length > 1);
}

/** Landmark ids used by the match-start camera overview. */
export function listBoardLandmarks(): { id: string; label: string }[] {
  const shops = boardLayout.filter((n) => n.type === "shop").map((n) => n.id);
  const spikes = boardLayout.filter((n) => n.type === "spike").map((n) => n.id);
  const portals = boardLayout
    .filter((n) => n.type === "portal")
    .map((n) => n.id);
  const buttons = boardLayout
    .filter((n) => n.type === "button")
    .map((n) => n.id);
  return [
    { id: "kingdom", label: "Kingdom Facility" },
    ...shops.slice(0, 2).map((id) => ({ id, label: "Shop" })),
    ...portals.slice(0, 2).map((id) => ({ id, label: "Portal" })),
    ...buttons.slice(0, 2).map((id) => ({ id, label: "Gate" })),
    ...spikes.slice(0, 1).map((id) => ({ id, label: "Spike" })),
  ];
}

/** Ids used to style gated shortcut roads (straighter / accent stroke). */
export const GATE_BRANCH_NODE_IDS: ReadonlySet<string> = new Set([
  "g1L",
  "g1R",
  "g2L",
  "g2R",
  "g3L",
  "g3R",
  "g4L",
  "g4R",
  "g5L",
  "g5R",
  "o3",
  "o9",
  "o14",
  "o16",
  "o19",
  "i0",
  "i1",
  "i2",
  "i3",
  "i4",
  "i5",
  "i6",
  "i7",
  "kingdom",
]);
