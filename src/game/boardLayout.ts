/**
 * ValoRush clover board — four petal loops around a central hub (concept art).
 *
 * - Small hub ring + Kingdom Facility at center (crossroads)
 * - Four distinct loops (TL / TR / BR / BL) — clover / flower, not outer oval
 * - 4 gates at hub↔petal splits (one branch open; never blocks the map)
 * - Gate Buttons flip a single gate; portals at TR / BL (Bind-style pair)
 * - Coordinates are layout-space percentages (roughly 2–99); petals spread out with straighter runs
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

export type GateId = "g1" | "g2" | "g3" | "g4";
export type GateBranch = "left" | "right";
export type GateStates = Record<GateId, GateBranch>;

export const GATE_IDS: readonly GateId[] = ["g1", "g2", "g3", "g4"] as const;

export const DEFAULT_GATE_STATES: GateStates = {
  g1: "left",
  g2: "right",
  g3: "left",
  g4: "right",
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
  /** Always-on directed exits (loops, hub spokes). */
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
] as const;

export const GATE_LABELS: Readonly<Record<GateId, string>> = {
  g1: "NW Gate",
  g2: "NE Gate",
  g3: "SE Gate",
  g4: "SW Gate",
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
    return { g1: "right", g2: "left", g3: "right", g4: "left" };
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

function linkCycle(nodes: MutableNode[]) {
  for (let i = 0; i < nodes.length; i += 1) {
    linkBoth(nodes[i]!, nodes[(i + 1) % nodes.length]!);
  }
}

/**
 * Clover / flower board (~56 tiles):
 * hub ring + Kingdom + 4 petal loops + 4 gates + 2 portals + 4 buttons.
 */
function buildCloverBoard(): BoardNode[] {
  const byId = new Map<string, MutableNode>();
  const add = (node: MutableNode) => {
    byId.set(node.id, node);
    return node;
  };

  // ── Central hub ring (crossroads) — slightly larger for clear spokes ─
  const hub = [
    add(n("i0", "normal", 50, 34)), // N
    add(n("i1", "normal", 61, 39)), // NE — g2 fork
    add(n("i2", "event", 66, 50)), // E
    add(n("i3", "normal", 61, 61)), // SE — g3 fork
    add(n("i4", "normal", 50, 66)), // S
    add(n("i5", "normal", 39, 61)), // SW — g4 fork
    add(n("i6", "lucky", 34, 50)), // W
    add(n("i7", "normal", 39, 39)), // NW — g1 fork
  ];
  linkCycle(hub);

  const kingdom = add(n("kingdom", "special", 50, 50));
  linkBoth(kingdom, hub[0]!); // N
  linkBoth(kingdom, hub[2]!); // E
  linkBoth(kingdom, hub[4]!); // S
  linkBoth(kingdom, hub[6]!); // W

  // ── Top-left petal (START + orb) ─────────────────────────────────
  // Outer loop with even chord spacing; g1L↔g1R closes the petal.
  const g1L = add(n("g1L", "normal", 29, 33));
  const g1R = add(n("g1R", "normal", 40, 31));
  const tl = [
    g1L,
    add(n("tl0", "normal", 18, 28)),
    add(n("tl1", "ult-orb", 9, 19)),
    add(n("start", "start", 4, 8)),
    add(n("tl2", "normal", 9, 2)),
    add(n("tl3", "event", 24, 1)),
    add(n("tl4", "normal", 38, 3)),
    add(n("tl5", "normal", 48, 10)),
    add(n("tl6", "normal", 53, 20)),
    add(n("tl7", "normal", 49, 28)),
    g1R,
  ];
  linkCycle(tl);
  gateBoth(hub[7]!, g1L, "g1", "left");
  gateBoth(hub[7]!, g1R, "g1", "right");

  // ── Top-right petal (purple portal) ──────────────────────────────
  const g2L = add(n("g2L", "normal", 60, 31));
  const g2R = add(n("g2R", "normal", 71, 34));
  const tr = [
    g2L,
    add(n("tr0", "normal", 57, 19)),
    add(n("tr1", "shop", 68, 7)),
    add(n("tr2", "normal", 82, 2)),
    add(n("portal-tr", "portal", 95, 11)),
    add(n("tr3", "risk", 98, 26)),
    add(n("tr4", "ult-orb", 95, 41)),
    add(n("tr5", "normal", 85, 49)),
    add(n("tr6", "normal", 73, 49)),
    add(n("tr7", "normal", 66, 42)),
    g2R,
  ];
  linkCycle(tr);
  gateBoth(hub[1]!, g2L, "g2", "left");
  gateBoth(hub[1]!, g2R, "g2", "right");

  // ── Bottom-right petal (shops / spike) ───────────────────────────
  const g3L = add(n("g3L", "normal", 71, 66));
  const g3R = add(n("g3R", "normal", 60, 71));
  const br = [
    g3L,
    add(n("br0", "shop", 82, 64)),
    add(n("br1", "normal", 94, 71)),
    add(n("br2", "spike", 98, 84)),
    add(n("br3", "minigame", 93, 96)),
    add(n("br4", "event", 76, 99)),
    add(n("br5", "normal", 60, 95)),
    add(n("br6", "normal", 54, 87)),
    add(n("br7", "normal", 54, 77)),
    g3R,
  ];
  linkCycle(br);
  gateBoth(hub[3]!, g3L, "g3", "left");
  gateBoth(hub[3]!, g3R, "g3", "right");

  // ── Bottom-left petal (cyan portal) ──────────────────────────────
  const g4L = add(n("g4L", "normal", 29, 66));
  const g4R = add(n("g4R", "normal", 40, 71));
  const bl = [
    g4L,
    add(n("bl0", "lucky", 18, 64)),
    add(n("bl1", "event", 8, 71)),
    add(n("portal-bl", "portal", 2, 84)),
    add(n("bl2", "minigame", 5, 96)),
    add(n("bl3", "normal", 20, 99)),
    add(n("bl4", "normal", 38, 95)),
    add(n("bl5", "risk", 46, 87)),
    add(n("bl6", "normal", 46, 77)),
    add(n("bl7", "normal", 44, 71)),
    g4R,
  ];
  linkCycle(bl);
  gateBoth(hub[5]!, g4L, "g4", "left");
  gateBoth(hub[5]!, g4R, "g4", "right");

  // ── Gate Buttons (spurs on petals; always reconnect) ─────────────
  const btn1 = add(n("btn-g1", "button", 32, 1, { controlsGate: "g1" }));
  const btn2 = add(n("btn-g2", "button", 91, 33, { controlsGate: "g2" }));
  const btn3 = add(n("btn-g3", "button", 91, 88, { controlsGate: "g3" }));
  const btn4 = add(n("btn-g4", "button", 10, 84, { controlsGate: "g4" }));
  linkBoth(btn1, byId.get("tl4")!);
  linkBoth(btn2, byId.get("tr3")!);
  linkBoth(btn3, byId.get("br2")!);
  linkBoth(btn4, byId.get("bl1")!);

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
 * ~56-tile clover board:
 * hub ring + Kingdom Facility + 4 petal loops + 4 gated splits + 2 portals + 4 buttons.
 */
export const boardLayout: BoardNode[] = buildCloverBoard();

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
  "top-split": "i7",
  ot5: "i7",
  o3: "i7",
  o9: "i1",
  o14: "i3",
  o16: "i5",
  o19: "i5",
  s1: "tl0",
  o0: "tl0",
  o1: "tl3",
  o2: "tl4",
  o4: "tr0",
  o5: "tr1",
  o6: "tr2",
  o7: "tr3",
  o8: "tr4",
  o10: "br0",
  o11: "br2",
  o12: "br3",
  o13: "br4",
  o15: "br5",
  o17: "bl0",
  o18: "bl1",
  o20: "bl7",
  o21: "tl1",
  o22: "tl0",
  o23: "tl7",
  g5L: "g4L",
  g5R: "g4R",
  "btn-tr": "btn-g1",
  "btn-bl": "btn-g4",
  "btn-g5": "btn-g4",
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
    { id: "start", label: "Start" },
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
