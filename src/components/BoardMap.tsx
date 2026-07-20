import { memo, useEffect, useState } from "react";
import { boardLayout, type TileType } from "../game/boardLayout";
import type { PlayerInGame } from "../types/Game";
import type { AnimatedTokenState } from "./GamePage";
import {
  boardMapBackgroundPath,
  defuserIconPath,
  spikeIconPath,
} from "../game/assetPaths";

export const SPIKE_PLANT_ANIMATION_MS = 1400;

export type BoardSelectableEdge = {
  from: string;
  to: string;
};

export type BoardTargetingBanner = {
  title: string;
  subtitle?: string;
  onCancel?: () => void;
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
};

const LAYOUT_MIN_X = 10;
const LAYOUT_MAX_X = 85;
const LAYOUT_MIN_Y = 10;
const LAYOUT_MAX_Y = 90;

const RENDER_MIN_X = 10;
const RENDER_MAX_X = 90;
const RENDER_MIN_Y = 7;
const RENDER_MAX_Y = 93;

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

function getTileLabel(type: TileType) {
  switch (type) {
    case "start":
      return "Start";
    case "spike":
      return "Spike";
    case "shop":
      return "Shop";
    case "event":
      return "Event";
    case "minigame":
      return "Minigame";
    case "split":
      return "Split";
    case "merge":
      return "Merge";
    case "empty":
    default:
      return "Empty";
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
};

function buildBoardPathSegments(): BoardPathSegment[] {
  return boardLayout.flatMap((node) =>
    node.next.flatMap((nextId, index) => {
      const nextNode = boardLayout.find((n) => n.id === nextId);
      if (!nextNode) return [];

      return [
        {
          key: `${node.id}-${nextId}-${index}`,
          from: node.id,
          to: nextId,
          x1: scaleX(node.x),
          y1: scaleY(node.y),
          x2: scaleX(nextNode.x),
          y2: scaleY(nextNode.y),
        },
      ];
    })
  );
}

const BOARD_PATH_SEGMENTS = buildBoardPathSegments();

function edgeKey(from: string, to: string) {
  return `${from}->${to}`;
}

function getTileClasses(type: TileType) {
  switch (type) {
    case "start":
      return "bg-zinc-900/85 border-emerald-500/35";
    case "event":
      return "bg-zinc-900/85 border-violet-500/35";
    case "shop":
      return "bg-zinc-900/85 border-cyan-500/35";
    case "spike":
      return "bg-zinc-900/85 border-orange-500/35";
    case "minigame":
      return "bg-zinc-900/85 border-yellow-500/35";
    case "split":
      return "bg-zinc-900/85 border-fuchsia-500/35";
    case "merge":
      return "bg-zinc-900/85 border-indigo-500/35";
    case "empty":
    default:
      return "bg-zinc-950/80 border-white/10";
  }
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
  debugClickable = false,
  selectableNodeIds = [],
  selectableEdges = [],
  selectablePlayerIndices = [],
  dimNonSelectable = false,
  pathChoiceHint = null,
  targetingBanner = null,
  spikePlantAnimation = null,
  onSpikePlantAnimationComplete,
}: Props) {
  const currentPlayer = players[currentPlayerIndex];
  const currentPlayerNodeId = currentPlayer?.position;
  const selectableNodeIdSet = new Set(selectableNodeIds);
  const selectablePlayerSet = new Set(selectablePlayerIndices);
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
  const [flyingSpikePosition, setFlyingSpikePosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [flyingSpikeTransitionEnabled, setFlyingSpikeTransitionEnabled] =
    useState(false);

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
  }, [spikePlantAnimation, onSpikePlantAnimationComplete]);

  const banner = targetingBanner ??
    (pathChoiceHint
      ? { title: pathChoiceHint, subtitle: undefined, onCancel: undefined }
      : null);

  return (
    <div className="board-map-root relative h-full min-h-0 w-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl">
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
          {BOARD_PATH_SEGMENTS.map(({ key, x1, y1, x2, y2 }) => (
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

        {BOARD_PATH_SEGMENTS.map(({ key, from, to, x1, y1, x2, y2 }) => {
          const selectKey = edgeKey(from, to);
          const isSelectable = selectableEdgeSet.has(selectKey);
          const isHovered = hoveredEdgeKey === selectKey;
          const dimEdge =
            isTargetingMode && hasSelectableEdges && !isSelectable;

          return (
            <g
              key={key}
              opacity={dimEdge ? 0.28 : 1}
              className={isSelectable ? "board-map-edge--selectable" : undefined}
            >
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(0,0,0,0.42)"
                strokeWidth="4.8"
                strokeLinecap="round"
              />
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={
                  isSelectable
                    ? isHovered
                      ? "rgba(252,165,165,0.55)"
                      : "rgba(248,113,113,0.35)"
                    : "rgba(34,211,238,0.16)"
                }
                strokeWidth={isSelectable ? (isHovered ? 5.2 : 4.2) : 3.6}
                strokeLinecap="round"
                filter="url(#board-path-glow)"
              />
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={
                  isSelectable
                    ? isHovered
                      ? "rgba(254,202,202,0.95)"
                      : "rgba(252,165,165,0.75)"
                    : `url(#board-path-grad-${key})`
                }
                strokeWidth={isSelectable ? (isHovered ? 3.2 : 2.6) : 2.2}
                strokeLinecap="round"
              />
              {!isSelectable && (
                <>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    className="board-map-path-flow"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    strokeDasharray="2.5 10"
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(255,255,255,0.07)"
                    strokeWidth="0.55"
                    strokeLinecap="round"
                  />
                </>
              )}
              {isSelectable && (
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="transparent"
                  strokeWidth="8"
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
            </g>
          );
        })}
      </svg>

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
          tokenCount <= 1 ? "h-11 w-11" : tokenCount === 2 ? "h-9 w-9" : "h-8 w-8";
        const tokenTextClass =
          tokenCount <= 1 ? "text-xs" : tokenCount === 2 ? "text-[10px]" : "text-[9px]";

        return (
          <div
            key={node.id}
            onClick={() => {
              if (isTargetingMode && hasSelectableTiles && !isPathChoiceOption) {
                return;
              }
              onTileClick?.(node.id);
            }}
            className={`tile-pulse-host absolute z-[2] flex h-28 w-28 flex-col items-center justify-center rounded-[22px] border text-center text-[13px] text-zinc-100 before:pointer-events-none before:absolute before:inset-0 before:rounded-[22px] before:bg-gradient-to-b before:from-white/5 before:to-transparent ${getTileClasses(
              node.type
            )} ${
              isCurrentPlayerTile && !isTargetingMode
                ? "animate-boardCurrentPulse z-[3] border-cyan-300/80 ring-2 ring-cyan-300/50"
                : "shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
            } ${
              isActiveSpikeTile
                ? "ring-2 ring-red-400/70 shadow-[0_0_30px_rgba(239,68,68,0.28)]"
                : ""
            } ${
              isSpikePlantTarget
                ? "animate-spikeTargetPulse z-[3] border-red-400/80 ring-2 ring-red-400/60"
                : ""
            } ${
              isPathChoiceOption
                ? isTargetingMode
                  ? "animate-ultimateTargetPulse z-[3] cursor-pointer border-red-300/80 ring-2 ring-red-300/55 transition-transform hover:scale-[1.04]"
                  : "animate-pathChoicePulse z-[3] cursor-pointer border-yellow-300/80 ring-2 ring-yellow-300/60 transition-transform hover:scale-[1.04]"
                : ""
            } ${
              isDimmed ? "pointer-events-none opacity-35 saturate-50" : ""
            } ${
              debugClickable && !isPathChoiceOption
                ? "cursor-pointer transition-transform hover:scale-[1.03] hover:ring-2 hover:ring-cyan-300/60"
                : ""
            }`}
            style={{
              left: `${scaleX(node.x)}%`,
              top: `${scaleY(node.y)}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {isActiveSpikeTile && (
              <div className="absolute -right-3 -top-3 z-[5] flex h-12 w-12 items-center justify-center">
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
            <div className="font-bold leading-none drop-shadow-md">
              {getTileLabel(node.type)}
            </div>
            {(debugClickable || SHOW_NODE_IDS) && (
              <p className="text-[10px] text-cyan-300">{node.id}</p>
            )}

            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {playersOnNode.map((player) => {
                const playerIndex = players.findIndex((p) => p.id === player.id);
                const isCurrent = playerIndex === currentPlayerIndex;
                const isMoving = playerIndex === movingPlayerIndex;
                const isSelectablePlayer = selectablePlayerSet.has(playerIndex);

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
                      "overflow-hidden rounded-full border-2 shadow transition-all duration-150",
                      isSelectablePlayer
                        ? "animate-ultimateTargetPulse cursor-pointer border-red-200 shadow-[0_0_22px_rgba(248,113,113,0.65)] ring-4 ring-red-400/45 hover:scale-110"
                        : isCurrent
                          ? "scale-[1.15] border-cyan-200 shadow-[0_0_22px_rgba(34,211,238,0.65)] ring-4 ring-cyan-400/40"
                          : "border-white/85",
                      isMoving && !isSelectablePlayer ? "ring-2 ring-white/50" : "",
                      isTargetingMode &&
                      hasSelectablePlayers &&
                      !isSelectablePlayer
                        ? "opacity-40"
                        : "",
                    ].join(" ")}
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
