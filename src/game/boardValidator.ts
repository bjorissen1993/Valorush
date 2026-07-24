import { boardLayout, type BoardNode } from "./boardLayout";

export type BoardGraphIssue = {
  code:
    | "duplicate_id"
    | "missing_next"
    | "unreachable"
    | "dead_end"
    | "orphan_inbound"
    | "empty_next"
    | "self_loop_only";
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

/** Validate board connectivity. Safe to call in production; intended for dev/debug. */
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

    if (
      node.next.length === 1 &&
      node.next[0] === node.id
    ) {
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
