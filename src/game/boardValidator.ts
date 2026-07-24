import { boardLayout, type BoardNode } from "./boardLayout";

export type BoardGraphIssue = {
  code:
    | "duplicate_id"
    | "missing_next"
    | "unreachable"
    | "dead_end"
    | "orphan_inbound"
    | "empty_next"
    | "self_loop_only"
    | "visual_crossing";
  message: string;
  nodeId?: string;
};

export type BoardGraphReport = {
  ok: boolean;
  nodeCount: number;
  branchCount: number;
  issues: BoardGraphIssue[];
};

function buildInboundMap(nodes: BoardNode[]): Map<string, string[]> {
  const inbound = new Map<string, string[]>();
  for (const node of nodes) {
    if (!inbound.has(node.id)) inbound.set(node.id, []);
    for (const next of node.next) {
      const list = inbound.get(next) ?? [];
      list.push(node.id);
      inbound.set(next, list);
    }
  }
  return inbound;
}

type Seg = {
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function orient(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): number {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(v) < 1e-9) return 0;
  return v > 0 ? 1 : 2;
}

function onSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): boolean {
  return (
    bx <= Math.max(ax, cx) + 1e-9 &&
    bx >= Math.min(ax, cx) - 1e-9 &&
    by <= Math.max(ay, cy) + 1e-9 &&
    by >= Math.min(ay, cy) - 1e-9
  );
}

/** Proper segment intersection (shared endpoints do not count). */
function segmentsCross(a: Seg, b: Seg): boolean {
  const endpoints = new Set([a.fromId, a.toId, b.fromId, b.toId]);
  if (endpoints.size < 4) return false;

  const o1 = orient(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const o2 = orient(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const o3 = orient(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const o4 = orient(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(a.x1, a.y1, b.x1, b.y1, a.x2, a.y2)) return true;
  if (o2 === 0 && onSegment(a.x1, a.y1, b.x2, b.y2, a.x2, a.y2)) return true;
  if (o3 === 0 && onSegment(b.x1, b.y1, a.x1, a.y1, b.x2, b.y2)) return true;
  if (o4 === 0 && onSegment(b.x1, b.y1, a.x2, a.y2, b.x2, b.y2)) return true;

  return false;
}

function collectDirectedEdges(nodes: BoardNode[]): Seg[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const segs: Seg[] = [];
  for (const node of nodes) {
    for (const nextId of node.next) {
      const next = byId.get(nextId);
      if (!next) continue;
      segs.push({
        fromId: node.id,
        toId: nextId,
        x1: node.x,
        y1: node.y,
        x2: next.x,
        y2: next.y,
      });
    }
  }
  return segs;
}

/** Validate board connectivity + planar (non-crossing) visual edges. */
export function validateBoardGraph(
  nodes: BoardNode[] = boardLayout
): BoardGraphReport {
  const issues: BoardGraphIssue[] = [];
  const byId = new Map<string, BoardNode>();

  for (const node of nodes) {
    if (byId.has(node.id)) {
      issues.push({
        code: "duplicate_id",
        message: `Duplicate node id: ${node.id}`,
        nodeId: node.id,
      });
    }
    byId.set(node.id, node);
  }

  for (const node of nodes) {
    if (node.next.length === 0) {
      issues.push({
        code: "empty_next",
        message: `Dead end (no exits): ${node.id}`,
        nodeId: node.id,
      });
      issues.push({
        code: "dead_end",
        message: `Node ${node.id} has no next tiles`,
        nodeId: node.id,
      });
    }

    for (const nextId of node.next) {
      if (!byId.has(nextId)) {
        issues.push({
          code: "missing_next",
          message: `Node ${node.id} points to missing id "${nextId}"`,
          nodeId: node.id,
        });
      }
    }

    if (node.next.length === 1 && node.next[0] === node.id) {
      issues.push({
        code: "self_loop_only",
        message: `Node ${node.id} only loops to itself`,
        nodeId: node.id,
      });
    }
  }

  const start = byId.get("start");
  if (!start) {
    issues.push({
      code: "unreachable",
      message: 'Missing required "start" node',
    });
  } else {
    const reachable = new Set<string>();
    const queue = ["start"];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      const node = byId.get(id);
      if (!node) continue;
      for (const next of node.next) {
        if (!reachable.has(next)) queue.push(next);
      }
    }

    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        issues.push({
          code: "unreachable",
          message: `Unreachable from start: ${node.id}`,
          nodeId: node.id,
        });
      }
    }
  }

  const inbound = buildInboundMap(nodes);
  for (const node of nodes) {
    if (node.id === "start") continue;
    const from = inbound.get(node.id) ?? [];
    if (from.length === 0) {
      issues.push({
        code: "orphan_inbound",
        message: `No inbound edges to ${node.id}`,
        nodeId: node.id,
      });
    }
  }

  const segs = collectDirectedEdges(nodes);
  for (let i = 0; i < segs.length; i += 1) {
    for (let j = i + 1; j < segs.length; j += 1) {
      const a = segs[i]!;
      const b = segs[j]!;
      if (segmentsCross(a, b)) {
        issues.push({
          code: "visual_crossing",
          message: `Roads cross visually: ${a.fromId}→${a.toId} × ${b.fromId}→${b.toId}`,
          nodeId: a.fromId,
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    nodeCount: nodes.length,
    branchCount: nodes.filter((n) => n.next.length > 1).length,
    issues,
  };
}

/** Log validation in development builds. */
export function assertBoardGraphValidInDev(): void {
  if (!import.meta.env.DEV) return;
  const report = validateBoardGraph();
  if (!report.ok) {
    console.error(
      `[board] Graph validation failed (${report.issues.length} issues)`,
      report.issues
    );
  } else {
    console.info(
      `[board] Graph OK — ${report.nodeCount} tiles, ${report.branchCount} branches`
    );
  }
}
