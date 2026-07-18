import { boardLayout, getNodeById } from "../boardLayout";
import type { BoardUltimateState } from "../../../shared/ultimates";

/** Build undirected adjacency from the directed board graph. */
export function buildBoardAdjacency(): Record<string, string[]> {
  const adj: Record<string, Set<string>> = {};
  for (const node of boardLayout) {
    if (!adj[node.id]) adj[node.id] = new Set();
    for (const next of node.next) {
      adj[node.id]!.add(next);
      if (!adj[next]) adj[next] = new Set();
      adj[next]!.add(node.id);
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
      .filter((node) => node.next.includes(current))
      .map((node) => node.id);
    if (prevs.length === 0) break;
    // Prefer non-inner when multiple inbound (merge tiles).
    const preferred =
      prevs.find((id) => !id.includes("inner")) ?? prevs[0]!;
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

export function isInPoisonCloud(
  board: BoardUltimateState,
  nodeId: string
): boolean {
  return board.poisonClouds.some(
    (cloud) => cloud.nodeId === nodeId && cloud.roundsLeft > 0
  );
}

/** Connected edges for Astra Cosmic Divide ultimate targeting. */
export function listConnectedEdges(): { from: string; to: string; label: string }[] {
  const edges: { from: string; to: string; label: string }[] = [];
  for (const node of boardLayout) {
    for (const next of node.next) {
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
