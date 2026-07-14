import type { ReactNode } from "react";
import type { PlayerInGame } from "../types/Game";
import type { ActiveSpike } from "../game/systems/spikeSystem";
import type { TileType } from "../game/boardLayout";
import type { BoardEventDefinition } from "../../shared/events";
import type { MinigameId } from "../../shared/minigames/types";

type DebugBoardAction = "plant-spike" | "teleport-player" | null;

type EventCategory = BoardEventDefinition["category"];

const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  teleport: "Teleport",
  movement: "Movement",
  economy: "Economy",
  player_interaction: "Player Interaction",
  custom_match: "Custom Match",
  map_event: "Map Event",
};

const EVENT_CATEGORY_ORDER: EventCategory[] = [
  "teleport",
  "movement",
  "economy",
  "player_interaction",
  "custom_match",
  "map_event",
];

type DebugPanelProps = {
  onClose: () => void;
  players: PlayerInGame[];
  selectedPlayerIndex: number;
  onSelectPlayer: (index: number) => void;
  forcedRoll: number | null;
  onSetForcedRoll: (value: number | null) => void;
  boardAction: DebugBoardAction;
  onSetBoardAction: (action: DebugBoardAction) => void;
  activeSpike: ActiveSpike | null;
  boardEventsByCategory: Record<EventCategory, BoardEventDefinition[]>;
  directorAgents: { agentId: string; agentName: string }[];
  customMatches: { id: string; name: string }[];
  minigames: { id: MinigameId; name: string }[];
  items: { id: string; name: string }[];
  onForceNextTurn: () => void;
  onSkipToPlayer: (playerIndex: number) => void;
  onEndRound: () => void;
  onTriggerEvent: (eventId: string) => void;
  eventPipelineBusy?: boolean;
  onTriggerDirector: (agentName?: string) => void;
  onTriggerKingdomProtocol: () => void;
  onOpenDefusePrompt: () => void;
  onHalfDefuseSpike: () => void;
  onForceDefuseSpike: () => void;
  onDetonateSpike: () => void;
  onPlantSpike: () => void;
  onScheduleCustomMatch: (matchId: string) => void;
  onPlayCustomMatch: (matchId: string) => void;
  onForceRoundComplete: () => void;
  onTriggerScheduledMatch: () => void;
  onTriggerMapReveal: () => void;
  onAdjustCreds: (amount: number) => void;
  onAdjustRadianite: (amount: number) => void;
  onGiveItem: (itemId: string) => void;
  onTriggerMinigame: (minigameId: MinigameId) => void;
  onLandOnTile: (tileType: TileType) => void;
  onTriggerShop: () => void;
};

function DebugSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-zinc-700 pt-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DebugButton({
  onClick,
  children,
  active,
  className = "",
  disabled = false,
}: {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-2 text-left text-sm transition hover:border-zinc-500 hover:bg-zinc-800 ${
        active
          ? "border-cyan-500 bg-cyan-950 text-cyan-100"
          : "border-zinc-700 bg-zinc-900 text-zinc-100"
      } ${disabled ? "cursor-not-allowed opacity-45 hover:border-zinc-700 hover:bg-zinc-900" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export default function DebugPanel({
  onClose,
  players,
  selectedPlayerIndex,
  onSelectPlayer,
  forcedRoll,
  onSetForcedRoll,
  boardAction,
  onSetBoardAction,
  activeSpike,
  boardEventsByCategory,
  directorAgents,
  customMatches,
  minigames,
  items,
  onForceNextTurn,
  onSkipToPlayer,
  onEndRound,
  onTriggerEvent,
  eventPipelineBusy = false,
  onTriggerDirector,
  onTriggerKingdomProtocol,
  onOpenDefusePrompt,
  onHalfDefuseSpike,
  onForceDefuseSpike,
  onDetonateSpike,
  onPlantSpike,
  onScheduleCustomMatch,
  onPlayCustomMatch,
  onForceRoundComplete,
  onTriggerScheduledMatch,
  onTriggerMapReveal,
  onAdjustCreds,
  onAdjustRadianite,
  onGiveItem,
  onTriggerMinigame,
  onLandOnTile,
  onTriggerShop,
}: DebugPanelProps) {
  return (
    <div className="fixed left-4 top-16 bottom-24 z-[119] flex w-[min(400px,calc(100vw-2rem))] flex-col rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-100">Debug Panel</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Close
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <DebugSection title="Selected Player">
          <div className="flex flex-wrap gap-2">
            {players.map((player, index) => (
              <button
                key={player.id}
                type="button"
                onClick={() => onSelectPlayer(index)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                  selectedPlayerIndex === index
                    ? "border-cyan-500 bg-cyan-950 text-cyan-100"
                    : "border-zinc-700 bg-zinc-900 text-zinc-100"
                }`}
              >
                <div className="h-7 w-7 overflow-hidden rounded-full border border-zinc-600 bg-zinc-800">
                  {player.avatar ? (
                    <img
                      src={player.avatar}
                      alt={player.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: player.color ?? "#334155" }}
                    >
                      {(player.name.trim().charAt(0) || "?").toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-xs">{player.name}</span>
              </button>
            ))}
          </div>
        </DebugSection>

        <DebugSection title="Turn Control">
          <div className="grid grid-cols-2 gap-2">
            <DebugButton onClick={onForceNextTurn}>Next turn</DebugButton>
            <DebugButton onClick={onEndRound}>End round</DebugButton>
            <DebugButton
              onClick={() => onSkipToPlayer(selectedPlayerIndex)}
              className="col-span-2"
            >
              Skip to {players[selectedPlayerIndex]?.name ?? "player"}
            </DebugButton>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {players.map((player, index) => (
              <button
                key={`skip-${player.id}`}
                type="button"
                onClick={() => onSkipToPlayer(index)}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {player.name}
              </button>
            ))}
          </div>
        </DebugSection>

        {EVENT_CATEGORY_ORDER.map((category) => {
          const events = boardEventsByCategory[category];
          if (!events?.length) return null;
          return (
            <DebugSection key={category} title={`Events — ${EVENT_CATEGORY_LABELS[category]}`}>
              <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {events.map((event) => (
                  <DebugButton
                    key={event.id}
                    onClick={() => onTriggerEvent(event.id)}
                    className="w-full"
                    disabled={eventPipelineBusy}
                  >
                    <span className="font-medium">{event.name}</span>
                    <span className="ml-2 text-xs text-zinc-500">{event.id}</span>
                    {eventPipelineBusy && (
                      <span className="mt-1 block text-[10px] text-amber-400/80">
                        Event pipeline busy
                      </span>
                    )}
                  </DebugButton>
                ))}
              </div>
            </DebugSection>
          );
        })}

        <DebugSection title="Director">
          <div className="space-y-2">
            <DebugButton onClick={() => onTriggerDirector()} className="w-full">
              Random agent director
            </DebugButton>
            <DebugButton onClick={onTriggerKingdomProtocol} className="w-full">
              Kingdom protocol
            </DebugButton>
            <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
              {directorAgents.map((agent) => (
                <DebugButton
                  key={agent.agentId}
                  onClick={() => onTriggerDirector(agent.agentName)}
                  className="w-full"
                >
                  {agent.agentName}
                </DebugButton>
              ))}
            </div>
          </div>
        </DebugSection>

        <DebugSection title="Spike">
          <div className="grid grid-cols-2 gap-2">
            <DebugButton onClick={onPlantSpike}>Plant spike</DebugButton>
            <DebugButton onClick={onOpenDefusePrompt}>Defuse modal</DebugButton>
            <DebugButton onClick={onHalfDefuseSpike}>Half-defused</DebugButton>
            <DebugButton onClick={onForceDefuseSpike}>Force defused</DebugButton>
            <DebugButton onClick={onDetonateSpike} className="col-span-2">
              Detonate now
            </DebugButton>
            <DebugButton
              onClick={() => onSetBoardAction("plant-spike")}
              active={boardAction === "plant-spike"}
            >
              Plant on tile click
            </DebugButton>
            <DebugButton
              onClick={() => onSetBoardAction("teleport-player")}
              active={boardAction === "teleport-player"}
            >
              Teleport on click
            </DebugButton>
          </div>
          {boardAction && (
            <p className="mt-2 text-xs text-cyan-400">
              Click a board tile to{" "}
              {boardAction === "plant-spike" ? "plant the spike" : "teleport the selected player"}.
            </p>
          )}
        </DebugSection>

        <DebugSection title="Custom Matches">
          <div className="space-y-2">
            {customMatches.map((match) => (
              <div key={match.id} className="grid grid-cols-2 gap-2">
                <DebugButton onClick={() => onScheduleCustomMatch(match.id)}>
                  Schedule {match.name}
                </DebugButton>
                <DebugButton onClick={() => onPlayCustomMatch(match.id)}>
                  Play {match.name}
                </DebugButton>
              </div>
            ))}
          </div>
        </DebugSection>

        <DebugSection title="Minigames">
          <div className="grid grid-cols-1 gap-2">
            {minigames.map((minigame) => (
              <DebugButton
                key={minigame.id}
                onClick={() => onTriggerMinigame(minigame.id)}
              >
                {minigame.name}
              </DebugButton>
            ))}
          </div>
        </DebugSection>

        <DebugSection title="Round End">
          <div className="grid grid-cols-2 gap-2">
            <DebugButton onClick={onForceRoundComplete}>Force round complete</DebugButton>
            <DebugButton onClick={onTriggerScheduledMatch}>Play scheduled match</DebugButton>
            <DebugButton onClick={onTriggerMapReveal} className="col-span-2">
              Map reveal presentation
            </DebugButton>
          </div>
        </DebugSection>

        <DebugSection title="Economy & Items">
          <div className="grid grid-cols-2 gap-2">
            <DebugButton onClick={() => onAdjustCreds(500)}>+500 Creds</DebugButton>
            <DebugButton onClick={() => onAdjustCreds(-500)}>-500 Creds</DebugButton>
            <DebugButton onClick={() => onAdjustRadianite(1)}>+1 Radianite</DebugButton>
            <DebugButton onClick={() => onAdjustRadianite(-1)}>-1 Radianite</DebugButton>
          </div>
          <div className="mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
            {items.map((item) => (
              <DebugButton key={item.id} onClick={() => onGiveItem(item.id)} className="w-full">
                Give {item.name}
              </DebugButton>
            ))}
          </div>
        </DebugSection>

        <DebugSection title="Dice">
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onSetForcedRoll(value)}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                  forcedRoll === value
                    ? "bg-cyan-500 text-black"
                    : "border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                }`}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onSetForcedRoll(null)}
              className="col-span-4 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
            >
              Reset dice (random)
            </button>
          </div>
        </DebugSection>

        <DebugSection title="Tiles">
          <div className="grid grid-cols-2 gap-2">
            <DebugButton onClick={() => onLandOnTile("spike")}>Land on spike</DebugButton>
            <DebugButton onClick={onTriggerShop}>Land on shop</DebugButton>
            <DebugButton onClick={() => onLandOnTile("minigame")}>Land on minigame</DebugButton>
            <DebugButton onClick={() => onLandOnTile("event")}>Land on event</DebugButton>
          </div>
        </DebugSection>

        <div className="border-t border-zinc-700 pt-3 text-xs text-zinc-500">
          <p>Player: {players[selectedPlayerIndex]?.name ?? "-"}</p>
          <p>Active spike: {activeSpike?.plantedOnNodeId ?? "None"}</p>
          <p>Spike status: {activeSpike?.status ?? "None"}</p>
          <p>Forced roll: {forcedRoll ?? "Random"}</p>
        </div>
      </div>
    </div>
  );
}
