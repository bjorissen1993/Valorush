import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  boardLayout,
  DEFAULT_GATE_STATES,
  GATE_BRANCH_NODE_IDS,
  GATE_LABELS,
  getEdgeColor,
  getEdgeDirectionMode,
  getNodeById,
  isButtonOn,
  getButtonControlledLinks,
  listActiveGateEdges,
  listClosedDoorEdges,
  listClosedGateEdges,
  listPhysicalEdges,
  isButtonOn,
  type DoorStates,
  type GateStates,
  type TileType,
} from "../game/boardLayout";
import { getPlayerTokenPosition } from "../game/tokenLayout";
import type { PlayerInGame } from "../types/Game";
import type { AnimatedTokenState } from "./GamePage";
import {
  boardMapBackgroundPath,
  defuserIconPath,
  spikeIconPath,
} from "../game/assetPaths";

export const SPIKE_PLANT_ANIMATION_MS = 1400;

/** Circular tile diameter as % of the board viewBox (Mario Party spaces). */
const TILE_SIZE_PERCENT = 4.6;
const START_TILE_SIZE_PERCENT = 7.0;

export type BoardSelectableEdge = {
  from: string;
  to: string;
};

export type BoardTargetingBanner = {
  title: string;
  subtitle?: string;
  onCancel?: () => void;
};

export type BoardCastFx = {
  theme: string;
  nodeIds: string[];
  playerIndices: number[];
};

export type BoardHazardState = {
  poisonClouds: {
    nodeId: string;
    nodeIds?: string[];
    roundsLeft: number;
  }[];
  walls: { fromNodeId: string; toNodeId: string; roundsLeft: number }[];
  traps: { nodeId: string; armed: boolean }[];
  detainZones?: { nodeId: string; armed: boolean }[];
  killjoyDevices?: { centerNodeId: string; nodeIds: string[]; armed: boolean }[];
  slowZones?: { nodeId: string; roundsLeft: number }[];
};

export type BoardAreaPlacement = {
  radius: number;
  /** Optional max distance from owner tile (layout units). */
  placementRadius?: number;
  ownerNodeId?: string;
  /** Highlighted tile ids under the preview circle. */
  previewNodeIds?: string[];
};

export type BoardEditorInteraction = {
  enabled: boolean;
  /** Multi-select set (includes primary). */
  selectedNodeIds?: string[];
  /** @deprecated Prefer selectedNodeIds — kept as last/primary id. */
  selectedNodeId?: string | null;
  linkFromId?: string | null;
  selectedEdge?: { from: string; to: string } | null;
  /** Editor-only ultimate range glow. */
  highlightNodeIds?: string[];
  /** Select tool enables marquee + click toggle. */
  selectMode?: boolean;
  /** Move tool / drag repositions selection. */
  moveMode?: boolean;
  onSelectNode?: (
    nodeId: string | null,
    opts?: { shiftKey?: boolean }
  ) => void;
  onMarqueeSelect?: (
    nodeIds: string[],
    opts?: { additive?: boolean }
  ) => void;
  onMoveNode?: (nodeId: string, x: number, y: number) => void;
  onMoveNodes?: (
    updates: { id: string; x: number; y: number }[],
    originId: string
  ) => void;
  onBoardBackgroundClick?: (point: { x: number; y: number }) => void;
  onEditorEdgeClick?: (from: string, to: string) => void;
};

type Props = {
  players: PlayerInGame[];
  currentPlayerIndex: number;
  movingPlayerIndex: number | null;
  animatedToken: AnimatedTokenState;
  activeSpikeNodeId?: string | null;
  activeSpikeStatus?: "planted" | "half-defused" | null;
  round?: number;
  maxRounds?: number;
  highlightCurrentPlayer?: boolean;
  onTileClick?: (nodeId: string) => void;
  onEdgeClick?: (from: string, to: string) => void;
  onPlayerTokenClick?: (playerIndex: number) => void;
  /** Free-cursor area placement (layout-space point). */
  onAreaPlace?: (point: { x: number; y: number }) => void;
  onAreaCursorMove?: (point: { x: number; y: number } | null) => void;
  areaPlacement?: BoardAreaPlacement | null;
  debugClickable?: boolean;
  selectableNodeIds?: string[];
  selectableEdges?: BoardSelectableEdge[];
  selectablePlayerIndices?: number[];
  /** When true, non-selectable tiles are dimmed during targeting. */
  dimNonSelectable?: boolean;
  pathChoiceHint?: string | null;
  targetingBanner?: BoardTargetingBanner | null;
  spikePlantAnimation?: { fromNodeId: string; toNodeId: string } | null;
  onSpikePlantAnimationComplete?: () => void;
  /** Short-lived ultimate cast tile / token highlights. */
  castFx?: BoardCastFx | null;
  /** Persistent ultimate hazards (poison / walls / traps). */
  hazards?: BoardHazardState | null;
  /** Per-gate open branch states (shared game state). */
  gateStates?: GateStates;
  /** Per-door open/closed map (door tile id → open). */
  doorStates?: DoorStates;
  /** Button tile id that was just pressed (visual pulse). */
  pressedButtonId?: string | null;
  /** Bump when live boardLayout changes so paths/tiles refresh. */
  layoutEpoch?: number;
  /** Debug board-design mode (drag / link / add). */
  editor?: BoardEditorInteraction | null;
};

const LAYOUT_MIN_X = 2;
const LAYOUT_MAX_X = 99;
const LAYOUT_MIN_Y = 1;
const LAYOUT_MAX_Y = 99;

const RENDER_MIN_X = 8;
const RENDER_MAX_X = 92;
const RENDER_MIN_Y = 6;
const RENDER_MAX_Y = 94;

const SHOW_NODE_IDS = false;

function scaleValue(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
) {
  const ratio = (value - fromMin) / (fromMax - fromMin);
  return toMin + ratio * (toMax - toMin);
}

function scaleX(x: number) {
  return scaleValue(x, LAYOUT_MIN_X, LAYOUT_MAX_X, RENDER_MIN_X, RENDER_MAX_X);
}

function scaleY(y: number) {
  return scaleValue(y, LAYOUT_MIN_Y, LAYOUT_MAX_Y, RENDER_MIN_Y, RENDER_MAX_Y);
}

function unscaleX(renderX: number) {
  return scaleValue(renderX, RENDER_MIN_X, RENDER_MAX_X, LAYOUT_MIN_X, LAYOUT_MAX_X);
}

function unscaleY(renderY: number) {
  return scaleValue(renderY, RENDER_MIN_Y, RENDER_MAX_Y, LAYOUT_MIN_Y, LAYOUT_MAX_Y);
}

function getTileLabel(type: TileType, nodeId?: string) {
  if (nodeId === "kingdom") return "Kingdom";
  switch (type) {
    case "start":
      return "START";
    case "spike":
      return "Spike";
    case "shop":
      return "Shop";
    case "event":
      return "Event";
    case "minigame":
      return "Mini";
    case "lucky":
      return "Lucky";
    case "risk":
      return "Risk";
    case "ult-orb":
      return "Orb";
    case "special":
      return "Tact";
    case "portal":
      return "Portal";
    case "button":
      return "Button";
    case "door":
      return "Door";
    case "normal":
      return "";
    case "empty":
    default:
      return "";
  }
}

function getTileShortMark(type: TileType) {
  switch (type) {
    case "start":
      return "START";
    case "spike":
      return "S";
    case "shop":
      return "$";
    case "event":
      return "?";
    case "minigame":
      return "◆";
    case "lucky":
      return "★";
    case "risk":
      return "!";
    case "ult-orb":
      return "◎";
    case "special":
      return "◈";
    case "portal":
      return "◎";
    case "button":
      return "●";
    case "door":
      return "▣";
    case "normal":
    case "empty":
    default:
      return "";
  }
}

type BoardPathSegment = {
  key: string;
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Quadratic Bezier control point for organic route segments. */
  cx: number;
  cy: number;
  d: string;
  isMidRoad: boolean;
};

const MID_ROAD_NODE_IDS = GATE_BRANCH_NODE_IDS;

/** Straight road segments between adjacent tiles (gentle midpoints for markers). */
function buildBoardPathSegments(): BoardPathSegment[] {
  return listPhysicalEdges().flatMap(({ from, to }) => {
    const fromNode = getNodeById(from);
    const toNode = getNodeById(to);
    if (!fromNode || !toNode) return [];

    const x1 = scaleX(fromNode.x);
    const y1 = scaleY(fromNode.y);
    const x2 = scaleX(toNode.x);
    const y2 = scaleY(toNode.y);
    const isMidRoad =
      MID_ROAD_NODE_IDS.has(from) && MID_ROAD_NODE_IDS.has(to);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    return [
      {
        key: `${from}-${to}`,
        from,
        to,
        x1,
        y1,
        x2,
        y2,
        cx,
        cy,
        d: `M ${x1} ${y1} L ${x2} ${y2}`,
        isMidRoad,
      },
    ];
  });
}

function edgeKey(from: string, to: string) {
  return `${from}->${to}`;
}

function undirectedSelectKey(from: string, to: string) {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

/** Midpoint arrow for one-way roads (points toward `to`). */
function edgeArrowPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size = 1.35
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const tipX = mx + ux * size * 0.55;
  const tipY = my + uy * size * 0.55;
  const leftX = mx - ux * size * 0.45 + px * size * 0.55;
  const leftY = my - uy * size * 0.45 + py * size * 0.55;
  const rightX = mx - ux * size * 0.45 - px * size * 0.55;
  const rightY = my - uy * size * 0.45 - py * size * 0.55;
  return `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
}

function getTileClasses(type: TileType, nodeId?: string) {
  if (nodeId === "kingdom") return "board-tile board-tile--kingdom";
  switch (type) {
    case "start":
      return "board-tile board-tile--start";
    case "event":
      return "board-tile board-tile--event";
    case "shop":
      return "board-tile board-tile--shop";
    case "spike":
      return "board-tile board-tile--spike";
    case "minigame":
      return "board-tile board-tile--minigame";
    case "lucky":
      return "board-tile board-tile--lucky";
    case "risk":
      return "board-tile board-tile--risk";
    case "ult-orb":
      return "board-tile board-tile--ult-orb";
    case "special":
      return "board-tile board-tile--special";
    case "portal":
      return "board-tile board-tile--portal";
    case "button":
      return "board-tile board-tile--button";
    case "door":
      return "board-tile board-tile--button";
    case "normal":
      return "board-tile board-tile--normal";
    case "empty":
    default:
      return "board-tile board-tile--empty";
  }
}

function getStartDirectionDeg(nodeId: string): number | null {
  const node = boardLayout.find((n) => n.id === nodeId);
  if (!node || node.type !== "start" || node.next.length === 0) return null;
  const next = boardLayout.find((n) => n.id === node.next[0]);
  if (!next) return null;
  const dx = scaleX(next.x) - scaleX(node.x);
  const dy = scaleY(next.y) - scaleY(node.y);
  // CSS degrees: 0 = up, clockwise — atan2(dx, -dy) from screen coords
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

/** Outgoing walk directions for rim markers (directed `next` + gate edges). */
function getTileOutgoingDirections(nodeId: string): {
  angleDeg: number;
  isGate?: boolean;
}[] {
  const node = getNodeById(nodeId);
  if (!node) return [];
  const dirs: { angleDeg: number; isGate?: boolean }[] = [];
  const pushDir = (toId: string, isGate = false) => {
    const to = getNodeById(toId);
    if (!to) return;
    const dx = scaleX(to.x) - scaleX(node.x);
    const dy = scaleY(to.y) - scaleY(node.y);
    dirs.push({
      angleDeg: (Math.atan2(dx, -dy) * 180) / Math.PI,
      ...(isGate ? { isGate: true } : {}),
    });
  };
  for (const toId of node.next) pushDir(toId);
  for (const edge of node.gateEdges ?? []) pushDir(edge.to, true);
  return dirs;
}

function BoardMap({
  players,
  currentPlayerIndex,
  movingPlayerIndex,
  animatedToken,
  activeSpikeNodeId,
  activeSpikeStatus,
  round,
  maxRounds,
  highlightCurrentPlayer = true,
  onTileClick,
  onEdgeClick,
  onPlayerTokenClick,
  onAreaPlace,
  onAreaCursorMove,
  areaPlacement = null,
  debugClickable = false,
  selectableNodeIds = [],
  selectableEdges = [],
  selectablePlayerIndices = [],
  dimNonSelectable = false,
  pathChoiceHint = null,
  targetingBanner = null,
  spikePlantAnimation = null,
  onSpikePlantAnimationComplete,
  castFx = null,
  hazards = null,
  gateStates = DEFAULT_GATE_STATES,
  doorStates = {},
  pressedButtonId = null,
  layoutEpoch = 0,
  editor = null,
}: Props) {
  const currentPlayer = players[currentPlayerIndex];
  const currentPlayerNodeId = currentPlayer?.position;
  const selectableNodeIdSet = new Set(selectableNodeIds);
  const selectablePlayerSet = new Set(selectablePlayerIndices);
  const castFxNodeSet = new Set(castFx?.nodeIds ?? []);
  const castFxPlayerSet = new Set(castFx?.playerIndices ?? []);
  const castFxTheme = castFx?.theme ?? "generic";
  const editorEnabled = Boolean(editor?.enabled);
  const pathSegments = useMemo(
    () => buildBoardPathSegments(),
    // Rebuild whenever the live layout mutates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutEpoch]
  );
  const activeGateEdges = useMemo(
    () => listActiveGateEdges(gateStates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gateStates, layoutEpoch]
  );
  const closedGateEdges = useMemo(
    () => listClosedGateEdges(gateStates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gateStates, layoutEpoch]
  );
  const closedDoorEdges = useMemo(
    () => listClosedDoorEdges(doorStates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doorStates, layoutEpoch]
  );
  const poisonNodeSet = new Set(
    (hazards?.poisonClouds ?? [])
      .filter((c) => c.roundsLeft > 0)
      .flatMap((c) =>
        c.nodeIds && c.nodeIds.length > 0 ? c.nodeIds : [c.nodeId]
      )
  );
  const trapNodeSet = new Set(
    (hazards?.traps ?? []).filter((t) => t.armed).map((t) => t.nodeId)
  );
  const detainNodeSet = new Set(
    (hazards?.detainZones ?? []).filter((z) => z.armed).map((z) => z.nodeId)
  );
  const wallEdgeSet = new Set(
    (hazards?.walls ?? [])
      .filter((w) => w.roundsLeft > 0)
      .flatMap((w) => [
        edgeKey(w.fromNodeId, w.toNodeId),
        edgeKey(w.toNodeId, w.fromNodeId),
      ])
  );
  const selectableEdgeSet = new Set(
    selectableEdges.map((edge) => edgeKey(edge.from, edge.to))
  );
  const hasSelectableTiles = selectableNodeIdSet.size > 0;
  const hasSelectableEdges = selectableEdgeSet.size > 0;
  const hasSelectablePlayers = selectablePlayerSet.size > 0;
  const isTargetingMode =
    dimNonSelectable &&
    (hasSelectableTiles || hasSelectableEdges || hasSelectablePlayers);
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const [areaCursor, setAreaCursor] = useState<{ x: number; y: number } | null>(
    null
  );
  const [flyingSpikePosition, setFlyingSpikePosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [flyingSpikeTransitionEnabled, setFlyingSpikeTransitionEnabled] =
    useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    additive: boolean;
  } | null>(null);
  const dragOriginRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    positions: Record<string, { x: number; y: number }>;
  } | null>(null);

  const editorSelectedIds = useMemo(() => {
    if (!editorEnabled) return new Set<string>();
    if (editor?.selectedNodeIds?.length) {
      return new Set(editor.selectedNodeIds);
    }
    if (editor?.selectedNodeId) return new Set([editor.selectedNodeId]);
    return new Set<string>();
  }, [editorEnabled, editor?.selectedNodeIds, editor?.selectedNodeId]);

  const ultiHighlightIds = useMemo(
    () => new Set(editor?.highlightNodeIds ?? []),
    [editor?.highlightNodeIds]
  );

  const selectedEdgeKey = editor?.selectedEdge
    ? undirectedSelectKey(editor.selectedEdge.from, editor.selectedEdge.to)
    : null;

  useEffect(() => {
    if (!spikePlantAnimation) {
      setFlyingSpikePosition(null);
      setFlyingSpikeTransitionEnabled(false);
      return;
    }

    const fromNode = boardLayout.find(
      (node) => node.id === spikePlantAnimation.fromNodeId
    );
    const toNode = boardLayout.find(
      (node) => node.id === spikePlantAnimation.toNodeId
    );

    if (!fromNode || !toNode) {
      onSpikePlantAnimationComplete?.();
      return;
    }

    setFlyingSpikeTransitionEnabled(false);
    setFlyingSpikePosition({
      x: scaleX(fromNode.x),
      y: scaleY(fromNode.y),
    });

    const startTimer = window.setTimeout(() => {
      setFlyingSpikeTransitionEnabled(true);
      setFlyingSpikePosition({
        x: scaleX(toNode.x),
        y: scaleY(toNode.y),
      });
    }, 60);

    const completeTimer = window.setTimeout(() => {
      setFlyingSpikePosition(null);
      setFlyingSpikeTransitionEnabled(false);
      onSpikePlantAnimationComplete?.();
    }, SPIKE_PLANT_ANIMATION_MS);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(completeTimer);
    };
  }, [spikePlantAnimation, onSpikePlantAnimationComplete, layoutEpoch]);

  const clientToLayout = (clientX: number, clientY: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const renderX = ((clientX - rect.left) / rect.width) * 100;
    const renderY = ((clientY - rect.top) / rect.height) * 100;
    return { x: unscaleX(renderX), y: unscaleY(renderY) };
  };

  const banner = targetingBanner ??
    (pathChoiceHint
      ? { title: pathChoiceHint, subtitle: undefined, onCancel: undefined }
      : null);

  return (
    <div
      className={`board-map-root relative h-full min-h-0 w-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl ${
        castFx ? `board-map-root--ult-cast board-map-root--ult-cast-${castFxTheme}` : ""
      } ${editorEnabled ? "board-map-root--editor" : ""}`}
      onPointerDown={(e) => {
        if (!editorEnabled || e.button !== 0) return;
        if (e.altKey) return; // allow camera pan
        const target = e.target as HTMLElement | null;
        if (target?.closest(".board-tile, button, a, input, textarea, select")) {
          return;
        }
        const point = clientToLayout(e.clientX, e.clientY, e.currentTarget);
        if (!point) return;
        if (editor?.selectMode) {
          e.currentTarget.setPointerCapture(e.pointerId);
          setMarquee({
            x1: point.x,
            y1: point.y,
            x2: point.x,
            y2: point.y,
            additive: e.shiftKey,
          });
          return;
        }
        editor?.onBoardBackgroundClick?.(point);
      }}
      onPointerMove={(e) => {
        if (!marquee || !editorEnabled) return;
        const point = clientToLayout(e.clientX, e.clientY, e.currentTarget);
        if (!point) return;
        setMarquee((prev) =>
          prev ? { ...prev, x2: point.x, y2: point.y } : prev
        );
      }}
      onPointerUp={(e) => {
        if (!marquee || !editorEnabled) return;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        const minX = Math.min(marquee.x1, marquee.x2);
        const maxX = Math.max(marquee.x1, marquee.x2);
        const minY = Math.min(marquee.y1, marquee.y2);
        const maxY = Math.max(marquee.y1, marquee.y2);
        const pad = 0.35;
        const hit =
          Math.abs(marquee.x2 - marquee.x1) < 0.8 &&
          Math.abs(marquee.y2 - marquee.y1) < 0.8
            ? []
            : boardLayout
                .filter(
                  (n) =>
                    n.x >= minX - pad &&
                    n.x <= maxX + pad &&
                    n.y >= minY - pad &&
                    n.y <= maxY + pad
                )
                .map((n) => n.id);
        if (hit.length === 0 && !marquee.additive) {
          editor?.onBoardBackgroundClick?.({
            x: marquee.x2,
            y: marquee.y2,
          });
        } else {
          editor?.onMarqueeSelect?.(hit, { additive: marquee.additive });
        }
        setMarquee(null);
      }}
    >
      {marquee && (
        <div
          className="board-editor-marquee"
          style={{
            left: `${scaleX(Math.min(marquee.x1, marquee.x2))}%`,
            top: `${scaleY(Math.min(marquee.y1, marquee.y2))}%`,
            width: `${Math.abs(
              scaleX(marquee.x2) - scaleX(marquee.x1)
            )}%`,
            height: `${Math.abs(
              scaleY(marquee.y2) - scaleY(marquee.y1)
            )}%`,
          }}
        />
      )}
      <img
        src={boardMapBackgroundPath()}
        alt=""
        decoding="async"
        loading="lazy"
        className="board-map-bg absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-zinc-950/70" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,70,85,0.06),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(15,25,35,0.8),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#070b14]/40 via-zinc-950/15 to-[#070b14]/85" />

      {banner && (
        <div className="absolute left-1/2 top-5 z-20 flex max-w-[min(92%,28rem)] -translate-x-1/2 flex-col items-center gap-2 rounded-2xl border border-red-400/30 bg-zinc-900/95 px-5 py-3 text-center backdrop-blur-sm">
          <p className="text-sm font-semibold text-red-100">{banner.title}</p>
          {banner.subtitle && (
            <p className="text-xs text-zinc-400">{banner.subtitle}</p>
          )}
          {banner.onCancel && (
            <button
              type="button"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-200 transition hover:border-red-300/40 hover:bg-red-500/15 hover:text-red-100"
              onClick={banner.onCancel}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {round != null && maxRounds != null && !banner && (
        <div className="absolute left-5 top-5 z-20 rounded-2xl border border-white/10 bg-zinc-900/95 px-4 py-2 backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Round
          </p>
          <p className="text-xl font-black text-white">
            {Math.min(round, maxRounds)}
            <span className="text-sm font-semibold text-zinc-500"> / {maxRounds}</span>
          </p>
        </div>
      )}

      {round != null && maxRounds != null && banner && (
        <div className="absolute left-5 top-5 z-20 rounded-2xl border border-white/10 bg-zinc-900/95 px-3 py-1.5 backdrop-blur-sm">
          <p className="text-sm font-black text-white">
            {Math.min(round, maxRounds)}
            <span className="text-xs font-semibold text-zinc-500"> / {maxRounds}</span>
          </p>
        </div>
      )}

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="board-map-paths absolute inset-0 z-[1] h-full w-full"
        style={{ pointerEvents: "none" }}
        aria-hidden="true"
      >
        <defs>
          <filter
            id="board-path-glow"
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur stdDeviation="0.85" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id="mid-road-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.2 L 9 5 L 0 8.8 Z" fill="rgba(248,113,113,0.95)" />
          </marker>
          {pathSegments.map(({ key, x1, y1, x2, y2 }) => (
            <linearGradient
              key={`grad-${key}`}
              id={`board-path-grad-${key}`}
              gradientUnits="userSpaceOnUse"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            >
              <stop offset="0%" stopColor="rgba(113,113,122,0.08)" />
              <stop offset="22%" stopColor="rgba(34,211,238,0.22)" />
              <stop offset="50%" stopColor="rgba(94,234,212,0.34)" />
              <stop offset="78%" stopColor="rgba(34,211,238,0.22)" />
              <stop offset="100%" stopColor="rgba(113,113,122,0.08)" />
            </linearGradient>
          ))}
        </defs>

        {/* Hub ring hint */}
        <circle
          cx={scaleX(50)}
          cy={scaleY(50)}
          r="14"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.55"
          strokeDasharray="2.2 1.8"
        />

        {pathSegments.map(({ key, from, to, d, x1, y1, x2, y2, isMidRoad }) => {
          const selectKey = edgeKey(from, to);
          const undirectedKey = undirectedSelectKey(from, to);
          const isSelectable = selectableEdgeSet.has(selectKey);
          const isHovered = hoveredEdgeKey === selectKey;
          const isWalled = wallEdgeSet.has(selectKey);
          const dimEdge =
            isTargetingMode && hasSelectableEdges && !isSelectable;
          const editorEdgeHit = editorEnabled && Boolean(editor?.onEditorEdgeClick);
          const edgeColor = getEdgeColor(from, to);
          const isEditorSelectedEdge =
            editorEnabled && selectedEdgeKey === undirectedKey;
          const direction = getEdgeDirectionMode(from, to);
          const paintColor = edgeColor
            ? edgeColor
            : isWalled
              ? "rgba(196,181,253,0.9)"
              : isSelectable
                ? isHovered
                  ? "rgba(252,165,165,0.55)"
                  : "rgba(248,113,113,0.35)"
                : isEditorSelectedEdge
                  ? "rgba(250,204,21,0.75)"
                  : isMidRoad
                    ? "rgba(248,113,113,0.22)"
                    : "rgba(34,211,238,0.16)";
          const topStroke = edgeColor
            ? edgeColor
            : isWalled
              ? "rgba(237,233,254,0.95)"
              : isSelectable
                ? isHovered
                  ? "rgba(254,202,202,0.95)"
                  : "rgba(252,165,165,0.75)"
                : isEditorSelectedEdge
                  ? "rgba(253,224,71,0.95)"
                  : isMidRoad
                    ? "rgba(252,165,165,0.45)"
                    : `url(#board-path-grad-${key})`;

          return (
            <g
              key={key}
              opacity={dimEdge ? 0.28 : 1}
              className={[
                isSelectable ? "board-map-edge--selectable" : "",
                isWalled ? "board-map-edge--walled" : "",
                editorEdgeHit ? "board-map-edge--editor" : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined}
            >
              <path
                d={d}
                fill="none"
                stroke="rgba(0,0,0,0.42)"
                strokeWidth="4.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {isWalled && (
                <path
                  d={d}
                  fill="none"
                  className="board-map-wall-beam"
                  stroke="rgba(167,139,250,0.95)"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#board-path-glow)"
                />
              )}
              <path
                d={d}
                fill="none"
                stroke={paintColor}
                strokeWidth={
                  isWalled
                    ? 4.8
                    : isSelectable || isEditorSelectedEdge
                      ? isHovered
                        ? 5.2
                        : 4.2
                      : isMidRoad
                        ? 3.2
                        : 3.6
                }
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#board-path-glow)"
              />
              <path
                d={d}
                fill="none"
                stroke={topStroke}
                strokeWidth={
                  isWalled
                    ? 2.8
                    : isSelectable || isEditorSelectedEdge
                      ? isHovered
                        ? 3.2
                        : 2.6
                      : 2.2
                }
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={isWalled ? "3.2 2.4" : undefined}
              />
              {!isSelectable && !isWalled && !edgeColor && (
                <>
                  <path
                    d={d}
                    fill="none"
                    className="board-map-path-flow"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    strokeDasharray="2.5 10"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="rgba(255,255,255,0.07)"
                    strokeWidth="0.55"
                    strokeLinecap="round"
                  />
                </>
              )}
              {direction === "a-to-b" && (
                <polygon
                  points={edgeArrowPoints(
                    x1,
                    y1,
                    x2,
                    y2,
                    editorEnabled ? 1.35 : 1.05
                  )}
                  fill={
                    edgeColor ??
                    (editorEnabled
                      ? "rgba(253,224,71,0.95)"
                      : "rgba(34,211,238,0.75)")
                  }
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth="0.15"
                />
              )}
              {direction === "b-to-a" && (
                <polygon
                  points={edgeArrowPoints(
                    x2,
                    y2,
                    x1,
                    y1,
                    editorEnabled ? 1.35 : 1.05
                  )}
                  fill={
                    edgeColor ??
                    (editorEnabled
                      ? "rgba(253,224,71,0.95)"
                      : "rgba(34,211,238,0.75)")
                  }
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth="0.15"
                />
              )}
              {isSelectable && (
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="16"
                  strokeLinecap="round"
                  className="cursor-pointer"
                  style={{ pointerEvents: "stroke" }}
                  onMouseEnter={() => setHoveredEdgeKey(selectKey)}
                  onMouseLeave={() =>
                    setHoveredEdgeKey((current) =>
                      current === selectKey ? null : current
                    )
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdgeClick?.(from, to);
                  }}
                />
              )}
              {editorEdgeHit && !isSelectable && (
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  strokeLinecap="round"
                  className="cursor-pointer"
                  style={{ pointerEvents: "stroke" }}
                  onClick={(event) => {
                    event.stopPropagation();
                    editor?.onEditorEdgeClick?.(from, to);
                  }}
                />
              )}
            </g>
          );
        })}

        {/* Open gate branch accents */}
        {activeGateEdges.map((edge) => {
          const fromNode = getNodeById(edge.from);
          const toNode = getNodeById(edge.to);
          if (!fromNode || !toNode) return null;
          const x1 = scaleX(fromNode.x);
          const y1 = scaleY(fromNode.y);
          const x2 = scaleX(toNode.x);
          const y2 = scaleY(toNode.y);
          return (
            <line
              key={`gate-open-${edge.from}-${edge.to}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(74,222,128,0.55)"
              strokeWidth="1.05"
              strokeLinecap="round"
              className="board-gate-open"
            />
          );
        })}

        {/* Closed gate barriers on split entrances */}
        {closedGateEdges.map((edge) => {
          const fromNode = getNodeById(edge.from);
          const toNode = getNodeById(edge.to);
          if (!fromNode || !toNode) return null;
          const x1 = scaleX(fromNode.x);
          const y1 = scaleY(fromNode.y);
          const x2 = scaleX(toNode.x);
          const y2 = scaleY(toNode.y);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const px = (-dy / len) * 2.4;
          const py = (dx / len) * 2.4;
          return (
            <g
              key={`gate-closed-${edge.from}-${edge.to}-${edge.branch}`}
              className="board-gate board-gate--closed"
            >
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(24,24,27,0.55)"
                strokeWidth="1.3"
                strokeDasharray="1.1 0.9"
                strokeLinecap="round"
                opacity="0.7"
              />
              <line
                x1={mx - px}
                y1={my - py}
                x2={mx + px}
                y2={my + py}
                stroke="rgba(248,113,113,0.9)"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
              <title>{`${GATE_LABELS[edge.gateId]} · ${edge.branch} closed`}</title>
            </g>
          );
        })}

        {/* Closed door barriers (true on/off links) */}
        {closedDoorEdges.map((edge) => {
          const fromNode = getNodeById(edge.from);
          const toNode = getNodeById(edge.to);
          if (!fromNode || !toNode) return null;
          const x1 = scaleX(fromNode.x);
          const y1 = scaleY(fromNode.y);
          const x2 = scaleX(toNode.x);
          const y2 = scaleY(toNode.y);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const px = (-dy / len) * 2.4;
          const py = (dx / len) * 2.4;
          return (
            <g
              key={`door-closed-${edge.doorId}-${edge.from}-${edge.to}`}
              className="board-gate board-gate--closed board-door--closed"
            >
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(24,24,27,0.55)"
                strokeWidth="1.3"
                strokeDasharray="1.1 0.9"
                strokeLinecap="round"
                opacity="0.7"
              />
              <line
                x1={mx - px}
                y1={my - py}
                x2={mx + px}
                y2={my + py}
                stroke="rgba(251,146,60,0.95)"
                strokeWidth="1.35"
                strokeLinecap="round"
              />
              <title>{`Door ${edge.doorId} closed`}</title>
            </g>
          );
        })}
      </svg>

      {areaPlacement && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 z-[2] h-full w-full cursor-crosshair"
          style={{ pointerEvents: "auto" }}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const renderX = ((event.clientX - rect.left) / rect.width) * 100;
            const renderY = ((event.clientY - rect.top) / rect.height) * 100;
            const point = { x: unscaleX(renderX), y: unscaleY(renderY) };
            setAreaCursor(point);
            onAreaCursorMove?.(point);
          }}
          onMouseLeave={() => {
            setAreaCursor(null);
            onAreaCursorMove?.(null);
          }}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const renderX = ((event.clientX - rect.left) / rect.width) * 100;
            const renderY = ((event.clientY - rect.top) / rect.height) * 100;
            onAreaPlace?.({ x: unscaleX(renderX), y: unscaleY(renderY) });
          }}
        >
          {areaCursor && (
            <circle
              cx={scaleX(areaCursor.x)}
              cy={scaleY(areaCursor.y)}
              r={Math.max(
                2,
                scaleValue(
                  areaPlacement.radius,
                  0,
                  LAYOUT_MAX_X - LAYOUT_MIN_X,
                  0,
                  RENDER_MAX_X - RENDER_MIN_X
                )
              )}
              fill="rgba(248,113,113,0.18)"
              stroke="rgba(252,165,165,0.85)"
              strokeWidth="0.45"
              strokeDasharray="1.2 0.8"
              style={{ pointerEvents: "none" }}
            />
          )}
          {areaCursor && (
            <circle
              cx={scaleX(areaCursor.x)}
              cy={scaleY(areaCursor.y)}
              r="0.7"
              fill="#fecaca"
              style={{ pointerEvents: "none" }}
            />
          )}
        </svg>
      )}

      {boardLayout.map((node) => {
        const playersOnNode = players.filter((player) => {
          if (animatedToken && player.id === players[animatedToken.playerIndex]?.id) {
            return false;
          }

          return player.position === node.id;
        });
        const isActiveSpikeTile = activeSpikeNodeId === node.id;
        const isSpikePlantTarget =
          spikePlantAnimation?.toNodeId === node.id && flyingSpikePosition !== null;
        const isPathChoiceOption = selectableNodeIdSet.has(node.id);
        const isCastFxTile = castFxNodeSet.has(node.id);
        const isPoisonTile = poisonNodeSet.has(node.id);
        const isTrapTile = trapNodeSet.has(node.id);
        const isDetainTile = detainNodeSet.has(node.id);
        const isCurrentPlayerTile =
          highlightCurrentPlayer && currentPlayerNodeId === node.id;
        const isDimmed =
          isTargetingMode &&
          ((hasSelectableTiles &&
            !isPathChoiceOption &&
            !(
              hasSelectablePlayers &&
              playersOnNode.some((player) => {
                const idx = players.findIndex((p) => p.id === player.id);
                return selectablePlayerSet.has(idx);
              })
            )) ||
            (hasSelectableEdges && !hasSelectableTiles && !hasSelectablePlayers));

        const tokenCount = playersOnNode.length;
        const tokenSizeClass =
          tokenCount <= 1
            ? "h-[42%] w-[42%]"
            : tokenCount === 2
              ? "h-[36%] w-[36%]"
              : "h-[32%] w-[32%]";
        const tokenTextClass =
          tokenCount <= 1 ? "text-[9px]" : "text-[8px]";
        const tileLabel = getTileLabel(node.type, node.id);
        const tileMark =
          node.id === "kingdom" ? "⌂" : getTileShortMark(node.type);
        const isStartTile = node.type === "start";
        const isKingdom = node.id === "kingdom";
        const tileSize = isStartTile
          ? START_TILE_SIZE_PERCENT
          : isKingdom
            ? 6.2
            : TILE_SIZE_PERCENT;
        const isEditorSelected =
          editorEnabled && editorSelectedIds.has(node.id);
        const isEditorLinkFrom = editorEnabled && editor?.linkFromId === node.id;
        const isUltiHighlight =
          editorEnabled && ultiHighlightIds.has(node.id);
        const startDirDeg = isStartTile ? getStartDirectionDeg(node.id) : null;
        const outgoingDirs = getTileOutgoingDirections(node.id);
        const isButtonTile = node.type === "button";
        const buttonLinks = isButtonTile
          ? getButtonControlledLinks(node.id)
          : [];
        const buttonHasLinkControl = buttonLinks.length > 0;
        const buttonOn =
          buttonHasLinkControl && isButtonOn(node.id, doorStates);

        return (
          <div
            key={node.id}
            onClick={(event) => {
              if (editorEnabled) {
                event.stopPropagation();
                editor?.onSelectNode?.(node.id, { shiftKey: event.shiftKey });
                return;
              }
              if (isTargetingMode && hasSelectableTiles && !isPathChoiceOption) {
                return;
              }
              onTileClick?.(node.id);
            }}
            onPointerDown={(event) => {
              if (!editorEnabled || event.button !== 0 || event.altKey) return;
              if (editor?.selectMode && !editor?.moveMode) {
                // Selection handled on click; no drag-move in select tool.
                return;
              }
              if (!editor?.onMoveNode && !editor?.onMoveNodes) return;
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              const selected =
                editorSelectedIds.has(node.id) && editorSelectedIds.size > 0
                  ? [...editorSelectedIds]
                  : [node.id];
              const positions: Record<string, { x: number; y: number }> = {};
              for (const id of selected) {
                const n = getNodeById(id);
                if (n) positions[id] = { x: n.x, y: n.y };
              }
              dragOriginRef.current = {
                id: node.id,
                startX: node.x,
                startY: node.y,
                positions,
              };
              setDragNodeId(node.id);
              if (!editorSelectedIds.has(node.id)) {
                editor.onSelectNode?.(node.id);
              }
            }}
            onPointerMove={(event) => {
              if (!editorEnabled || dragNodeId !== node.id) return;
              const root = event.currentTarget.closest(".board-map-root");
              if (!(root instanceof HTMLElement)) return;
              const point = clientToLayout(event.clientX, event.clientY, root);
              if (!point) return;
              const origin = dragOriginRef.current;
              if (
                origin &&
                editor?.onMoveNodes &&
                Object.keys(origin.positions).length > 1
              ) {
                const dx = point.x - origin.startX;
                const dy = point.y - origin.startY;
                const updates = Object.entries(origin.positions).map(
                  ([id, pos]) => ({
                    id,
                    x: pos.x + dx,
                    y: pos.y + dy,
                  })
                );
                editor.onMoveNodes(updates, node.id);
                return;
              }
              editor?.onMoveNode?.(node.id, point.x, point.y);
            }}
            onPointerUp={(event) => {
              if (dragNodeId === node.id) {
                setDragNodeId(null);
                dragOriginRef.current = null;
              }
              try {
                event.currentTarget.releasePointerCapture(event.pointerId);
              } catch {
                /* already released */
              }
            }}
            className={`tile-pulse-host board-tile-host absolute z-[2] flex flex-col items-center justify-center rounded-full border text-center text-[10px] text-zinc-100 before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-white/8 before:to-transparent ${getTileClasses(
              node.type,
              node.id
            )} ${
              isCurrentPlayerTile && !isTargetingMode && !editorEnabled
                ? "animate-boardCurrentPulse z-[3] border-cyan-300/80 ring-2 ring-cyan-300/50"
                : "shadow-[0_6px_18px_rgba(0,0,0,0.28)]"
            } ${
              isActiveSpikeTile
                ? "ring-2 ring-red-400/70 shadow-[0_0_24px_rgba(239,68,68,0.28)]"
                : ""
            } ${
              isSpikePlantTarget
                ? "animate-spikeTargetPulse z-[3] border-red-400/80 ring-2 ring-red-400/60"
                : ""
            } ${
              isPathChoiceOption
                ? isTargetingMode
                  ? "animate-ultimateTargetPulse z-[3] cursor-pointer border-red-300/80 ring-2 ring-red-300/55 transition-transform hover:scale-[1.08]"
                  : "animate-pathChoicePulse z-[3] cursor-pointer border-yellow-300/80 ring-2 ring-yellow-300/60 transition-transform hover:scale-[1.08]"
                : ""
            } ${
              isCastFxTile
                ? `ult-cast-tile ult-cast-tile--${castFxTheme} z-[4]`
                : ""
            } ${
              isPoisonTile ? "board-hazard-tile board-hazard-tile--poison" : ""
            } ${
              isTrapTile ? "board-hazard-tile board-hazard-tile--trap" : ""
            } ${
              isDetainTile ? "board-hazard-tile board-hazard-tile--detain" : ""
            } ${
              isButtonTile && buttonHasLinkControl
                ? buttonOn
                  ? "board-tile--button-on"
                  : "board-tile--button-off"
                : ""
            } ${
              pressedButtonId === node.id ? "board-tile--button-pressed" : ""
            } ${
              isDimmed ? "pointer-events-none opacity-35 saturate-50" : ""
            } ${
              debugClickable && !isPathChoiceOption && !editorEnabled
                ? "cursor-pointer transition-transform hover:scale-[1.06] hover:ring-2 hover:ring-cyan-300/60"
                : ""
            } ${
              isEditorSelected
                ? editorSelectedIds.size > 1
                  ? "board-tile--editor-multi-selected z-[5]"
                  : "board-tile--editor-selected z-[5]"
                : ""
            } ${
              isUltiHighlight ? "board-tile--editor-ulti-range" : ""
            } ${
              isEditorLinkFrom ? "board-tile--editor-link-from z-[5]" : ""
            } ${
              editorEnabled
                ? editor?.selectMode && !editor?.moveMode
                  ? "cursor-pointer board-tile--editor-interactive"
                  : "cursor-grab board-tile--editor-interactive"
                : ""
            } ${
              dragNodeId === node.id ? "cursor-grabbing" : ""
            }`}
            style={{
              left: `${scaleX(node.x)}%`,
              top: `${scaleY(node.y)}%`,
              width: `${tileSize}%`,
              height: `${tileSize}%`,
              transform: "translate(-50%, -50%)",
              aspectRatio: "1 / 1",
            }}
            title={tileLabel || node.type}
          >
            {isStartTile && startDirDeg != null && (
              <div
                className="board-tile-start-arrow"
                style={{ transform: `translate(-50%, -50%) rotate(${startDirDeg}deg)` }}
                aria-hidden
              />
            )}
            {outgoingDirs.length > 0 && (
              <div className="board-tile-exit-markers" aria-hidden>
                {outgoingDirs.map((dir, i) => (
                  <span
                    key={`${node.id}-exit-${i}`}
                    className={`board-tile-exit-marker${
                      dir.isGate ? " board-tile-exit-marker--gate" : ""
                    }`}
                    style={{
                      transform: `translate(-50%, -50%) rotate(${dir.angleDeg}deg)`,
                    }}
                  />
                ))}
              </div>
            )}
            {isButtonTile && buttonHasLinkControl && (
              <span
                className="board-tile-button-state"
                aria-label={buttonOn ? "Button ON" : "Button OFF"}
              >
                {buttonOn ? "ON" : "OFF"}
              </span>
            )}
            {isPoisonTile && (
              <div className="board-hazard-poison" aria-hidden>
                <span className="board-hazard-poison__cloud" />
                <span className="board-hazard-poison__particles" />
              </div>
            )}
            {isTrapTile && (
              <div
                className="board-hazard-trap"
                aria-label="Steel Garden trap"
                title="Steel Garden trap"
              >
                <img
                  src="/abilities/vyse/Steel_Garden.png"
                  alt=""
                  className="board-hazard-trap__icon"
                />
              </div>
            )}
            {isDetainTile && (
              <div
                className="board-hazard-detain"
                aria-label="Thrash detain zone"
                title="Thrash detain zone"
              >
                <img
                  src="/abilities/gekko/Thrash.png"
                  alt=""
                  className="board-hazard-detain__icon"
                />
              </div>
            )}
            {isActiveSpikeTile && (
              <div className="absolute -right-[18%] -top-[18%] z-[5] flex h-[48%] w-[48%] items-center justify-center">
                <img
                  src={
                    activeSpikeStatus === "half-defused"
                      ? defuserIconPath()
                      : spikeIconPath()
                  }
                  alt={
                    activeSpikeStatus === "half-defused" ? "Defuser" : "Spike planted"
                  }
                  className="h-full w-full object-contain drop-shadow-[0_0_16px_rgba(239,68,68,0.65)]"
                />
              </div>
            )}
            {(tileLabel || tileMark) && (
              <div
                className={`pointer-events-none absolute left-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 font-bold leading-none drop-shadow-md ${
                  isStartTile
                    ? "board-tile-start-label top-[38%]"
                    : "top-[28%]"
                }`}
              >
                <span className="hidden sm:inline">{tileLabel || tileMark}</span>
                <span className="sm:hidden">{tileMark || tileLabel}</span>
              </div>
            )}
            {(debugClickable || SHOW_NODE_IDS || editorEnabled) && (
              <p className="pointer-events-none absolute left-1/2 top-[8%] z-[1] -translate-x-1/2 text-[7px] text-cyan-300">
                {node.id}
              </p>
            )}

            <div className="pointer-events-none absolute inset-0">
              {playersOnNode.map((player, stackIndex) => {
                const playerIndex = players.findIndex((p) => p.id === player.id);
                const isCurrent = playerIndex === currentPlayerIndex;
                const isMoving = playerIndex === movingPlayerIndex;
                const isSelectablePlayer = selectablePlayerSet.has(playerIndex);
                const isCastFxPlayer = castFxPlayerSet.has(playerIndex);
                const pos = getPlayerTokenPosition(node, stackIndex, tokenCount);
                const status = player.ultimateStatus;
                const statusClasses = [
                  (status?.yoruDriftRounds ?? 0) > 0
                    ? "board-token--drift"
                    : "",
                  (status?.reynaBuffRounds ?? 0) > 0
                    ? "board-token--empress"
                    : "",
                  status?.cloveShield ? "board-token--shield" : "",
                  (status?.movementPenaltyTurns ?? 0) > 0
                    ? "board-token--breach"
                    : "",
                  status?.neonOverdrive ? "board-token--overdrive" : "",
                  status?.inViperPit ? "board-token--poison" : "",
                  (status?.itemsLockedTurns ?? 0) > 0
                    ? "board-token--null"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div
                    key={player.id}
                    role={isSelectablePlayer ? "button" : undefined}
                    tabIndex={isSelectablePlayer ? 0 : undefined}
                    onClick={(event) => {
                      if (!isSelectablePlayer) return;
                      event.stopPropagation();
                      onPlayerTokenClick?.(playerIndex);
                    }}
                    onKeyDown={(event) => {
                      if (!isSelectablePlayer) return;
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      event.stopPropagation();
                      onPlayerTokenClick?.(playerIndex);
                    }}
                    className={[
                      tokenSizeClass,
                      "board-token pointer-events-auto absolute overflow-hidden rounded-full border-2 shadow transition-all duration-150",
                      statusClasses,
                      isSelectablePlayer
                        ? "animate-ultimateTargetPulse cursor-pointer border-red-200 shadow-[0_0_22px_rgba(248,113,113,0.65)] ring-2 ring-red-400/45 hover:scale-110"
                        : isCurrent
                          ? "scale-[1.08] border-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.65)] ring-2 ring-cyan-400/40"
                          : "border-white/85",
                      isMoving && !isSelectablePlayer ? "ring-2 ring-white/50" : "",
                      isCastFxPlayer
                        ? `ult-cast-token ult-cast-token--${castFxTheme}`
                        : "",
                      isTargetingMode &&
                      hasSelectablePlayers &&
                      !isSelectablePlayer
                        ? "opacity-40"
                        : "",
                    ].join(" ")}
                    style={{
                      left: `calc(50% + ${pos.offsetXPercent}%)`,
                      top: `calc(50% + ${pos.offsetYPercent}%)`,
                      transform: "translate(-50%, -50%)",
                    }}
                    title={player.name}
                  >
                    {player.avatar ? (
                      <img
                        src={player.avatar}
                        alt={player.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className={`flex h-full w-full items-center justify-center font-bold text-white ${tokenTextClass}`}
                        style={{ backgroundColor: player.color ?? "#334155" }}
                      >
                        {(player.name.trim().charAt(0) || "?").toUpperCase()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {flyingSpikePosition && (
        <div
          className={`pointer-events-none absolute z-[7] ${
            flyingSpikeTransitionEnabled
              ? "transition-all duration-[1200ms] ease-in-out"
              : ""
          }`}
          style={{
            left: `${flyingSpikePosition.x}%`,
            top: `${flyingSpikePosition.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <img
            src={spikeIconPath()}
            alt="Spike planting"
            className="h-16 w-16 object-contain animate-spikePlantPop"
          />
        </div>
      )}

      {animatedToken && players[animatedToken.playerIndex] && (
        <div
          className="pointer-events-none absolute z-[6]"
          style={{
            left: `${scaleX(animatedToken.x)}%`,
            top: `${scaleY(animatedToken.y)}%`,
            transform: `translate(-50%, calc(-50% - ${animatedToken.jumpOffset}px))`,
          }}
        >
          <div
            className={`h-12 w-12 overflow-hidden rounded-full border-[3px] shadow-[0_0_26px_rgba(34,211,238,0.5)] ${
              animatedToken.playerIndex === currentPlayerIndex
                ? "border-cyan-200 ring-4 ring-cyan-400/35"
                : "border-white"
            }`}
          >
            {players[animatedToken.playerIndex].avatar ? (
              <img
                src={players[animatedToken.playerIndex].avatar}
                alt={players[animatedToken.playerIndex].name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-xs font-bold text-white"
                style={{
                  backgroundColor:
                    players[animatedToken.playerIndex].color ?? "#334155",
                }}
              >
                {(
                  players[animatedToken.playerIndex].name.trim().charAt(0) || "?"
                ).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(BoardMap);
