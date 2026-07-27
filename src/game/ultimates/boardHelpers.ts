import { boardLayout, getNodeById } from "../boardLayout";
import type { BoardUltimateState } from "../../../shared/ultimates";

/** Build undirected adjacency from the directed board graph (incl. mid roads). */
export function buildBoardAdjacency(): Record<string, string[]> {
  const adj: Record<string, Set<string>> = {};
  for (const node of boardLayout) {
    if (!adj[node.id]) adj[node.id] = new Set();
    for (const next of node.next) {
      adj[node.id]!.add(next);
      if (!adj[next]) adj[next] = new Set();
      adj[next]!.add(node.id);
    }
    for (const edge of node.midEdges ?? []) {
      adj[node.id]!.add(edge.to);
      if (!adj[edge.to]) adj[edge.to] = new Set();
      adj[edge.to]!.add(node.id);
    }
  }
  const result: Record<string, string[]> = {};
  for (const [id, set] of Object.entries(adj)) {
    result[id] = [...set];
  }
  return result;
}

export function getAdjacentNodeIds(nodeId: string): string[] {
  return buildBoardAdjacency()[nodeId] ?? [];
}

/** Walk backward along inbound edges (prefer outer / first inbound). */
export function moveBackSpaces(startNodeId: string, steps: number): string {
  let current = startNodeId;
  for (let i = 0; i < steps; i += 1) {
    const prevs = boardLayout
      .filter(
        (node) =>
          node.next.includes(current) ||
          (node.midEdges ?? []).some((e) => e.to === current)
      )
      .map((node) => node.id);
    if (prevs.length === 0) break;
    // Prefer non-hub / non-door when multiple inbound.
    const preferred =
      prevs.find((id) => !id.startsWith("d") && id !== "hub") ?? prevs[0]!;
    current = preferred;
  }
  return current;
}

/** BFS distance between two nodes on the undirected graph. */
export function boardDistance(fromId: string, toId: string): number {
  if (fromId === toId) return 0;
  const adj = buildBoardAdjacency();
  const queue: { id: string; dist: number }[] = [{ id: fromId, dist: 0 }];
  const seen = new Set<string>([fromId]);
  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    for (const next of adj[id] ?? []) {
      if (seen.has(next)) continue;
      if (next === toId) return dist + 1;
      seen.add(next);
      queue.push({ id: next, dist: dist + 1 });
    }
  }
  return Number.POSITIVE_INFINITY;
}

export function isEdgeBlockedByWall(
  board: BoardUltimateState,
  fromNodeId: string,
  toNodeId: string
): boolean {
  return board.walls.some(
    (wall) =>
      wall.roundsLeft > 0 &&
      ((wall.fromNodeId === fromNodeId && wall.toNodeId === toNodeId) ||
        (wall.fromNodeId === toNodeId && wall.toNodeId === fromNodeId))
  );
}

export function getArmedTrapAt(
  board: BoardUltimateState,
  nodeId: string
): BoardUltimateState["traps"][number] | undefined {
  return board.traps.find((trap) => trap.armed && trap.nodeId === nodeId);
}

export function getArmedDetainAt(
  board: BoardUltimateState,
  nodeId: string
): BoardUltimateState["detainZones"][number] | undefined {
  return (board.detainZones ?? []).find(
    (zone) => zone.armed && zone.nodeId === nodeId
  );
}

export function isInPoisonCloud(
  board: BoardUltimateState,
  nodeId: string
): boolean {
  return board.poisonClouds.some((cloud) => {
    if (cloud.roundsLeft <= 0) return false;
    if (cloud.nodeIds && cloud.nodeIds.length > 0) {
      return cloud.nodeIds.includes(nodeId);
    }
    return cloud.nodeId === nodeId;
  });
}

/** Apply Viper movement debuff once per activationId when entering/standing in pit. */
export function applyViperPitDebuffOnce(
  player: {
    status: {
      movementPenalty: number;
      movementPenaltyTurns: number;
      appliedActivationIds: string[];
      inViperPit: boolean;
    };
  },
  board: BoardUltimateState,
  isOwner: boolean
): void {
  if (isOwner) return;
  for (const cloud of board.poisonClouds) {
    if (cloud.roundsLeft <= 0) continue;
    const inZone =
      cloud.nodeIds?.includes(
        // position checked by caller via inViperPit / isInPoisonCloud
        cloud.nodeId
      ) || cloud.nodeId;
    if (!player.status.inViperPit && !inZone) continue;
    if (player.status.appliedActivationIds.includes(cloud.activationId)) {
      continue;
    }
    const debuff = cloud.movementDebuff ?? 2;
    player.status.movementPenalty = Math.max(
      player.status.movementPenalty,
      debuff
    );
    player.status.movementPenaltyTurns = Math.max(
      player.status.movementPenaltyTurns,
      1
    );
    player.status.appliedActivationIds = [
      ...player.status.appliedActivationIds,
      cloud.activationId,
    ];
  }
}

/** BFS pull toward a destination, up to `steps` tiles. */
export function moveTowardNode(
  startNodeId: string,
  destinationId: string,
  steps: number
): string {
  if (startNodeId === destinationId || steps <= 0) return startNodeId;
  const adj = buildBoardAdjacency();
  // Build parent map from destination BFS so we walk the shortest path.
  const parent = new Map<string, string | null>();
  parent.set(destinationId, null);
  const queue = [destinationId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const next of adj[id] ?? []) {
      if (parent.has(next)) continue;
      parent.set(next, id);
      queue.push(next);
    }
  }
  if (!parent.has(startNodeId)) return startNodeId;
  let current = startNodeId;
  for (let i = 0; i < steps; i += 1) {
    const next = parent.get(current);
    if (!next) break;
    current = next;
    if (current === destinationId) break;
  }
  return current;
}

/** Collect up to `size` connected tiles starting at `seed` (BFS). */
export function collectConnectedZone(
  seed: string,
  size: number
): Set<string> {
  const zone = new Set<string>();
  const adj = buildBoardAdjacency();
  const queue = [seed];
  while (queue.length > 0 && zone.size < size) {
    const id = queue.shift()!;
    if (zone.has(id)) continue;
    zone.add(id);
    for (const next of adj[id] ?? []) {
      if (!zone.has(next)) queue.push(next);
    }
  }
  return zone;
}

/** Connected edges for Astra Cosmic Divide ultimate targeting. */
export function listConnectedEdges(): { from: string; to: string; label: string }[] {
  const edges: { from: string; to: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const node of boardLayout) {
    const targets = [
      ...node.next,
      ...(node.midEdges ?? []).map((e) => e.to),
    ];
    for (const next of targets) {
      const key = node.id < next ? `${node.id}|${next}` : `${next}|${node.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const nextNode = getNodeById(next);
      edges.push({
        from: node.id,
        to: next,
        label: `${formatNodeLabel(node.id)} → ${formatNodeLabel(nextNode?.id ?? next)}`,
      });
    }
  }
  return edges;
}

export function formatNodeLabel(nodeId: string): string {
  return nodeId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
