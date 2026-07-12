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
  debugClickable?: boolean;
  selectableNodeIds?: string[];
  pathChoiceHint?: string | null;
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
    case "duel":
      return "Duel";
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

function getTileClasses(type: TileType) {
  switch (type) {
    case "start":
      return "bg-zinc-900/85 border-emerald-500/35";
    case "event":
      return "bg-zinc-900/85 border-violet-500/35";
    case "shop":
      return "bg-zinc-900/85 border-cyan-500/35";
    case "duel":
      return "bg-zinc-900/85 border-red-500/35";
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
  debugClickable = false,
  selectableNodeIds = [],
  pathChoiceHint = null,
  spikePlantAnimation = null,
  onSpikePlantAnimationComplete,
}: Props) {
  const currentPlayer = players[currentPlayerIndex];
  const currentPlayerNodeId = currentPlayer?.position;
  const selectableNodeIdSet = new Set(selectableNodeIds);
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

      {pathChoiceHint && (
        <div className="absolute left-1/2 top-5 z-20 max-w-[90%] -translate-x-1/2 rounded-2xl border border-yellow-400/25 bg-zinc-900/95 px-5 py-3 text-center backdrop-blur-sm">
          <p className="text-sm font-semibold text-yellow-200/90">{pathChoiceHint}</p>
        </div>
      )}

      {round != null && maxRounds != null && (
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

        {BOARD_PATH_SEGMENTS.map(({ key, x1, y1, x2, y2 }) => (
          <g key={key}>
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
              stroke="rgba(34,211,238,0.16)"
              strokeWidth="3.6"
              strokeLinecap="round"
              filter="url(#board-path-glow)"
            />
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={`url(#board-path-grad-${key})`}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
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
          </g>
        ))}
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

        const tokenCount = playersOnNode.length;
        const tokenSizeClass =
          tokenCount <= 1 ? "h-11 w-11" : tokenCount === 2 ? "h-9 w-9" : "h-8 w-8";
        const tokenTextClass =
          tokenCount <= 1 ? "text-xs" : tokenCount === 2 ? "text-[10px]" : "text-[9px]";

        return (
          <div
            key={node.id}
            onClick={() => onTileClick?.(node.id)}
            className={`tile-pulse-host absolute z-[2] flex h-28 w-28 flex-col items-center justify-center rounded-[22px] border text-center text-[13px] text-zinc-100 before:pointer-events-none before:absolute before:inset-0 before:rounded-[22px] before:bg-gradient-to-b before:from-white/5 before:to-transparent ${getTileClasses(
              node.type
            )} ${
              isCurrentPlayerTile
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
                ? "animate-pathChoicePulse z-[3] cursor-pointer border-yellow-300/80 ring-2 ring-yellow-300/60 transition-transform hover:scale-[1.04]"
                : ""
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
            {debugClickable && (
              <p className="text-[10px] text-cyan-300">{node.id}</p>
            )}

            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {playersOnNode.map((player) => {
                const playerIndex = players.findIndex((p) => p.id === player.id);
                const isCurrent = playerIndex === currentPlayerIndex;
                const isMoving = playerIndex === movingPlayerIndex;

                return (
                  <div
                    key={player.id}
                    className={[
                      tokenSizeClass,
                      "overflow-hidden rounded-full border-2 shadow transition-all duration-150",
                      isCurrent
                        ? "scale-[1.15] border-cyan-200 shadow-[0_0_22px_rgba(34,211,238,0.65)] ring-4 ring-cyan-400/40"
                        : "border-white/85",
                      isMoving ? "ring-2 ring-white/50" : "",
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
