import {
  boardLayout,
  getNodeById,
  isStartOneWayTile,
} from "../boardLayout";
import type { BoardUltimateState } from "../../../shared/ultimates";

/** Build undirected adjacency from the directed board graph (incl. mid roads).
 * START one-way spur is forward-only — never create reverse edges onto it.
 */
export function buildBoardAdjacency(): Record<string, string[]> {
  const adj: Record<string, Set<string>> = {};
  const ensure = (id: string) => {
    if (!adj[id]) adj[id] = new Set();
    return adj[id]!;
  };
  for (const node of boardLayout) {
    ensure(node.id);
    for (const next of node.next) {
      ensure(next).add(node.id);
      ensure(node.id).add(next);
      // Drop reverse onto the START corridor so ultimates can't pull players back.
      if (isStartOneWayTile(next)) {
        adj[next]!.delete(node.id);
      }
      if (isStartOneWayTile(node.id)) {
        adj[next]!.delete(node.id);
      }
    }
    for (const edge of node.gateEdges ?? []) {
      ensure(node.id).add(edge.to);
      ensure(edge.to).add(node.id);
    }
  }
  // Keep corridor tiles reachable forward for distance checks from START itself,
  // but strip any inbound from the playable board.
  for (const id of Object.keys(adj)) {
    if (isStartOneWayTile(id)) continue;
    for (const oneWay of [...(adj[id] ?? [])]) {
      if (isStartOneWayTile(oneWay)) adj[id]!.delete(oneWay);
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
          !isStartOneWayTile(node.id) &&
          (node.next.includes(current) ||
            (node.gateEdges ?? []).some((e) => e.to === current))
      )
      .map((node) => node.id);
    if (prevs.length === 0) break;
    // Prefer outer / non-facility when multiple inbound.
    const preferred =
      prevs.find((id) => id !== "kingdom" && !id.startsWith("btn")) ??
      prevs[0]!;
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

/** All tile ids within `range` hops of origin (inclusive), undirected graph. */
export function tilesWithinHopRange(
  originId: string,
  range: number
): string[] {
  if (range < 0) return [];
  const adj = buildBoardAdjacency();
  if (!adj[originId] && !boardLayout.some((n) => n.id === originId)) return [];
  const result: string[] = [];
  const queue: { id: string; dist: number }[] = [{ id: originId, dist: 0 }];
  const seen = new Set<string>([originId]);
  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    result.push(id);
    if (dist >= range) continue;
    for (const next of adj[id] ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push({ id: next, dist: dist + 1 });
    }
  }
  return result;
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
  // START corridor is exit-only — never treat it as a pull destination.
  if (isStartOneWayTile(destinationId)) return startNodeId;
  const adj = buildBoardAdjacency();
  // Build parent map from destination BFS so we walk the shortest path.
  const parent = new Map<string, string | null>();
  parent.set(destinationId, null);
  const queue = [destinationId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const next of adj[id] ?? []) {
      if (parent.has(next)) continue;
      if (isStartOneWayTile(next)) continue;
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
      ...(node.gateEdges ?? []).map((e) => e.to),
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
