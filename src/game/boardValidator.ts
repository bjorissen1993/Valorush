import {
  boardLayout,
  GATE_IDS,
  getNodeExits,
  listPhysicalEdges,
  migrateGateStates,
  type BoardNode,
  type GateId,
  type GateStates,
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
  /** Reachability sampled across default + flipped single-gate variants. */
  modeReports: Record<string, { reachable: number; deadEnds: number }>;
};

function collectModeExits(
  nodes: BoardNode[],
  states: GateStates
): Map<string, string[]> {
  const exits = new Map<string, string[]>();
  for (const node of nodes) {
    if (nodes === boardLayout) {
      exits.set(node.id, getNodeExits(node.id, states));
    } else {
      const list = [...node.next];
      for (const edge of node.gateEdges ?? []) {
        if (states[edge.gateId] === edge.branch) list.push(edge.to);
      }
      exits.set(node.id, list);
    }
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
            for (const edge of node.gateEdges ?? []) add(node.id, edge.to);
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
  states: GateStates,
  label: string,
  issues: BoardGraphIssue[]
): { reachable: number; deadEnds: number } {
  const modeExits = collectModeExits(nodes, states);
  let deadEnds = 0;

  for (const node of nodes) {
    const exits = modeExits.get(node.id) ?? [];
    if (exits.length === 0) {
      deadEnds += 1;
      issues.push({
        code: "empty_next",
        message: `Dead end in ${label} (no exits): ${node.id}`,
        nodeId: node.id,
      });
      issues.push({
        code: "dead_end",
        message: `Node ${node.id} has no exits under ${label}`,
        nodeId: node.id,
      });
    }
    for (const nextId of exits) {
      if (!byId.has(nextId)) {
        issues.push({
          code: "missing_next",
          message: `Node ${node.id} points to missing id "${nextId}" (${label})`,
          nodeId: node.id,
        });
      }
    }
    if (exits.length === 1 && exits[0] === node.id) {
      issues.push({
        code: "self_loop_only",
        message: `Node ${node.id} only loops to itself (${label})`,
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
          message: `Unreachable from start under ${label}: ${node.id}`,
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
        message: `No inbound edges to ${node.id} under ${label}`,
        nodeId: node.id,
      });
    }
  }

  return { reachable: reachable.size, deadEnds };
}

/** Representative gate configurations to validate (all 32 is fine but verbose). */
function enumerateGateConfigs(): { label: string; states: GateStates }[] {
  const configs: { label: string; states: GateStates }[] = [
    { label: "default", states: migrateGateStates() },
    {
      label: "all_right",
      states: {
        g1: "right",
        g2: "right",
        g3: "right",
        g4: "right",
        g5: "right",
      },
    },
    {
      label: "all_left",
      states: {
        g1: "left",
        g2: "left",
        g3: "left",
        g4: "left",
        g5: "left",
      },
    },
  ];
  for (const id of GATE_IDS) {
    const flipped = migrateGateStates();
    flipped[id] = flipped[id] === "left" ? "right" : "left";
    configs.push({ label: `flip_${id}`, states: flipped });
  }
  // Legacy mid-road mapping
  configs.push({
    label: "legacy_horizontal_in",
    states: migrateGateStates(null, "horizontal_in" satisfies MidRoadMode),
  });
  return configs;
}

/**
 * Validate board connectivity across gate configurations + planar visual edges.
 * Gated branches must never create dead ends; every config reaches the full board.
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
    for (const edge of node.gateEdges ?? []) {
      if (!byId.has(edge.to)) {
        issues.push({
          code: "missing_next",
          message: `Node ${node.id} gateEdge points to missing id "${edge.to}"`,
          nodeId: node.id,
        });
      }
    }
  }

  const modeReports: BoardGraphReport["modeReports"] = {};
  for (const { label, states } of enumerateGateConfigs()) {
    modeReports[label] = validateModeReachability(
      nodes,
      byId,
      states,
      label,
      issues
    );
  }

  // Keep legacy keys so older tests / logs still read something sensible.
  modeReports.vertical_in = modeReports.default ?? {
    reachable: 0,
    deadEnds: 0,
  };
  modeReports.horizontal_in = modeReports.legacy_horizontal_in ?? {
    reachable: 0,
    deadEnds: 0,
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

  const defaultStates = migrateGateStates();
  const branchCount = nodes.filter((n) => {
    return getNodeExits(n.id, defaultStates).length > 1;
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
        `(default reachable=${report.modeReports.default?.reachable ?? 0})`
    );
  }
}

export type { GateId, GateStates };
