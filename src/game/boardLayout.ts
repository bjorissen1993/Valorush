/**
 * ValoRush clover board — four petal loops around a central hub.
 *
 * - Uniform center-to-center pitch (~9) between adjacent connected tiles
 * - Hub ring + Kingdom Facility (cardinal spokes) + four readable petals
 * - Outer rim bridges between adjacent petals (travel without Kingdom)
 * - START is a top-left one-way entry spur (~1 pitch off the circuit via entry)
 * - Gate Y-forks at hub↔petal; buttons sit ON petal roads (not stubs)
 * - Bind-style portals TR/BL; coordinates are layout-space percentages (~2–98)
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
  | "button"
  /** Landing toggles one undirected link open/closed (true door). */
  | "door";

/** Legacy tile types from older saves — remapped on load. */
export type LegacyTileType = TileType | "split" | "merge";

export type GateId = "g1" | "g2" | "g3" | "g4";
export type GateBranch = "left" | "right";
export type GateStates = Record<GateId, GateBranch>;

/** Undirected edge a door tile opens/closes (endpoints unordered in practice). */
export type ControlledEdge = { a: string; b: string };

/**
 * Per-door open/closed map keyed by door tile id.
 * `true` = open (traversable), `false` = closed. Missing keys default to open.
 */
export type DoorStates = Record<string, boolean>;

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
  /**
   * Door tiles: undirected board link this switch toggles.
   * Keep an alternate route — closing a sole bridge soft-locks players.
   */
  controlsEdge?: ControlledEdge;
  /** Initial open state when a match starts (default true). */
  doorStartsOpen?: boolean;
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

/** Normalize undirected endpoint pair for comparisons. */
export function undirectedEdgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function isSameUndirectedEdge(
  edge: ControlledEdge,
  a: string,
  b: string
): boolean {
  return undirectedEdgeKey(edge.a, edge.b) === undirectedEdgeKey(a, b);
}

export function normalizeControlledEdge(a: string, b: string): ControlledEdge {
  return a <= b ? { a, b } : { a: b, b: a };
}

/** Door tiles that bind a controlled link. */
export function listDoorTiles(
  nodes: BoardNode[] = boardLayout
): BoardNode[] {
  return nodes.filter((n) => n.type === "door");
}

export function createDefaultDoorStates(
  nodes: BoardNode[] = boardLayout
): DoorStates {
  const states: DoorStates = {};
  for (const node of nodes) {
    if (node.type !== "door") continue;
    states[node.id] = node.doorStartsOpen !== false;
  }
  return states;
}

export function migrateDoorStates(
  raw?: DoorStates | null,
  nodes: BoardNode[] = boardLayout
): DoorStates {
  const base = createDefaultDoorStates(nodes);
  if (!raw || typeof raw !== "object") return base;
  for (const node of nodes) {
    if (node.type !== "door") continue;
    if (typeof raw[node.id] === "boolean") base[node.id] = raw[node.id]!;
  }
  return base;
}

export function isDoorOpen(
  doorId: string,
  doorStates: DoorStates = {}
): boolean {
  if (Object.prototype.hasOwnProperty.call(doorStates, doorId)) {
    return doorStates[doorId] === true;
  }
  const node = getNodeById(doorId);
  if (node?.type === "door") return node.doorStartsOpen !== false;
  return true;
}

export function toggleDoor(
  doorStates: DoorStates,
  doorId: string
): DoorStates {
  return {
    ...doorStates,
    [doorId]: !isDoorOpen(doorId, doorStates),
  };
}

export function getDoorControlledEdge(
  nodeId: string
): ControlledEdge | null {
  const node = getNodeById(nodeId);
  if (!node || node.type !== "door" || !node.controlsEdge) return null;
  return node.controlsEdge;
}

/** True when a directed hop is blocked by a closed door controlling that link. */
export function isEdgeClosedByDoor(
  fromId: string,
  toId: string,
  doorStates: DoorStates,
  nodes: BoardNode[] = boardLayout
): boolean {
  for (const node of nodes) {
    if (node.type !== "door" || !node.controlsEdge) continue;
    if (!isSameUndirectedEdge(node.controlsEdge, fromId, toId)) continue;
    if (!isDoorOpen(node.id, doorStates)) return true;
  }
  return false;
}

/** Closed door links for barrier visuals (deduped undirected). */
export function listClosedDoorEdges(
  doorStates: DoorStates,
  nodes: BoardNode[] = boardLayout
): { from: string; to: string; doorId: string }[] {
  const seen = new Set<string>();
  const result: { from: string; to: string; doorId: string }[] = [];
  for (const node of nodes) {
    if (node.type !== "door" || !node.controlsEdge) continue;
    if (isDoorOpen(node.id, doorStates)) continue;
    const key = undirectedEdgeKey(node.controlsEdge.a, node.controlsEdge.b);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      from: node.controlsEdge.a,
      to: node.controlsEdge.b,
      doorId: node.id,
    });
  }
  return result;
}

/**
 * Effective directed exits for movement / pathfinding under gate + door states.
 */
export function getNodeExits(
  nodeId: string,
  modeOrStates: GateStates | MidRoadMode = DEFAULT_GATE_STATES,
  doorStates: DoorStates = {}
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
  const filtered = exits.filter(
    (toId) => !isEdgeClosedByDoor(nodeId, toId, doorStates)
  );
  // Board tiles must never offer START corridor as a landing / branch option.
  if (!isStartOneWayTile(nodeId)) {
    return filtered.filter((id) => !isStartOneWayTile(id));
  }
  return filtered;
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

/** Door tile ids currently on the live layout (dynamic; empty on default clover). */
export function listDoorTileIds(
  nodes: BoardNode[] = boardLayout
): readonly string[] {
  return listDoorTiles(nodes).map((n) => n.id);
}

/**
 * BFS from start under gate + door states. Used for soft-lock warnings.
 * Designers should keep an alternate route when a door closes.
 */
export function isBoardReachableFromStart(
  gateStates: GateStates = DEFAULT_GATE_STATES,
  doorStates: DoorStates = {},
  nodes: BoardNode[] = boardLayout
): boolean {
  if (nodes.length === 0) return true;
  const startId = nodes.some((n) => n.id === "start")
    ? "start"
    : nodes[0]!.id;
  const idSet = new Set(nodes.map((n) => n.id));
  const exitsFor = (id: string): string[] => {
    if (nodes === boardLayout) {
      return getNodeExits(id, gateStates, doorStates);
    }
    const node = nodes.find((n) => n.id === id);
    if (!node) return [];
    const exits = [...node.next];
    for (const edge of node.gateEdges ?? []) {
      if (isGateEdgeActive(edge, gateStates)) exits.push(edge.to);
    }
    return exits.filter(
      (toId) =>
        idSet.has(toId) && !isEdgeClosedByDoor(id, toId, doorStates, nodes)
    );
  };
  const seen = new Set<string>();
  const queue = [startId];
  seen.add(startId);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of exitsFor(cur)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  const playable = nodes.filter((n) => !isStartOneWayTile(n.id) || n.id === startId);
  return playable.every((n) => seen.has(n.id) || isStartOneWayTile(n.id));
}

/** True if closing this door would leave some tiles unreachable from start. */
export function wouldClosingDoorDisconnectBoard(
  doorId: string,
  gateStates: GateStates = DEFAULT_GATE_STATES,
  doorStates: DoorStates = {},
  nodes: BoardNode[] = boardLayout
): boolean {
  const closedPreview: DoorStates = { ...doorStates, [doorId]: false };
  return !isBoardReachableFromStart(gateStates, closedPreview, nodes);
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

/** One-way directed edge (START entry spur). */
function linkOne(from: MutableNode, to: MutableNode) {
  if (!from.next.includes(to.id)) from.next.push(to.id);
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
 * Ids that movement / ultimates must never re-enter after leaving START.
 * Graph has outgoing edges only; no inbound from the playable board.
 */
export const START_ONE_WAY_IDS: ReadonlySet<string> = new Set([
  "start",
  "entry",
]);

export function isStartOneWayTile(nodeId: string): boolean {
  return START_ONE_WAY_IDS.has(nodeId);
}

/** Target center-to-center pitch between adjacent connected tiles. */
export const BOARD_TILE_PITCH = 9;

/**
 * Clover board (~57 tiles) with uniform ~9 pitch:
 * hub + Kingdom + 4 petal loops + outer rims + START spur + on-path gates/buttons.
 */
function buildCloverBoard(): BoardNode[] {
  const byId = new Map<string, MutableNode>();
  const add = (node: MutableNode) => {
    byId.set(node.id, node);
    return node;
  };

  // ── Central hub ring — chord ≈ 9 (r = 9 / (2·sin(π/8))) ──────────
  const hub = [
    add(n("i0", "normal", 50.0, 38.2)), // N
    add(n("i1", "normal", 58.3, 41.7)), // NE — g2 fork
    add(n("i2", "event", 61.8, 50.0)), // E
    add(n("i3", "normal", 58.3, 58.3)), // SE — g3 fork
    add(n("i4", "normal", 50.0, 61.8)), // S
    add(n("i5", "normal", 41.7, 58.3)), // SW — g4 fork
    add(n("i6", "lucky", 38.2, 50.0)), // W
    add(n("i7", "normal", 41.7, 41.7)), // NW — g1 fork
  ];
  linkCycle(hub);

  const kingdom = add(n("kingdom", "special", 50.0, 50.0));
  linkBoth(kingdom, hub[0]!); // N
  linkBoth(kingdom, hub[2]!); // E
  linkBoth(kingdom, hub[4]!); // S
  linkBoth(kingdom, hub[6]!); // W

  // ── Top-left petal (START lands on tl4; btn-g1 sits on the outer arc) ─
  // Cycle: g1L → tl0… → btn-g1 → tl4… → g1R → g1L
  const g1L = add(n("g1L", "normal", 33.0, 39.5));
  const g1R = add(n("g1R", "normal", 39.5, 33.0));
  const tl0 = add(n("tl0", "normal", 24.0, 40.9));
  const tl1 = add(n("tl1", "ult-orb", 15.9, 36.7));
  const tl2 = add(n("tl2", "event", 11.7, 28.6));
  const btn1 = add(
    n("btn-g1", "button", 13.2, 19.6, { controlsGate: "g1" })
  );
  const tl4 = add(n("tl4", "normal", 19.6, 13.2));
  const tl5 = add(n("tl5", "normal", 28.6, 11.7));
  const tl6 = add(n("tl6", "lucky", 36.7, 15.9));
  const tl7 = add(n("tl7", "normal", 40.9, 24.0));
  linkCycle([g1L, tl0, tl1, tl2, btn1, tl4, tl5, tl6, tl7, g1R]);
  gateBoth(hub[7]!, g1L, "g1", "left");
  gateBoth(hub[7]!, g1R, "g1", "right");

  // START top-left one-way spur: sit just off the petal (~min pitch hops).
  // start → entry → tl4; visually ~1.5 pitches from the running board (not ~2+).
  const start = add(n("start", "start", 8.4, 5.8));
  const entry = add(n("entry", "ult-orb", 14.0, 9.5));
  linkOne(start, entry);
  linkOne(entry, tl4);

  // ── Top-right petal (Bind portal + on-path btn-g2) ───────────────
  const g2L = add(n("g2L", "normal", 60.5, 33.0));
  const g2R = add(n("g2R", "normal", 67.0, 39.5));
  const tr3 = add(n("tr3", "normal", 59.1, 24.0));
  const tr4 = add(n("tr4", "shop", 63.3, 15.9));
  const tr5 = add(n("tr5", "normal", 71.4, 11.7));
  const btn2 = add(
    n("btn-g2", "button", 80.4, 13.2, { controlsGate: "g2" })
  );
  const portalTr = add(n("portal-tr", "portal", 86.8, 19.6));
  const tr0 = add(n("tr0", "ult-orb", 88.3, 28.6));
  const tr1 = add(n("tr1", "risk", 84.1, 36.7));
  const tr2 = add(n("tr2", "normal", 76.0, 40.9));
  linkCycle([g2L, tr3, tr4, tr5, btn2, portalTr, tr0, tr1, tr2, g2R]);
  gateBoth(hub[1]!, g2L, "g2", "left");
  gateBoth(hub[1]!, g2R, "g2", "right");

  // ── Bottom-right petal (shop / spike + on-path btn-g3) ───────────
  const g3L = add(n("g3L", "normal", 67.0, 60.5));
  const g3R = add(n("g3R", "normal", 60.5, 67.0));
  const br0 = add(n("br0", "shop", 76.0, 59.1));
  const br1 = add(n("br1", "normal", 84.1, 63.3));
  const br2 = add(n("br2", "spike", 88.3, 71.4));
  const br3 = add(n("br3", "minigame", 86.8, 80.4));
  const btn3 = add(
    n("btn-g3", "button", 80.4, 86.8, { controlsGate: "g3" })
  );
  const br5 = add(n("br5", "event", 71.4, 88.3));
  const br6 = add(n("br6", "normal", 63.3, 84.1));
  const br7 = add(n("br7", "normal", 59.1, 76.0));
  linkCycle([g3L, br0, br1, br2, br3, btn3, br5, br6, br7, g3R]);
  gateBoth(hub[3]!, g3L, "g3", "left");
  gateBoth(hub[3]!, g3R, "g3", "right");

  // ── Bottom-left petal (Bind portal + on-path btn-g4) ─────────────
  const g4L = add(n("g4L", "normal", 39.5, 67.0));
  const g4R = add(n("g4R", "normal", 33.0, 60.5));
  const bl0 = add(n("bl0", "lucky", 40.9, 76.0));
  const bl1 = add(n("bl1", "event", 36.7, 84.1));
  const bl2 = add(n("bl2", "minigame", 28.6, 88.3));
  const btn4 = add(
    n("btn-g4", "button", 19.6, 86.8, { controlsGate: "g4" })
  );
  const portalBl = add(n("portal-bl", "portal", 13.2, 80.4));
  const bl5 = add(n("bl5", "risk", 11.7, 71.4));
  const bl6 = add(n("bl6", "normal", 15.9, 63.3));
  const bl7 = add(n("bl7", "normal", 24.0, 59.1));
  linkCycle([g4L, bl0, bl1, bl2, btn4, portalBl, bl5, bl6, bl7, g4R]);
  gateBoth(hub[5]!, g4L, "g4", "left");
  gateBoth(hub[5]!, g4R, "g4", "right");

  // ── Outer rim bridges (petal ↔ petal without Kingdom) ───────────
  const n0 = add(n("n0", "normal", 45.0, 12.5));
  const n1 = add(n("n1", "normal", 55.0, 12.5));
  linkBoth(tl6, n0);
  linkBoth(n0, n1);
  linkBoth(n1, tr4);

  const e0 = add(n("e0", "normal", 79.5, 50.0));
  linkBoth(tr2, e0);
  linkBoth(e0, br0);

  const s0 = add(n("s0", "normal", 55.0, 85.0));
  const s1 = add(n("s1", "normal", 47.5, 81.5));
  linkBoth(br6, s0);
  linkBoth(s0, s1);
  linkBoth(s1, bl0);

  const w0 = add(n("w0", "normal", 20.5, 50.0));
  linkBoth(bl7, w0);
  linkBoth(w0, tl0);

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
 * ~57-tile clover board: outer rims, on-path gate buttons, one-way START spur.
 * Live mutable array — game systems read this; the board editor mutates in place.
 */
export const boardLayout: BoardNode[] = buildCloverBoard();

/** Immutable factory snapshot used to reset the live layout. */
export function createDefaultBoardLayout(): BoardNode[] {
  return buildCloverBoard();
}

const BOARD_LAYOUT_STORAGE_KEY = "valorush_board_layout_v1";

type BoardLayoutListener = () => void;
const boardLayoutListeners = new Set<BoardLayoutListener>();
let boardLayoutEpoch = 0;

function cloneBoardNodes(nodes: BoardNode[]): BoardNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    next: [...node.next],
    ...(node.gateEdges ? { gateEdges: node.gateEdges.map((e) => ({ ...e })) } : {}),
    ...(node.controlsGate ? { controlsGate: node.controlsGate } : {}),
    ...(node.controlsEdge
      ? { controlsEdge: { a: node.controlsEdge.a, b: node.controlsEdge.b } }
      : {}),
    ...(node.doorStartsOpen === false ? { doorStartsOpen: false } : {}),
  }));
}

function notifyBoardLayoutListeners() {
  boardLayoutEpoch += 1;
  for (const listener of boardLayoutListeners) listener();
}

/** Subscribe to live boardLayout mutations (editor / localStorage restore). */
export function subscribeBoardLayout(listener: BoardLayoutListener): () => void {
  boardLayoutListeners.add(listener);
  return () => {
    boardLayoutListeners.delete(listener);
  };
}

export function getBoardLayoutEpoch(): number {
  return boardLayoutEpoch;
}

/** Replace live layout contents (keeps the same array reference for importers). */
export function replaceBoardLayout(nodes: BoardNode[], opts?: { persist?: boolean }) {
  const next = cloneBoardNodes(nodes);
  boardLayout.length = 0;
  boardLayout.push(...next);
  if (opts?.persist !== false) {
    persistBoardLayoutToStorage();
  }
  notifyBoardLayoutListeners();
}

export function resetBoardLayoutToDefault(opts?: { persist?: boolean }) {
  replaceBoardLayout(createDefaultBoardLayout(), opts);
}

export function persistBoardLayoutToStorage() {
  try {
    localStorage.setItem(
      BOARD_LAYOUT_STORAGE_KEY,
      JSON.stringify(cloneBoardNodes(boardLayout))
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadBoardLayoutFromStorage(): boolean {
  try {
    const raw = localStorage.getItem(BOARD_LAYOUT_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    const nodes: BoardNode[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.id !== "string" || typeof rec.type !== "string") continue;
      if (typeof rec.x !== "number" || typeof rec.y !== "number") continue;
      if (!Array.isArray(rec.next)) continue;
      const node: BoardNode = {
        id: rec.id,
        type: migrateTileType(rec.type),
        x: rec.x,
        y: rec.y,
        next: rec.next.filter((id): id is string => typeof id === "string"),
      };
      if (Array.isArray(rec.gateEdges)) {
        node.gateEdges = rec.gateEdges
          .filter((e): e is GateEdge => {
            if (!e || typeof e !== "object") return false;
            const edge = e as Record<string, unknown>;
            return (
              typeof edge.to === "string" &&
              (edge.gateId === "g1" ||
                edge.gateId === "g2" ||
                edge.gateId === "g3" ||
                edge.gateId === "g4") &&
              (edge.branch === "left" || edge.branch === "right")
            );
          })
          .map((e) => ({ to: e.to, gateId: e.gateId, branch: e.branch }));
      }
      if (
        rec.controlsGate === "g1" ||
        rec.controlsGate === "g2" ||
        rec.controlsGate === "g3" ||
        rec.controlsGate === "g4"
      ) {
        node.controlsGate = rec.controlsGate;
      }
      if (rec.controlsEdge && typeof rec.controlsEdge === "object") {
        const edge = rec.controlsEdge as Record<string, unknown>;
        if (typeof edge.a === "string" && typeof edge.b === "string") {
          node.controlsEdge = normalizeControlledEdge(edge.a, edge.b);
        }
      }
      if (rec.doorStartsOpen === false) {
        node.doorStartsOpen = false;
      }
      nodes.push(node);
    }
    if (nodes.length === 0) return false;
    replaceBoardLayout(nodes, { persist: false });
    return true;
  } catch {
    return false;
  }
}

export function clearStoredBoardLayout() {
  try {
    localStorage.removeItem(BOARD_LAYOUT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function exportBoardLayoutJson(nodes: BoardNode[] = boardLayout): string {
  return JSON.stringify(cloneBoardNodes(nodes), null, 2);
}

/** TypeScript snippet matching `boardLayout` export shape for pasting into code. */
export function exportBoardLayoutTypeScript(
  nodes: BoardNode[] = boardLayout
): string {
  const body = nodes
    .map((node) => {
      const parts = [
        `id: ${JSON.stringify(node.id)}`,
        `type: ${JSON.stringify(node.type)}`,
        `x: ${Number(node.x.toFixed(2))}`,
        `y: ${Number(node.y.toFixed(2))}`,
        `next: ${JSON.stringify(node.next)}`,
      ];
      if (node.gateEdges?.length) {
        parts.push(`gateEdges: ${JSON.stringify(node.gateEdges)}`);
      }
      if (node.controlsGate) {
        parts.push(`controlsGate: ${JSON.stringify(node.controlsGate)}`);
      }
      if (node.controlsEdge) {
        parts.push(`controlsEdge: ${JSON.stringify(node.controlsEdge)}`);
      }
      if (node.doorStartsOpen === false) {
        parts.push(`doorStartsOpen: false`);
      }
      return `  { ${parts.join(", ")} }`;
    })
    .join(",\n");
  return `import type { BoardNode } from "./boardLayout";\n\nexport const boardLayout: BoardNode[] = [\n${body}\n];\n`;
}

export function updateBoardNodePosition(nodeId: string, x: number, y: number) {
  const node = boardLayout.find((n) => n.id === nodeId);
  if (!node) return;
  node.x = Math.round(Math.max(2, Math.min(98, x)) * 10) / 10;
  node.y = Math.round(Math.max(2, Math.min(98, y)) * 10) / 10;
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

export function addBoardNode(partial: {
  id?: string;
  type: TileType;
  x: number;
  y: number;
}): BoardNode {
  let id = partial.id?.trim() || "";
  if (!id || boardLayout.some((n) => n.id === id)) {
    const base = partial.type === "start" ? "start" : `tile`;
    let i = boardLayout.length + 1;
    id = `${base}-${i}`;
    while (boardLayout.some((n) => n.id === id)) {
      i += 1;
      id = `${base}-${i}`;
    }
  }
  const node: BoardNode = {
    id,
    type: partial.type,
    x: Math.round(Math.max(2, Math.min(98, partial.x)) * 10) / 10,
    y: Math.round(Math.max(2, Math.min(98, partial.y)) * 10) / 10,
    next: [],
  };
  boardLayout.push(node);
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
  return node;
}

export function removeBoardNode(nodeId: string) {
  const idx = boardLayout.findIndex((n) => n.id === nodeId);
  if (idx < 0) return;
  boardLayout.splice(idx, 1);
  for (const node of boardLayout) {
    node.next = node.next.filter((id) => id !== nodeId);
    if (node.gateEdges) {
      node.gateEdges = node.gateEdges.filter((e) => e.to !== nodeId);
      if (node.gateEdges.length === 0) delete node.gateEdges;
    }
    if (
      node.controlsEdge &&
      (node.controlsEdge.a === nodeId || node.controlsEdge.b === nodeId)
    ) {
      delete node.controlsEdge;
    }
  }
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

/** Add a directed edge from → to. When bidirectional, also adds to → from. */
export function linkBoardNodes(
  fromId: string,
  toId: string,
  opts?: { bidirectional?: boolean }
) {
  if (fromId === toId) return;
  const from = boardLayout.find((n) => n.id === fromId);
  const to = boardLayout.find((n) => n.id === toId);
  if (!from || !to) return;
  if (!from.next.includes(toId)) from.next.push(toId);
  if (opts?.bidirectional !== false && !to.next.includes(fromId)) {
    to.next.push(fromId);
  }
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

/** Remove undirected connection (both directions + gate edges between the pair). */
export function unlinkBoardNodes(aId: string, bId: string) {
  const a = boardLayout.find((n) => n.id === aId);
  const b = boardLayout.find((n) => n.id === bId);
  if (a) {
    a.next = a.next.filter((id) => id !== bId);
    if (a.gateEdges) {
      a.gateEdges = a.gateEdges.filter((e) => e.to !== bId);
      if (a.gateEdges.length === 0) delete a.gateEdges;
    }
  }
  if (b) {
    b.next = b.next.filter((id) => id !== aId);
    if (b.gateEdges) {
      b.gateEdges = b.gateEdges.filter((e) => e.to !== aId);
      if (b.gateEdges.length === 0) delete b.gateEdges;
    }
  }
  for (const node of boardLayout) {
    if (
      node.controlsEdge &&
      isSameUndirectedEdge(node.controlsEdge, aId, bId)
    ) {
      delete node.controlsEdge;
    }
  }
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

/**
 * Bind a door tile to an undirected link. Ensures a bidirectional `next` edge
 * exists so the path is drawn and can be toggled closed at runtime.
 */
export function assignDoorControlledEdge(
  doorId: string,
  aId: string,
  bId: string
): { ok: boolean; warning?: string } {
  if (aId === bId) return { ok: false, warning: "Pick two different tiles." };
  const door = boardLayout.find((n) => n.id === doorId);
  if (!door || door.type !== "door") {
    return { ok: false, warning: "Select a door tile first." };
  }
  const a = boardLayout.find((n) => n.id === aId);
  const b = boardLayout.find((n) => n.id === bId);
  if (!a || !b) return { ok: false, warning: "Both tiles must exist." };

  // Ensure physical link exists (two-way) so the road is drawn.
  if (!a.next.includes(bId)) a.next.push(bId);
  if (!b.next.includes(aId)) b.next.push(aId);

  door.controlsEdge = normalizeControlledEdge(aId, bId);
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();

  let warning: string | undefined;
  if (wouldClosingDoorDisconnectBoard(doorId)) {
    warning =
      "Closing this door may disconnect the board from START — keep an alternate route.";
  }
  return { ok: true, warning };
}

export function clearDoorControlledEdge(doorId: string) {
  const door = boardLayout.find((n) => n.id === doorId);
  if (!door || door.type !== "door") return;
  delete door.controlsEdge;
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

export function setDoorStartsOpen(doorId: string, startsOpen: boolean) {
  const door = boardLayout.find((n) => n.id === doorId);
  if (!door || door.type !== "door") return;
  if (startsOpen) delete door.doorStartsOpen;
  else door.doorStartsOpen = false;
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

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
  o1: "btn-g1",
  o2: "tl4",
  o4: "tr3",
  o5: "tr4",
  o6: "tr5",
  o7: "btn-g2",
  o8: "portal-tr",
  o10: "br0",
  o11: "br2",
  o12: "br3",
  o13: "btn-g3",
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
  // Prior clover had START inside the TL loop / button stubs as cul-de-sacs.
  tl2: "tl2",
  tl3: "btn-g1",
  tr6: "btn-g2",
  br4: "btn-g3",
  bl3: "btn-g4",
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
  "door",
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
  states: GateStates = DEFAULT_GATE_STATES,
  doorStates: DoorStates = {}
): string {
  let currentId = migrateBoardPosition(startNodeId);

  for (let i = 0; i < steps; i++) {
    const exits = getNodeExits(currentId, states, doorStates);
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
  states: GateStates = DEFAULT_GATE_STATES,
  doorStates: DoorStates = {}
): BoardNode[] {
  return boardLayout.filter(
    (node) => getNodeExits(node.id, states, doorStates).length > 1
  );
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
  const doors = boardLayout.filter((n) => n.type === "door").map((n) => n.id);
  return [
    { id: "kingdom", label: "Kingdom Facility" },
    { id: "start", label: "Start" },
    ...shops.slice(0, 2).map((id) => ({ id, label: "Shop" })),
    ...portals.slice(0, 2).map((id) => ({ id, label: "Portal" })),
    ...buttons.slice(0, 2).map((id) => ({ id, label: "Gate" })),
    ...doors.slice(0, 2).map((id) => ({ id, label: "Door" })),
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
