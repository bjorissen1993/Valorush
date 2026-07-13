import { memo, useCallback, useMemo } from "react";
import { randomPortraitPath } from "../../game/assetPaths";
import type { Agent } from "../../types/Agent";
import {
  getActivePlayerSelectedAgentId,
  getRosterGridLayout,
  getTakenAgentIds,
} from "./agentRosterUtils";

type RosterPlayer = {
  id: string | number;
  selectedAgentId?: string;
};

type AgentRosterProps = {
  agents: Agent[];
  players: RosterPlayer[];
  activePlayerId?: string | number | null;
  activePlayerRandomizePending?: boolean;
  allRandomizePending?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onToggleRandomize?: () => void;
  onRandomizeAll?: () => void;
  onToggleReady?: () => void;
  isReady?: boolean;
  canReady?: boolean;
  onSelectAgent: (agentId: string) => void;
};

type AgentCardProps = {
  agent: Agent;
  isTaken: boolean;
  isSelected: boolean;
  isClickable: boolean;
  onSelect: (agentId: string) => void;
};

type RandomizeAgentButtonProps = {
  isActive: boolean;
  isClickable: boolean;
  onToggle: () => void;
};

type RandomizeAllButtonProps = {
  isActive: boolean;
  isClickable: boolean;
  onClick: () => void;
};

const AGENT_ICON_SIZE = 64;

const ROSTER_TILE_CONTENT_HOVER_CLASS =
  "transform-gpu transition-transform duration-150 ease-out group-hover:scale-[1.06] group-active:scale-[0.97]";

const RandomizeAgentButton = memo(function RandomizeAgentButton({
  isActive,
  isClickable,
  onToggle,
}: RandomizeAgentButtonProps) {
  const handleClick = useCallback(() => {
    onToggle();
  }, [onToggle]);

  const contentHoverClass = isClickable ? ROSTER_TILE_CONTENT_HOVER_CLASS : "";

  let stateClass: string;
  if (isActive) {
    stateClass = isClickable
      ? "group border-violet-400/50 bg-violet-500/20 ring-1 ring-violet-400/40"
      : "border-violet-400/50 bg-violet-500/20 ring-1 ring-violet-400/40";
  } else if (isClickable) {
    stateClass =
      "group border-violet-400/25 bg-violet-500/10 transition-colors duration-150 ease-out hover:bg-violet-500/15";
  } else {
    stateClass = "cursor-not-allowed border-white/5 bg-zinc-900/30 opacity-60";
  }

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={handleClick}
      title={
        isActive
          ? "Random agent on start — click to cancel"
          : "Assign a random agent on start"
      }
      aria-pressed={isActive}
      className={`relative aspect-square w-full min-w-0 overflow-hidden rounded-lg border [container-type:size] sm:rounded-xl ${stateClass}`}
    >
      <div className={`pointer-events-none absolute inset-0 ${contentHoverClass}`}>
        <img
          src={randomPortraitPath()}
          alt=""
          aria-hidden
          draggable={false}
          className="lobby-randomize-roster-img h-full w-full object-contain"
        />
      </div>
    </button>
  );
});

type ReadyUpButtonProps = {
  isReady: boolean;
  isClickable: boolean;
  onToggle: () => void;
};

const ReadyUpButton = memo(function ReadyUpButton({
  isReady,
  isClickable,
  onToggle,
}: ReadyUpButtonProps) {
  const handleClick = useCallback(() => {
    onToggle();
  }, [onToggle]);

  let stateClass: string;
  if (isReady) {
    stateClass =
      "border-emerald-400/50 bg-emerald-500/20 ring-1 ring-emerald-400/40 text-emerald-200";
  } else if (isClickable) {
    stateClass =
      "border-white/15 bg-white/5 text-white transition-colors duration-150 ease-out hover:bg-white/10";
  } else {
    stateClass = "cursor-not-allowed border-white/5 bg-zinc-900/30 text-zinc-500 opacity-60";
  }

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={handleClick}
      title={
        isClickable
          ? isReady
            ? "Click to unready"
            : "Mark yourself as ready"
          : "Pick an agent or random first"
      }
      className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold sm:rounded-xl sm:py-3 ${stateClass}`}
    >
      {isReady ? "Ready ✓" : "Ready Up"}
    </button>
  );
});

const RandomizeAllButton = memo(function RandomizeAllButton({
  isActive,
  isClickable,
  onClick,
}: RandomizeAllButtonProps) {
  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  let stateClass: string;
  if (isActive) {
    stateClass =
      "border-violet-400/50 bg-violet-500/20 ring-1 ring-violet-400/40";
  } else if (isClickable) {
    stateClass =
      "border-violet-400/25 bg-violet-500/10 transition-colors duration-150 ease-out hover:bg-violet-500/15";
  } else {
    stateClass = "cursor-not-allowed border-white/5 bg-zinc-900/30 opacity-60";
  }

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={handleClick}
      title="Set every player to a random agent on start"
      aria-pressed={isActive}
      className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold sm:rounded-xl sm:py-2.5 ${stateClass} ${
        isActive ? "text-violet-200" : isClickable ? "text-violet-300" : "text-zinc-500"
      }`}
    >
      <img
        src={randomPortraitPath()}
        alt=""
        aria-hidden
        draggable={false}
        className="lobby-randomize-all-btn-img h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8"
      />
      <span>Randomize All</span>
    </button>
  );
});

const AgentCard = memo(function AgentCard({
  agent,
  isTaken,
  isSelected,
  isClickable,
  onSelect,
}: AgentCardProps) {
  const handleClick = useCallback(() => {
    onSelect(agent.uuid);
  }, [agent.uuid, onSelect]);

  let stateClass: string;
  if (isSelected) {
    stateClass = "border-cyan-400/50 bg-cyan-400/10 ring-1 ring-cyan-400/40";
  } else if (isTaken) {
    stateClass = "cursor-not-allowed border-white/5 bg-zinc-900/40 opacity-40";
  } else if (isClickable) {
    stateClass = "group border-white/10 bg-white/5";
  } else {
    stateClass = "cursor-not-allowed border-white/5 bg-zinc-900/30 opacity-60";
  }

  const contentHoverClass = isClickable ? ROSTER_TILE_CONTENT_HOVER_CLASS : "";

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={handleClick}
      title={
        isTaken
          ? `${agent.displayName} — already picked`
          : agent.displayName
      }
      className={`relative aspect-square w-full min-w-0 overflow-hidden rounded-lg border [container-type:size] sm:rounded-xl ${stateClass}`}
    >
      {agent.displayIcon ? (
        <img
          src={agent.displayIcon}
          alt={agent.displayName}
          width={AGENT_ICON_SIZE}
          height={AGENT_ICON_SIZE}
          decoding="async"
          draggable={false}
          className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${contentHoverClass}`}
        />
      ) : (
        <div className={`absolute inset-0 bg-white/10 ${contentHoverClass}`} />
      )}
    </button>
  );
});

function AgentRoster({
  agents,
  players,
  activePlayerId,
  activePlayerRandomizePending = false,
  allRandomizePending = false,
  loading = false,
  disabled = false,
  onToggleRandomize,
  onRandomizeAll,
  onToggleReady,
  isReady = false,
  canReady = false,
  onSelectAgent,
}: AgentRosterProps) {
  const canPick = !disabled && activePlayerId != null && !loading;
  const canRandomizeAll = !disabled && !loading && players.length > 0;
  const canToggleReady = canReady && !!onToggleReady;

  const rosterCellCount = agents.length + (onToggleRandomize ? 1 : 0);

  const gridLayout = useMemo(
    () => getRosterGridLayout(rosterCellCount),
    [rosterCellCount]
  );

  const takenAgentIds = useMemo(
    () => getTakenAgentIds(players, activePlayerId),
    [players, activePlayerId]
  );

  const activeSelectedAgentId = useMemo(
    () => getActivePlayerSelectedAgentId(players, activePlayerId),
    [players, activePlayerId]
  );

  const gridStyle = useMemo(
    () => ({
      ["--roster-cols" as string]: gridLayout.cols,
      ["--roster-rows" as string]: gridLayout.rows,
      width:
        "min(100cqw, calc(100cqh * var(--roster-cols) / var(--roster-rows)))",
      gridTemplateColumns: `repeat(${gridLayout.cols}, minmax(0, 1fr))`,
    }),
    [gridLayout.cols, gridLayout.rows]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80">
      {onRandomizeAll && (
        <div className="shrink-0 border-b border-white/10 p-1.5 sm:p-2">
          <RandomizeAllButton
            isActive={allRandomizePending}
            isClickable={canRandomizeAll}
            onClick={onRandomizeAll}
          />
        </div>
      )}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1.5 sm:p-2 [container-type:size]">
        {loading ? (
          <div className="text-sm text-zinc-500">Loading roster...</div>
        ) : (
          <div
            className="grid gap-1 [contain:layout_paint] sm:gap-1.5"
            style={gridStyle}
          >
            {onToggleRandomize && (
              <RandomizeAgentButton
                isActive={activePlayerRandomizePending}
                isClickable={canPick}
                onToggle={onToggleRandomize}
              />
            )}
            {agents.map((agent) => {
              const isTaken = takenAgentIds.has(agent.uuid);
              const isSelected = activeSelectedAgentId === agent.uuid;
              const isClickable = canPick && !isTaken;

              return (
                <AgentCard
                  key={agent.uuid}
                  agent={agent}
                  isTaken={isTaken}
                  isSelected={isSelected}
                  isClickable={isClickable}
                  onSelect={onSelectAgent}
                />
              );
            })}
          </div>
        )}
      </div>
      {onToggleReady && (
        <div className="shrink-0 border-t border-white/10 p-1.5 sm:p-2">
          <ReadyUpButton
            isReady={isReady}
            isClickable={canToggleReady}
            onToggle={onToggleReady}
          />
        </div>
      )}
    </div>
  );
}

export default memo(AgentRoster);
