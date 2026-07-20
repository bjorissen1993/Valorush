import type {
  UltimatePathOption,
  UltimateTargetKind,
} from "../../../shared/ultimates";
import { ULTIMATE_BOARD_PATHS } from "../../../shared/ultimates";
import { getBoardNodeIds } from "../boardEventBridge";
import { listConnectedEdges } from "./boardHelpers";

/** Target kinds resolved by clicking the board (not a choice modal). */
export const BOARD_TARGET_KINDS: ReadonlySet<UltimateTargetKind> = new Set([
  "tile",
  "tile_and_move",
  "player",
  "player_or_choice",
  "path",
  "edge",
]);

export function usesBoardTargeting(kind: UltimateTargetKind): boolean {
  return BOARD_TARGET_KINDS.has(kind);
}

export function getUltimateTargetingPrompt(
  ultimateName: string,
  kind: UltimateTargetKind
): string {
  switch (kind) {
    case "tile":
    case "tile_and_move":
      return `Select a tile for ${ultimateName}`;
    case "player":
    case "player_or_choice":
      return `Select a player for ${ultimateName}`;
    case "path":
      return `Select a path for ${ultimateName}`;
    case "edge":
      return `Select a path connection for ${ultimateName}`;
    default:
      return `Select a target for ${ultimateName}`;
  }
}

export function getUltimateTargetingSubtitle(
  kind: UltimateTargetKind
): string {
  switch (kind) {
    case "tile":
    case "tile_and_move":
      return "Click a highlighted tile on the board";
    case "player":
    case "player_or_choice":
      return "Click an opponent's token on the board";
    case "path":
      return "Click any tile on the path you want to fire along";
    case "edge":
      return "Click a highlighted connection between two tiles";
    default:
      return "Click a valid target on the board";
  }
}

export function getSelectableTileIdsForUltimate(
  kind: UltimateTargetKind,
  options?: {
    opponentPositions?: string[];
    paths?: UltimatePathOption[];
  }
): string[] {
  const paths = options?.paths ?? ULTIMATE_BOARD_PATHS;
  if (kind === "tile" || kind === "tile_and_move") {
    return getBoardNodeIds();
  }
  if (kind === "path") {
    return [...new Set(paths.flatMap((path) => path.nodeIds))];
  }
  if (kind === "player" || kind === "player_or_choice") {
    return [...new Set(options?.opponentPositions ?? [])];
  }
  return [];
}

export function findPathContainingNode(
  nodeId: string,
  paths: UltimatePathOption[] = ULTIMATE_BOARD_PATHS
): UltimatePathOption | undefined {
  return paths.find((path) => path.nodeIds.includes(nodeId));
}

export function getSelectableEdgesForUltimate(kind: UltimateTargetKind) {
  if (kind !== "edge") return [];
  return listConnectedEdges().map((edge) => ({
    from: edge.from,
    to: edge.to,
  }));
}

export type UltimateBoardTargeting = {
  agentName: string;
  ultimateId: string;
  ultimateName: string;
  targetKind: UltimateTargetKind;
};
