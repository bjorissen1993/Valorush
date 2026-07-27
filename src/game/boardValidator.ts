import {
  boardLayout,
  getNodeExits,
  listPhysicalEdges,
  type BoardNode,
  type MidRoadMode,
} from "./boardLayout";

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
  modeReports: Record<MidRoadMode, { reachable: number; deadEnds: number }>;
};

function collectModeExits(
  nodes: BoardNode[],
  mode: MidRoadMode
): Map<string, string[]> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const exits = new Map<string, string[]>();
  for (const node of nodes) {
    // Prefer layout helper when validating the live board; fall back for custom graphs.
    if (nodes === boardLayout) {
      exits.set(node.id, getNodeExits(node.id, mode));
    } else {
      const list = [...node.next];
      for (const edge of node.midEdges ?? []) {
        const verticalIn =
          mode === "vertical_in" &&
          ((edge.axis === "vertical" && edge.dir === "in") ||
            (edge.axis === "horizontal" && edge.dir === "out"));
        const horizontalIn =
          mode === "horizontal_in" &&
          ((edge.axis === "horizontal" && edge.dir === "in") ||
            (edge.axis === "vertical" && edge.dir === "out"));
        if (verticalIn || horizontalIn) list.push(edge.to);
      }
      exits.set(node.id, list);
    }
    // Ensure referenced targets exist in byId for missing checks below
    void byId;
  }
  return exits;
}

function buildInboundMap(
  nodes: BoardNode[],
  modeExits: Map<string, string[]>
): Map<string, string[]> {
  const inbound = new Map<string, string[]>();
  for (const node of nodes) {
    if (!inbound.has(node.id)) inbound.set(node.id, []);
    for (const next of modeExits.get(node.id) ?? []) {
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

function collectPhysicalSegments(nodes: BoardNode[]): Seg[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const physical =
    nodes === boardLayout
      ? listPhysicalEdges(nodes)
      : (() => {
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
        })();

  const segs: Seg[] = [];
  for (const { from, to } of physical) {
    const a = byId.get(from);
    const b = byId.get(to);
    if (!a || !b) continue;
    segs.push({
      fromId: from,
      toId: to,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
    });
  }
  return segs;
}

function validateModeReachability(
  nodes: BoardNode[],
  byId: Map<string, BoardNode>,
  mode: MidRoadMode,
  issues: BoardGraphIssue[]
): { reachable: number; deadEnds: number } {
  const modeExits = collectModeExits(nodes, mode);
  let deadEnds = 0;

  for (const node of nodes) {
    const exits = modeExits.get(node.id) ?? [];
    if (exits.length === 0) {
      deadEnds += 1;
      issues.push({
        code: "empty_next",
        message: `Dead end in mode ${mode} (no exits): ${node.id}`,
        nodeId: node.id,
      });
      issues.push({
        code: "dead_end",
        message: `Node ${node.id} has no exits under ${mode}`,
        nodeId: node.id,
      });
    }
    for (const nextId of exits) {
      if (!byId.has(nextId)) {
        issues.push({
          code: "missing_next",
          message: `Node ${node.id} points to missing id "${nextId}" (${mode})`,
          nodeId: node.id,
        });
      }
    }
    if (exits.length === 1 && exits[0] === node.id) {
      issues.push({
        code: "self_loop_only",
        message: `Node ${node.id} only loops to itself (${mode})`,
        nodeId: node.id,
      });
    }
  }

  const start = byId.get("start");
  const reachable = new Set<string>();
  if (!start) {
    issues.push({
      code: "unreachable",
      message: 'Missing required "start" node',
    });
  } else {
    const queue = ["start"];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const next of modeExits.get(id) ?? []) {
        if (!reachable.has(next)) queue.push(next);
      }
    }

    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        issues.push({
          code: "unreachable",
          message: `Unreachable from start under ${mode}: ${node.id}`,
          nodeId: node.id,
        });
      }
    }
  }

  const inbound = buildInboundMap(nodes, modeExits);
  for (const node of nodes) {
    if (node.id === "start") continue;
    if (!reachable.has(node.id)) continue;
    const from = inbound.get(node.id) ?? [];
    if (from.length === 0) {
      issues.push({
        code: "orphan_inbound",
        message: `No inbound edges to ${node.id} under ${mode}`,
        nodeId: node.id,
      });
    }
  }

  return { reachable: reachable.size, deadEnds };
}

/**
 * Validate board connectivity for both mid-road modes + planar visual edges.
 * Dynamic mid-road edges must leave every tile with an exit in each mode,
 * and both modes must reach the full board from START.
 */
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

  // Static reference integrity for always-on + mid edges
  for (const node of nodes) {
    for (const nextId of node.next) {
      if (!byId.has(nextId)) {
        issues.push({
          code: "missing_next",
          message: `Node ${node.id} points to missing id "${nextId}"`,
          nodeId: node.id,
        });
      }
    }
    for (const edge of node.midEdges ?? []) {
      if (!byId.has(edge.to)) {
        issues.push({
          code: "missing_next",
          message: `Node ${node.id} midEdge points to missing id "${edge.to}"`,
          nodeId: node.id,
        });
      }
    }
  }

  const modeReports = {
    vertical_in: validateModeReachability(
      nodes,
      byId,
      "vertical_in",
      issues
    ),
    horizontal_in: validateModeReachability(
      nodes,
      byId,
      "horizontal_in",
      issues
    ),
  };

  const segs = collectPhysicalSegments(nodes);
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

  const branchCount = nodes.filter((n) => {
    const a = getNodeExits(n.id, "vertical_in").length;
    const b = getNodeExits(n.id, "horizontal_in").length;
    return a > 1 || b > 1;
  }).length;

  return {
    ok: issues.length === 0,
    nodeCount: nodes.length,
    branchCount,
    issues,
    modeReports,
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
      `[board] Graph OK — ${report.nodeCount} tiles, ${report.branchCount} branches ` +
        `(modes: V=${report.modeReports.vertical_in.reachable} H=${report.modeReports.horizontal_in.reachable})`
    );
  }
}
