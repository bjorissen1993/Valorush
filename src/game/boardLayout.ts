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
  | "button";

/** Legacy tile types from older saves — remapped on load. */
export type LegacyTileType = TileType | "split" | "merge" | "door";

export type GateId = "g1" | "g2" | "g3" | "g4";
export type GateBranch = "left" | "right";
export type GateStates = Record<GateId, GateBranch>;

/** Undirected edge endpoints (unordered in practice). */
export type ControlledEdge = { a: string; b: string };

/** Per-link config on a button tile — openness follows ON/OFF + mapping. */
export type ButtonLinkConfig = ControlledEdge & {
  /** Link is open when the button is ON (default true). OFF inverts. */
  openWhenOn?: boolean;
  /** Cycle this link's direction when the button is pressed. */
  flipDirection?: boolean;
};

/** Which behaviors fire when a player lands on / presses the button. */
export type ButtonActions = {
  /** Open/close controlled links from ON/OFF state (default when links exist). */
  toggleLinks?: boolean;
  /** Flip direction on links marked `flipDirection`. */
  flipDirections?: boolean;
  /** Toggle a Y-gate branch (`controlsGate`). */
  toggleGate?: boolean;
};

/**
 * Per-button ON/OFF map keyed by button tile id.
 * `true` = ON, `false` = OFF. Missing keys use `buttonStartsOn` (default ON).
 */
export type ButtonStates = Record<string, boolean>;

/** @deprecated Use ButtonStates — kept for older online snapshots. */
export type DoorStates = ButtonStates;

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

/** Preset path stroke colors for the board editor. */
export const EDGE_COLOR_PRESETS = [
  "#22d3ee",
  "#f472b6",
  "#fbbf24",
  "#4ade80",
  "#a78bfa",
  "#fb7185",
  "#38bdf8",
  "#f97316",
] as const;

export type EdgeDirectionMode = "a-to-b" | "b-to-a" | "both" | "none";

export type BoardNode = {
  id: string;
  type: TileType;
  x: number;
  y: number;
  /** Always-on directed exits (loops, hub spokes). */
  next: string[];
  /** Gate-filtered exits — active only when that gate's branch matches. */
  gateEdges?: GateEdge[];
  /** Button: which Y-gate branch this switch toggles (clover petals). */
  controlsGate?: GateId;
  /** Button: controlled links with per-link ON/OFF mapping and optional direction flip. */
  buttonLinks?: ButtonLinkConfig[];
  /** Which actions run when the button is pressed (inferred from links/gate if omitted). */
  buttonActions?: ButtonActions;
  /** Initial ON state when a match starts (default true). */
  buttonStartsOn?: boolean;
  /**
   * @deprecated Migrated to `buttonLinks` on load. Legacy door single link.
   */
  controlsEdge?: ControlledEdge;
  /**
   * @deprecated Migrated to `buttonLinks` on load. Legacy door multi-link list.
   */
  controlsEdges?: ControlledEdge[];
  /** @deprecated Migrated to `buttonStartsOn` on load. */
  doorStartsOpen?: boolean;
  /**
   * Optional stroke colors for roads to neighbor ids (CSS hex).
   * Undirected lookup checks either endpoint.
   */
  linkColors?: Record<string, string>;
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

/** Normalize a raw node: migrate legacy door fields → unified button model. */
export function migrateBoardNode(node: BoardNode): BoardNode {
  if (node.type === ("door" as string)) {
    node.type = "button";
  }
  if (node.type !== "button") return node;

  if (!node.buttonLinks?.length) {
    const legacy: ButtonLinkConfig[] = [];
    const seen = new Set<string>();
    const push = (edge: ControlledEdge, openWhenOn = true) => {
      const normalized = normalizeControlledEdge(edge.a, edge.b);
      const key = undirectedEdgeKey(normalized.a, normalized.b);
      if (seen.has(key)) return;
      seen.add(key);
      legacy.push({ ...normalized, openWhenOn });
    };
    for (const edge of node.controlsEdges ?? []) push(edge);
    if (node.controlsEdge) push(node.controlsEdge);
    if (legacy.length > 0) node.buttonLinks = legacy;
  }
  delete node.controlsEdge;
  delete node.controlsEdges;

  if (node.buttonStartsOn === undefined && node.doorStartsOpen === false) {
    node.buttonStartsOn = false;
  }
  delete node.doorStartsOpen;

  if (!node.buttonActions) {
    const actions: ButtonActions = {};
    if (node.buttonLinks?.length) actions.toggleLinks = true;
    if (node.controlsGate) actions.toggleGate = true;
    if (Object.keys(actions).length > 0) node.buttonActions = actions;
  }

  return node;
}

/** Button tiles on the layout (post-migration). */
export function listButtonTiles(
  nodes: BoardNode[] = boardLayout
): BoardNode[] {
  return nodes.filter((n) => n.type === "button");
}

/** @deprecated Prefer listButtonTiles. */
export function listDoorTiles(nodes: BoardNode[] = boardLayout): BoardNode[] {
  return listButtonTiles(nodes);
}

export function getButtonActions(nodeOrId: BoardNode | string): ButtonActions {
  const node =
    typeof nodeOrId === "string" ? getNodeById(nodeOrId) : nodeOrId;
  if (!node || node.type !== "button") return {};
  migrateBoardNode(node);
  if (node.buttonActions) return { ...node.buttonActions };
  const inferred: ButtonActions = {};
  if (getButtonControlledLinks(node).length > 0) inferred.toggleLinks = true;
  if (node.controlsGate) inferred.toggleGate = true;
  return inferred;
}

/** Controlled links for a button (deduped, migrated from legacy door fields). */
export function getButtonControlledLinks(
  nodeOrId: BoardNode | string
): ButtonLinkConfig[] {
  const node =
    typeof nodeOrId === "string" ? getNodeById(nodeOrId) : nodeOrId;
  if (!node || node.type !== "button") return [];
  migrateBoardNode(node);
  return (node.buttonLinks ?? []).map((link) => ({
    ...normalizeControlledEdge(link.a, link.b),
    ...(link.openWhenOn === false ? { openWhenOn: false } : {}),
    ...(link.flipDirection ? { flipDirection: true } : {}),
  }));
}

/** @deprecated Prefer getButtonControlledLinks. */
export function getDoorControlledEdges(
  nodeOrId: BoardNode | string
): ControlledEdge[] {
  return getButtonControlledLinks(nodeOrId).map(({ a, b }) => ({ a, b }));
}

/** @deprecated Prefer getButtonControlledLinks. */
export function getDoorControlledEdge(nodeId: string): ControlledEdge | null {
  return getButtonControlledLinks(nodeId)[0] ?? null;
}

/** True when a controlled link is traversable for the given button ON state. */
export function isLinkOpenForButtonState(
  link: ButtonLinkConfig,
  isOn: boolean
): boolean {
  const openWhenOn = link.openWhenOn !== false;
  return isOn ? openWhenOn : !openWhenOn;
}

export function createDefaultButtonStates(
  nodes: BoardNode[] = boardLayout
): ButtonStates {
  const states: ButtonStates = {};
  for (const node of nodes) {
    if (node.type !== "button") continue;
    migrateBoardNode(node);
    states[node.id] = node.buttonStartsOn !== false;
  }
  return states;
}

/** @deprecated Prefer createDefaultButtonStates. */
export function createDefaultDoorStates(
  nodes: BoardNode[] = boardLayout
): ButtonStates {
  return createDefaultButtonStates(nodes);
}

export function migrateButtonStates(
  raw?: ButtonStates | null,
  nodes: BoardNode[] = boardLayout
): ButtonStates {
  const base = createDefaultButtonStates(nodes);
  if (!raw || typeof raw !== "object") return base;
  for (const node of nodes) {
    if (node.type !== "button") continue;
    if (typeof raw[node.id] === "boolean") base[node.id] = raw[node.id]!;
  }
  return base;
}

/** @deprecated Prefer migrateButtonStates. */
export function migrateDoorStates(
  raw?: ButtonStates | null,
  nodes: BoardNode[] = boardLayout
): ButtonStates {
  return migrateButtonStates(raw, nodes);
}

export function isButtonOn(
  buttonId: string,
  buttonStates: ButtonStates = {}
): boolean {
  if (Object.prototype.hasOwnProperty.call(buttonStates, buttonId)) {
    return buttonStates[buttonId] === true;
  }
  const node = getNodeById(buttonId);
  if (node?.type === "button") {
    migrateBoardNode(node);
    return node.buttonStartsOn !== false;
  }
  return true;
}

/** @deprecated Prefer isButtonOn — same semantics after door→button merge. */
export function isDoorOpen(
  doorId: string,
  doorStates: ButtonStates = {}
): boolean {
  return isButtonOn(doorId, doorStates);
}

export function toggleButton(
  buttonStates: ButtonStates,
  buttonId: string
): ButtonStates {
  return {
    ...buttonStates,
    [buttonId]: !isButtonOn(buttonId, buttonStates),
  };
}

/** @deprecated Prefer toggleButton. */
export function toggleDoor(
  doorStates: ButtonStates,
  doorId: string
): ButtonStates {
  return toggleButton(doorStates, doorId);
}

function buttonControlsUndirectedEdge(
  node: BoardNode,
  fromId: string,
  toId: string
): ButtonLinkConfig | null {
  return (
    getButtonControlledLinks(node).find((link) =>
      isSameUndirectedEdge(link, fromId, toId)
    ) ?? null
  );
}

/** True when a directed hop is blocked by a button-controlled closed link. */
export function isEdgeClosedByButton(
  fromId: string,
  toId: string,
  buttonStates: ButtonStates,
  nodes: BoardNode[] = boardLayout
): boolean {
  for (const node of nodes) {
    migrateBoardNode(node);
    if (node.type !== "button") continue;
    const actions = getButtonActions(node);
    if (!actions.toggleLinks && getButtonControlledLinks(node).length === 0) {
      continue;
    }
    const link = buttonControlsUndirectedEdge(node, fromId, toId);
    if (!link) continue;
    if (!isLinkOpenForButtonState(link, isButtonOn(node.id, buttonStates))) {
      return true;
    }
  }
  return false;
}

/** @deprecated Prefer isEdgeClosedByButton. */
export function isEdgeClosedByDoor(
  fromId: string,
  toId: string,
  doorStates: ButtonStates,
  nodes: BoardNode[] = boardLayout
): boolean {
  return isEdgeClosedByButton(fromId, toId, doorStates, nodes);
}

/** Closed button links for barrier visuals (deduped undirected). */
export function listClosedButtonEdges(
  buttonStates: ButtonStates,
  nodes: BoardNode[] = boardLayout
): { from: string; to: string; buttonId: string }[] {
  const seen = new Set<string>();
  const result: { from: string; to: string; buttonId: string }[] = [];
  for (const node of nodes) {
    migrateBoardNode(node);
    if (node.type !== "button") continue;
    for (const link of getButtonControlledLinks(node)) {
      if (isLinkOpenForButtonState(link, isButtonOn(node.id, buttonStates))) {
        continue;
      }
      const key = undirectedEdgeKey(link.a, link.b);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ from: link.a, to: link.b, buttonId: node.id });
    }
  }
  return result;
}

/** @deprecated Prefer listClosedButtonEdges. */
export function listClosedDoorEdges(
  doorStates: ButtonStates,
  nodes: BoardNode[] = boardLayout
): { from: string; to: string; doorId: string }[] {
  return listClosedButtonEdges(doorStates, nodes).map((e) => ({
    from: e.from,
    to: e.to,
    doorId: e.buttonId,
  }));
}

/**
 * Effective directed exits for movement / pathfinding under gate + door states.
 */
export function getNodeExits(
  nodeId: string,
  modeOrStates: GateStates | MidRoadMode = DEFAULT_GATE_STATES,
  buttonStates: ButtonStates = {}
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
    (toId) => !isEdgeClosedByButton(nodeId, toId, buttonStates)
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

/** Button tile ids currently on the live layout. */
export function listButtonTileIds(
  nodes: BoardNode[] = boardLayout
): readonly string[] {
  return listButtonTiles(nodes).map((n) => n.id);
}

/** @deprecated Prefer listButtonTileIds. */
export function listDoorTileIds(
  nodes: BoardNode[] = boardLayout
): readonly string[] {
  return listButtonTileIds(nodes);
}

/**
 * BFS from start under gate + door states. Used for soft-lock warnings.
 * Designers should keep an alternate route when a door closes.
 */
export function isBoardReachableFromStart(
  gateStates: GateStates = DEFAULT_GATE_STATES,
  buttonStates: ButtonStates = {},
  nodes: BoardNode[] = boardLayout
): boolean {
  if (nodes.length === 0) return true;
  const startId = nodes.some((n) => n.id === "start")
    ? "start"
    : nodes[0]!.id;
  const idSet = new Set(nodes.map((n) => n.id));
  const exitsFor = (id: string): string[] => {
    if (nodes === boardLayout) {
      return getNodeExits(id, gateStates, buttonStates);
    }
    const node = nodes.find((n) => n.id === id);
    if (!node) return [];
    const exits = [...node.next];
    for (const edge of node.gateEdges ?? []) {
      if (isGateEdgeActive(edge, gateStates)) exits.push(edge.to);
    }
    return exits.filter(
      (toId) =>
        idSet.has(toId) && !isEdgeClosedByButton(id, toId, buttonStates, nodes)
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

/** True if turning a button OFF would leave some tiles unreachable from start. */
export function wouldClosingButtonDisconnectBoard(
  buttonId: string,
  gateStates: GateStates = DEFAULT_GATE_STATES,
  buttonStates: ButtonStates = {},
  nodes: BoardNode[] = boardLayout
): boolean {
  const offPreview: ButtonStates = { ...buttonStates, [buttonId]: false };
  return !isBoardReachableFromStart(gateStates, offPreview, nodes);
}

/** @deprecated Prefer wouldClosingButtonDisconnectBoard. */
export function wouldClosingDoorDisconnectBoard(
  doorId: string,
  gateStates: GateStates = DEFAULT_GATE_STATES,
  doorStates: ButtonStates = {},
  nodes: BoardNode[] = boardLayout
): boolean {
  return wouldClosingButtonDisconnectBoard(
    doorId,
    gateStates,
    doorStates,
    nodes
  );
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

function cloneLinkColors(
  colors?: Record<string, string>
): Record<string, string> | undefined {
  if (!colors) return undefined;
  const entries = Object.entries(colors).filter(
    ([k, v]) => typeof k === "string" && typeof v === "string" && v.length > 0
  );
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

/** Persist button links only (drops legacy door fields). */
function cloneButtonControls(node: BoardNode): Partial<BoardNode> {
  migrateBoardNode(node);
  const links = getButtonControlledLinks(node);
  const partial: Partial<BoardNode> = {};
  if (links.length > 0) {
    partial.buttonLinks = links.map((link) => ({
      a: link.a,
      b: link.b,
      ...(link.openWhenOn === false ? { openWhenOn: false } : {}),
      ...(link.flipDirection ? { flipDirection: true } : {}),
    }));
  }
  if (node.buttonActions && Object.keys(node.buttonActions).length > 0) {
    partial.buttonActions = { ...node.buttonActions };
  }
  if (node.buttonStartsOn === false) {
    partial.buttonStartsOn = false;
  }
  return partial;
}

/** @deprecated Prefer cloneButtonControls. */
function cloneDoorControls(node: BoardNode): Partial<BoardNode> {
  return cloneButtonControls(node);
}

function cloneBoardNodes(nodes: BoardNode[]): BoardNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    x: node.x,
    y: node.y,
    next: [...node.next],
    ...(node.gateEdges ? { gateEdges: node.gateEdges.map((e) => ({ ...e })) } : {}),
    ...(node.controlsGate ? { controlsGate: node.controlsGate } : {}),
    ...cloneButtonControls(node),
    ...(cloneLinkColors(node.linkColors)
      ? { linkColors: cloneLinkColors(node.linkColors) }
      : {}),
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
      migrateBoardNode(node);
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
      const parseButtonLink = (raw: unknown): ButtonLinkConfig | null => {
        if (!raw || typeof raw !== "object") return null;
        const edge = raw as Record<string, unknown>;
        if (typeof edge.a !== "string" || typeof edge.b !== "string") return null;
        const link: ButtonLinkConfig = normalizeControlledEdge(edge.a, edge.b);
        if (edge.openWhenOn === false) link.openWhenOn = false;
        if (edge.flipDirection === true) link.flipDirection = true;
        return link;
      };
      const buttonLinks: ButtonLinkConfig[] = [];
      const pushLink = (link: ButtonLinkConfig | null) => {
        if (!link) return;
        const key = undirectedEdgeKey(link.a, link.b);
        if (buttonLinks.some((l) => undirectedEdgeKey(l.a, l.b) === key)) return;
        buttonLinks.push(link);
      };
      if (Array.isArray(rec.buttonLinks)) {
        for (const item of rec.buttonLinks) pushLink(parseButtonLink(item));
      }
      const pushLegacyEdge = (raw: unknown) => {
        const parsed = parseButtonLink(raw);
        if (parsed) pushLink(parsed);
      };
      if (Array.isArray(rec.controlsEdges)) {
        for (const item of rec.controlsEdges) pushLegacyEdge(item);
      }
      pushLegacyEdge(rec.controlsEdge);
      if (buttonLinks.length > 0) node.buttonLinks = buttonLinks;
      if (rec.buttonActions && typeof rec.buttonActions === "object") {
        const actions = rec.buttonActions as Record<string, unknown>;
        node.buttonActions = {
          ...(actions.toggleLinks === true ? { toggleLinks: true } : {}),
          ...(actions.flipDirections === true ? { flipDirections: true } : {}),
          ...(actions.toggleGate === true ? { toggleGate: true } : {}),
        };
      }
      if (rec.buttonStartsOn === false) node.buttonStartsOn = false;
      if (rec.doorStartsOpen === false) node.doorStartsOpen = false;
      if (rec.linkColors && typeof rec.linkColors === "object") {
        const colors: Record<string, string> = {};
        for (const [key, value] of Object.entries(
          rec.linkColors as Record<string, unknown>
        )) {
          if (typeof value === "string" && value.length > 0) colors[key] = value;
        }
        if (Object.keys(colors).length > 0) node.linkColors = colors;
      }
      migrateBoardNode(node);
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
      migrateBoardNode(node);
      const links = getButtonControlledLinks(node);
      if (links.length > 0) {
        parts.push(`buttonLinks: ${JSON.stringify(links)}`);
      }
      if (node.buttonActions && Object.keys(node.buttonActions).length > 0) {
        parts.push(`buttonActions: ${JSON.stringify(node.buttonActions)}`);
      }
      if (node.buttonStartsOn === false) {
        parts.push(`buttonStartsOn: false`);
      }
      if (node.linkColors && Object.keys(node.linkColors).length > 0) {
        parts.push(`linkColors: ${JSON.stringify(node.linkColors)}`);
      }
      return `  { ${parts.join(", ")} }`;
    })
    .join(",\n");
  return `import type { BoardNode } from "./boardLayout";\n\nexport const boardLayout: BoardNode[] = [\n${body}\n];\n`;
}

function clampLayoutCoord(value: number): number {
  return Math.round(Math.max(2, Math.min(98, value)) * 10) / 10;
}

export function updateBoardNodePosition(nodeId: string, x: number, y: number) {
  const node = boardLayout.find((n) => n.id === nodeId);
  if (!node) return;
  node.x = clampLayoutCoord(x);
  node.y = clampLayoutCoord(y);
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

/** Move several tiles in one notify/persist (multi-select drag). */
export function updateBoardNodePositions(
  updates: { id: string; x: number; y: number }[]
) {
  let changed = false;
  for (const update of updates) {
    const node = boardLayout.find((n) => n.id === update.id);
    if (!node) continue;
    node.x = clampLayoutCoord(update.x);
    node.y = clampLayoutCoord(update.y);
    changed = true;
  }
  if (!changed) return;
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

export function setBoardNodeType(nodeId: string, type: TileType) {
  setBoardNodeTypes([nodeId], type);
}

export function setBoardNodeTypes(nodeIds: string[], type: TileType) {
  const idSet = new Set(nodeIds);
  let changed = false;
  for (const node of boardLayout) {
    if (!idSet.has(node.id) || node.type === type) continue;
    node.type = type;
    migrateBoardNode(node);
    if (type !== "button") {
      delete node.controlsEdge;
      delete node.controlsEdges;
      delete node.buttonLinks;
      delete node.buttonActions;
      delete node.buttonStartsOn;
      delete node.doorStartsOpen;
      delete node.controlsGate;
    }
    changed = true;
  }
  if (!changed) return;
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
    const buttonLinks = getButtonControlledLinks(node).filter(
      (link) => link.a !== nodeId && link.b !== nodeId
    );
    delete node.controlsEdge;
    delete node.controlsEdges;
    if (buttonLinks.length > 0) node.buttonLinks = buttonLinks;
    else delete node.buttonLinks;
    if (node.linkColors?.[nodeId]) {
      delete node.linkColors[nodeId];
      if (Object.keys(node.linkColors).length === 0) delete node.linkColors;
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
    const buttonLinks = getButtonControlledLinks(node).filter(
      (link) => !isSameUndirectedEdge(link, aId, bId)
    );
    delete node.controlsEdge;
    delete node.controlsEdges;
    if (buttonLinks.length > 0) node.buttonLinks = buttonLinks;
    else delete node.buttonLinks;
  }
  if (a?.linkColors) {
    delete a.linkColors[bId];
    if (Object.keys(a.linkColors).length === 0) delete a.linkColors;
  }
  if (b?.linkColors) {
    delete b.linkColors[aId];
    if (Object.keys(b.linkColors).length === 0) delete b.linkColors;
  }
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

/**
 * Bind a button tile to an undirected link (adds to the multi-link list).
 * Ensures a bidirectional `next` edge exists so the path is drawn and can be
 * toggled closed at runtime via ON/OFF state.
 */
export function assignButtonControlledLink(
  buttonId: string,
  aId: string,
  bId: string,
  opts?: { openWhenOn?: boolean; flipDirection?: boolean }
): { ok: boolean; warning?: string } {
  if (aId === bId) return { ok: false, warning: "Pick two different tiles." };
  const button = boardLayout.find((n) => n.id === buttonId);
  if (!button || button.type !== "button") {
    return { ok: false, warning: "Select a button tile first." };
  }
  const a = boardLayout.find((n) => n.id === aId);
  const b = boardLayout.find((n) => n.id === bId);
  if (!a || !b) return { ok: false, warning: "Both tiles must exist." };

  if (!a.next.includes(bId)) a.next.push(bId);
  if (!b.next.includes(aId)) b.next.push(aId);

  migrateBoardNode(button);
  const nextLinks = getButtonControlledLinks(button);
  const normalized = normalizeControlledEdge(aId, bId);
  const existing = nextLinks.find((link) =>
    isSameUndirectedEdge(link, normalized.a, normalized.b)
  );
  if (existing) {
    if (opts?.openWhenOn === false) existing.openWhenOn = false;
    if (opts?.flipDirection) existing.flipDirection = true;
  } else {
    nextLinks.push({
      ...normalized,
      ...(opts?.openWhenOn === false ? { openWhenOn: false } : {}),
      ...(opts?.flipDirection ? { flipDirection: true } : {}),
    });
  }
  button.buttonLinks = nextLinks;
  if (!button.buttonActions) button.buttonActions = {};
  button.buttonActions.toggleLinks = true;
  delete button.controlsEdge;
  delete button.controlsEdges;
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();

  let warning: string | undefined;
  if (wouldClosingButtonDisconnectBoard(buttonId)) {
    warning =
      "Turning this button OFF may disconnect the board from START — keep an alternate route.";
  }
  return { ok: true, warning };
}

/** @deprecated Prefer assignButtonControlledLink. */
export function assignDoorControlledEdge(
  doorId: string,
  aId: string,
  bId: string
): { ok: boolean; warning?: string } {
  return assignButtonControlledLink(doorId, aId, bId);
}

export function removeButtonControlledLink(
  buttonId: string,
  aId: string,
  bId: string
) {
  const button = boardLayout.find((n) => n.id === buttonId);
  if (!button || button.type !== "button") return;
  const next = getButtonControlledLinks(button).filter(
    (link) => !isSameUndirectedEdge(link, aId, bId)
  );
  delete button.controlsEdge;
  delete button.controlsEdges;
  if (next.length > 0) button.buttonLinks = next;
  else delete button.buttonLinks;
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

/** @deprecated Prefer removeButtonControlledLink. */
export function removeDoorControlledEdge(
  doorId: string,
  aId: string,
  bId: string
) {
  removeButtonControlledLink(doorId, aId, bId);
}

export function clearButtonControlledLinks(buttonId: string) {
  const button = boardLayout.find((n) => n.id === buttonId);
  if (!button || button.type !== "button") return;
  delete button.controlsEdge;
  delete button.controlsEdges;
  delete button.buttonLinks;
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

/** @deprecated Prefer clearButtonControlledLinks. */
export function clearDoorControlledEdge(doorId: string) {
  clearButtonControlledLinks(doorId);
}

/** @deprecated Prefer clearButtonControlledLinks. */
export function clearDoorControlledEdges(doorId: string) {
  clearButtonControlledLinks(doorId);
}

export function setButtonLinkOpenWhenOn(
  buttonId: string,
  aId: string,
  bId: string,
  openWhenOn: boolean
) {
  const button = boardLayout.find((n) => n.id === buttonId);
  if (!button || button.type !== "button") return;
  const links = getButtonControlledLinks(button);
  const link = links.find((l) => isSameUndirectedEdge(l, aId, bId));
  if (!link) return;
  if (openWhenOn) delete link.openWhenOn;
  else link.openWhenOn = false;
  button.buttonLinks = links;
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

export function setButtonLinkFlipDirection(
  buttonId: string,
  aId: string,
  bId: string,
  flipDirection: boolean
) {
  const button = boardLayout.find((n) => n.id === buttonId);
  if (!button || button.type !== "button") return;
  const links = getButtonControlledLinks(button);
  const link = links.find((l) => isSameUndirectedEdge(l, aId, bId));
  if (!link) return;
  if (flipDirection) link.flipDirection = true;
  else delete link.flipDirection;
  button.buttonLinks = links;
  if (flipDirection) {
    if (!button.buttonActions) button.buttonActions = {};
    button.buttonActions.flipDirections = true;
  }
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

export function setButtonActions(
  buttonId: string,
  actions: ButtonActions
) {
  const button = boardLayout.find((n) => n.id === buttonId);
  if (!button || button.type !== "button") return;
  const next: ButtonActions = {};
  if (actions.toggleLinks) next.toggleLinks = true;
  if (actions.flipDirections) next.flipDirections = true;
  if (actions.toggleGate) next.toggleGate = true;
  if (Object.keys(next).length > 0) button.buttonActions = next;
  else delete button.buttonActions;
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

export function setButtonStartsOn(buttonId: string, startsOn: boolean) {
  const button = boardLayout.find((n) => n.id === buttonId);
  if (!button || button.type !== "button") return;
  if (startsOn) delete button.buttonStartsOn;
  else button.buttonStartsOn = false;
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

/** @deprecated Prefer setButtonStartsOn. */
export function setDoorStartsOpen(doorId: string, startsOpen: boolean) {
  setButtonStartsOn(doorId, startsOpen);
}

/** Apply direction flips configured on a button's controlled links. */
export function applyButtonDirectionFlips(buttonId: string) {
  const links = getButtonControlledLinks(buttonId).filter((l) => l.flipDirection);
  for (const link of links) {
    cycleEdgeDirection(link.a, link.b);
  }
}

/** Resolve stroke color for an undirected road (either endpoint may store it). */
export function getEdgeColor(
  aId: string,
  bId: string,
  nodes: BoardNode[] = boardLayout
): string | null {
  const aNode = nodes.find((n) => n.id === aId);
  const bNode = nodes.find((n) => n.id === bId);
  return aNode?.linkColors?.[bId] ?? bNode?.linkColors?.[aId] ?? null;
}

export function setEdgeColor(aId: string, bId: string, color: string | null) {
  if (aId === bId) return;
  const aNode = boardLayout.find((n) => n.id === aId);
  const bNode = boardLayout.find((n) => n.id === bId);
  if (!aNode || !bNode) return;
  if (!aNode.linkColors) aNode.linkColors = {};
  if (color) {
    aNode.linkColors[bId] = color;
    if (bNode.linkColors) {
      delete bNode.linkColors[aId];
      if (Object.keys(bNode.linkColors).length === 0) delete bNode.linkColors;
    }
  } else {
    delete aNode.linkColors[bId];
    if (bNode.linkColors) {
      delete bNode.linkColors[aId];
      if (Object.keys(bNode.linkColors).length === 0) delete bNode.linkColors;
    }
  }
  if (Object.keys(aNode.linkColors).length === 0) delete aNode.linkColors;
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

function hasNextEdge(fromId: string, toId: string): boolean {
  const from = boardLayout.find((n) => n.id === fromId);
  return Boolean(from?.next.includes(toId));
}

function hasGateEdgeBetween(aId: string, bId: string): boolean {
  const aNode = boardLayout.find((n) => n.id === aId);
  const bNode = boardLayout.find((n) => n.id === bId);
  return Boolean(
    aNode?.gateEdges?.some((e) => e.to === bId) ||
      bNode?.gateEdges?.some((e) => e.to === aId)
  );
}

export function getEdgeDirectionMode(
  aId: string,
  bId: string
): EdgeDirectionMode {
  const aToB = hasNextEdge(aId, bId);
  const bToA = hasNextEdge(bId, aId);
  if (aToB && bToA) return "both";
  if (aToB) return "a-to-b";
  if (bToA) return "b-to-a";
  return "none";
}

/** List directed `next` hops (excludes gateEdges — those stay gate-owned). */
export function listDirectedNextEdges(
  nodes: BoardNode[] = boardLayout
): { from: string; to: string }[] {
  const edges: { from: string; to: string }[] = [];
  for (const node of nodes) {
    for (const to of node.next) {
      edges.push({ from: node.id, to });
    }
  }
  return edges;
}

function applyEdgeDirectionMode(
  aId: string,
  bId: string,
  mode: EdgeDirectionMode
) {
  if (hasGateEdgeBetween(aId, bId)) return;
  const aNode = boardLayout.find((n) => n.id === aId);
  const bNode = boardLayout.find((n) => n.id === bId);
  if (!aNode || !bNode) return;
  aNode.next = aNode.next.filter((id) => id !== bId);
  bNode.next = bNode.next.filter((id) => id !== aId);
  if (mode === "a-to-b" || mode === "both") aNode.next.push(bId);
  if (mode === "b-to-a" || mode === "both") bNode.next.push(aId);
}

/**
 * Cycle link among pair: a→b → b→a → both → a→b.
 * Gate edges between the pair are left alone.
 */
export function cycleEdgeDirection(aId: string, bId: string): EdgeDirectionMode {
  if (aId === bId || hasGateEdgeBetween(aId, bId)) {
    return getEdgeDirectionMode(aId, bId);
  }
  const mode = getEdgeDirectionMode(aId, bId);
  let nextMode: EdgeDirectionMode;
  if (mode === "a-to-b") nextMode = "b-to-a";
  else if (mode === "b-to-a") nextMode = "both";
  else if (mode === "both") nextMode = "a-to-b";
  else nextMode = "a-to-b";
  applyEdgeDirectionMode(aId, bId, nextMode);
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
  return nextMode;
}

/** Reverse all directed `next` edges that stay inside the selection. */
export function flipDirectionsAmongSelection(nodeIds: string[]) {
  const idSet = new Set(nodeIds);
  if (idSet.size < 2) return;
  const pairs: { a: string; b: string }[] = [];
  const seen = new Set<string>();
  for (const node of boardLayout) {
    if (!idSet.has(node.id)) continue;
    for (const to of node.next) {
      if (!idSet.has(to)) continue;
      const key = undirectedEdgeKey(node.id, to);
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ a: node.id, b: to });
    }
  }
  for (const { a: aId, b: bId } of pairs) {
    if (hasGateEdgeBetween(aId, bId)) continue;
    const mode = getEdgeDirectionMode(aId, bId);
    if (mode === "a-to-b") applyEdgeDirectionMode(aId, bId, "b-to-a");
    else if (mode === "b-to-a") applyEdgeDirectionMode(aId, bId, "a-to-b");
    // both stays both (symmetric)
  }
  persistBoardLayoutToStorage();
  notifyBoardLayoutListeners();
}

/** Cycle direction of every undirected pair among the selection. */
export function cycleDirectionsAmongSelection(nodeIds: string[]) {
  const idSet = new Set(nodeIds);
  if (idSet.size < 2) return;
  const pairs: { a: string; b: string }[] = [];
  const seen = new Set<string>();
  for (const node of boardLayout) {
    if (!idSet.has(node.id)) continue;
    for (const to of [
      ...node.next,
      ...(node.gateEdges ?? []).map((e) => e.to),
    ]) {
      if (!idSet.has(to)) continue;
      const key = undirectedEdgeKey(node.id, to);
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ a: node.id, b: to });
    }
  }
  for (const pair of pairs) {
    if (hasGateEdgeBetween(pair.a, pair.b)) continue;
    const mode = getEdgeDirectionMode(pair.a, pair.b);
    let nextMode: EdgeDirectionMode;
    if (mode === "a-to-b") nextMode = "b-to-a";
    else if (mode === "b-to-a") nextMode = "both";
    else if (mode === "both") nextMode = "a-to-b";
    else nextMode = "a-to-b";
    applyEdgeDirectionMode(pair.a, pair.b, nextMode);
  }
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
  if (type === "door") return "button";
  if (KNOWN_TILE_TYPES.has(type)) return type as TileType;
  return "normal";
}

export function movePlayerBySteps(
  startNodeId: string,
  steps: number,
  preferredPath?: string[],
  states: GateStates = DEFAULT_GATE_STATES,
  doorStates: ButtonStates = {}
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
  doorStates: ButtonStates = {}
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
  return [
    { id: "kingdom", label: "Kingdom Facility" },
    { id: "start", label: "Start" },
    ...shops.slice(0, 2).map((id) => ({ id, label: "Shop" })),
    ...portals.slice(0, 2).map((id) => ({ id, label: "Portal" })),
    ...buttons.slice(0, 4).map((id) => ({ id, label: "Button" })),
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
