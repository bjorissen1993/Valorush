import {
  ULTIMATE_BOARD_PATHS,
  defaultCastDurationMs,
  themeForUltimateId,
  type UltimateApplyResult,
  type UltimateCastCue,
  type UltimateDefinition,
} from "../../../shared/ultimates";
import {
  boardDistance,
  getAdjacentNodeIds,
} from "./boardHelpers";

export type CastCueBuildInput = {
  def: UltimateDefinition;
  casterPlayerIndex: number;
  casterName: string;
  casterPosition: string;
  selection: {
    targetPlayerIndex?: number;
    targetNodeId?: string;
    targetNodeId2?: string;
    stealFromPlayerIndex?: number;
    choiceId?: string;
  };
  result: UltimateApplyResult;
  playerPositions: string[];
  rangeTiles?: number;
};

/** Build a presentation cue after a successful ultimate apply. */
export function buildUltimateCastCue(input: CastCueBuildInput): UltimateCastCue {
  const theme = themeForUltimateId(input.def.id);
  const highlightNodeIds = new Set<string>();
  const highlightPlayerIndices = new Set<number>();

  const addNode = (id?: string | null) => {
    if (id) highlightNodeIds.add(id);
  };
  const addPlayer = (index?: number | null) => {
    if (index != null && index >= 0) highlightPlayerIndices.add(index);
  };

  addPlayer(input.casterPlayerIndex);

  switch (input.def.id) {
    case "orbital-strike": {
      const center = input.selection.targetNodeId;
      addNode(center);
      if (center) {
        for (const adj of getAdjacentNodeIds(center)) addNode(adj);
      }
      break;
    }
    case "vipers-pit":
    case "steel-garden":
      addNode(input.selection.targetNodeId);
      break;
    case "from-the-shadows":
      addNode(input.casterPosition);
      addNode(input.selection.targetNodeId);
      addNode(input.selection.targetNodeId2);
      break;
    case "lockdown":
    case "rolling-thunder":
    case "nightfall":
    case "seekers":
      for (let i = 0; i < input.playerPositions.length; i += 1) {
        if (i !== input.casterPlayerIndex) addPlayer(i);
      }
      break;
    case "neural-theft":
      addPlayer(input.selection.stealFromPlayerIndex ?? input.selection.targetPlayerIndex);
      break;
    case "hunters-fury": {
      const pathKey =
        input.selection.choiceId ?? input.selection.targetNodeId;
      const path =
        ULTIMATE_BOARD_PATHS.find((p) => p.id === pathKey) ??
        ULTIMATE_BOARD_PATHS.find((p) =>
          pathKey ? p.nodeIds.includes(pathKey) : false
        );
      for (const nodeId of path?.nodeIds ?? []) {
        addNode(nodeId);
      }
      break;
    }
    case "showstopper":
    case "tour-de-force":
      addPlayer(input.selection.targetPlayerIndex);
      if (input.selection.targetPlayerIndex != null) {
        addNode(input.playerPositions[input.selection.targetPlayerIndex]);
      }
      break;
    case "cosmic-divide-ult":
      addNode(input.selection.targetNodeId);
      addNode(input.selection.targetNodeId2);
      break;
    case "null-cmd": {
      const range = input.rangeTiles ?? input.def.rangeTiles ?? 3;
      for (let i = 0; i < input.playerPositions.length; i += 1) {
        if (i === input.casterPlayerIndex) continue;
        const pos = input.playerPositions[i];
        if (!pos) continue;
        if (boardDistance(input.casterPosition, pos) <= range) {
          addPlayer(i);
          addNode(pos);
        }
      }
      addNode(input.casterPosition);
      break;
    }
    case "resurrection":
    case "run-it-back":
    case "blade-storm":
    case "empress":
    case "dimensional-drift":
    case "overdrive":
    case "not-dead-yet":
      addNode(input.casterPosition);
      break;
    default:
      addNode(input.selection.targetNodeId);
      addPlayer(input.selection.targetPlayerIndex);
      break;
  }

  for (const change of input.result.positionChanges) {
    addPlayer(change.playerIndex);
    addNode(change.fromNodeId);
    addNode(change.toNodeId);
  }

  return {
    id: `ult-cast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agentName: input.def.agentName,
    ultimateId: input.def.id,
    ultimateName: input.def.name,
    casterPlayerIndex: input.casterPlayerIndex,
    casterName: input.casterName,
    theme,
    highlightNodeIds: [...highlightNodeIds],
    highlightPlayerIndices: [...highlightPlayerIndices],
    durationMs: defaultCastDurationMs(theme),
  };
}
