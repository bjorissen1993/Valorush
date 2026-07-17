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
  logs?: string[];
  onClearLogs?: () => void;
};

function DebugSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="debug-panel__section">
      <h3 className="debug-panel__section-title">{title}</h3>
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
      className={`debug-panel__btn ${active ? "debug-panel__btn--active" : ""} ${
        disabled ? "debug-panel__btn--disabled" : ""
      } ${className}`}
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
  logs = [],
  onClearLogs,
}: DebugPanelProps) {
  return (
    <div className="debug-panel-overlay" role="dialog" aria-label="Debug Panel">
      <button
        type="button"
        className="debug-panel-overlay__backdrop"
        aria-label="Close debug panel"
        onClick={onClose}
      />

      <div className="debug-panel">
        <header className="debug-panel__header">
          <div>
            <p className="debug-panel__eyebrow">Developer Tools</p>
            <h2 className="debug-panel__title">Debug Console</h2>
          </div>
          <button type="button" onClick={onClose} className="debug-panel__close">
            Close
          </button>
        </header>

        <div className="debug-panel__body valorant-scrollbar">
          <DebugSection title="Action Log">
            <div className="debug-panel__log-toolbar">
              <p className="debug-panel__log-meta">
                {logs.length === 0
                  ? "No actions logged yet"
                  : `${logs.length} action${logs.length === 1 ? "" : "s"} logged`}
              </p>
              {onClearLogs && (
                <button
                  type="button"
                  onClick={onClearLogs}
                  className="debug-panel__log-clear"
                  disabled={logs.length === 0}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="debug-panel__log valorant-scrollbar">
              {logs.length === 0 ? (
                <p className="debug-panel__log-empty">
                  Event start / fail / complete lines appear here.
                </p>
              ) : (
                logs.map((line, index) => (
                  <p key={`${line}-${index}`} className="debug-panel__log-line">
                    {line}
                  </p>
                ))
              )}
            </div>
          </DebugSection>

          <DebugSection title="Selected Player">
            <div className="debug-panel__chip-row">
              {players.map((player, index) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onSelectPlayer(index)}
                  className={`debug-panel__player-chip ${
                    selectedPlayerIndex === index
                      ? "debug-panel__player-chip--active"
                      : ""
                  }`}
                >
                  <div className="debug-panel__player-avatar">
                    {player.avatar ? (
                      <img src={player.avatar} alt={player.name} />
                    ) : (
                      <div
                        className="debug-panel__player-fallback"
                        style={{ backgroundColor: player.color ?? "#334155" }}
                      >
                        {(player.name.trim().charAt(0) || "?").toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span>{player.name}</span>
                </button>
              ))}
            </div>
          </DebugSection>

          <DebugSection title="Turn Control">
            <div className="debug-panel__grid-2">
              <DebugButton onClick={onForceNextTurn}>Next turn</DebugButton>
              <DebugButton onClick={onEndRound}>End round</DebugButton>
              <DebugButton
                onClick={() => onSkipToPlayer(selectedPlayerIndex)}
                className="debug-panel__span-2"
              >
                Skip to {players[selectedPlayerIndex]?.name ?? "player"}
              </DebugButton>
            </div>
            <div className="debug-panel__chip-row debug-panel__chip-row--tight">
              {players.map((player, index) => (
                <button
                  key={`skip-${player.id}`}
                  type="button"
                  onClick={() => onSkipToPlayer(index)}
                  className="debug-panel__mini-chip"
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
              <DebugSection
                key={category}
                title={`Events — ${EVENT_CATEGORY_LABELS[category]}`}
              >
                <div className="debug-panel__scroll-list valorant-scrollbar">
                  {events.map((event) => (
                    <DebugButton
                      key={event.id}
                      onClick={() => onTriggerEvent(event.id)}
                      className="debug-panel__full"
                      disabled={eventPipelineBusy}
                    >
                      <span className="debug-panel__btn-main">{event.name}</span>
                      <span className="debug-panel__btn-meta">{event.id}</span>
                      {eventPipelineBusy && (
                        <span className="debug-panel__btn-warn">
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
            <div className="debug-panel__stack">
              <DebugButton
                onClick={() => onTriggerDirector()}
                className="debug-panel__full"
                disabled={eventPipelineBusy}
              >
                Random agent director
              </DebugButton>
              <DebugButton
                onClick={onTriggerKingdomProtocol}
                className="debug-panel__full"
                disabled={eventPipelineBusy}
              >
                Kingdom protocol
              </DebugButton>
              <div className="debug-panel__scroll-list valorant-scrollbar">
                {directorAgents.map((agent) => (
                  <DebugButton
                    key={agent.agentId}
                    onClick={() => onTriggerDirector(agent.agentName)}
                    className="debug-panel__full"
                    disabled={eventPipelineBusy}
                  >
                    {agent.agentName}
                  </DebugButton>
                ))}
              </div>
            </div>
          </DebugSection>

          <DebugSection title="Spike">
            <div className="debug-panel__grid-2">
              <DebugButton onClick={onPlantSpike}>Plant spike</DebugButton>
              <DebugButton onClick={onOpenDefusePrompt}>Defuse modal</DebugButton>
              <DebugButton onClick={onHalfDefuseSpike}>Half-defused</DebugButton>
              <DebugButton onClick={onForceDefuseSpike}>Force defused</DebugButton>
              <DebugButton onClick={onDetonateSpike} className="debug-panel__span-2">
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
              <p className="debug-panel__hint">
                Click a board tile to{" "}
                {boardAction === "plant-spike"
                  ? "plant the spike"
                  : "teleport the selected player"}
                .
              </p>
            )}
          </DebugSection>

          <DebugSection title="Custom Matches">
            <div className="debug-panel__stack">
              {customMatches.map((match) => (
                <div key={match.id} className="debug-panel__grid-2">
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
            <div className="debug-panel__stack">
              {minigames.map((minigame) => (
                <DebugButton
                  key={minigame.id}
                  onClick={() => onTriggerMinigame(minigame.id)}
                  className="debug-panel__full"
                >
                  {minigame.name}
                </DebugButton>
              ))}
            </div>
          </DebugSection>

          <DebugSection title="Round End">
            <div className="debug-panel__grid-2">
              <DebugButton onClick={onForceRoundComplete}>
                Force round complete
              </DebugButton>
              <DebugButton onClick={onTriggerScheduledMatch}>
                Play scheduled match
              </DebugButton>
              <DebugButton onClick={onTriggerMapReveal} className="debug-panel__span-2">
                Map reveal presentation
              </DebugButton>
            </div>
          </DebugSection>

          <DebugSection title="Economy & Items">
            <div className="debug-panel__grid-2">
              <DebugButton onClick={() => onAdjustCreds(500)}>+500 Creds</DebugButton>
              <DebugButton onClick={() => onAdjustCreds(-500)}>-500 Creds</DebugButton>
              <DebugButton onClick={() => onAdjustRadianite(1)}>
                +1 Radianite
              </DebugButton>
              <DebugButton onClick={() => onAdjustRadianite(-1)}>
                -1 Radianite
              </DebugButton>
            </div>
            <div className="debug-panel__scroll-list valorant-scrollbar">
              {items.map((item) => (
                <DebugButton
                  key={item.id}
                  onClick={() => onGiveItem(item.id)}
                  className="debug-panel__full"
                >
                  Give {item.name}
                </DebugButton>
              ))}
            </div>
          </DebugSection>

          <DebugSection title="Dice">
            <div className="debug-panel__dice-grid">
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onSetForcedRoll(value)}
                  className={`debug-panel__dice ${
                    forcedRoll === value ? "debug-panel__dice--active" : ""
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onSetForcedRoll(null)}
              className="debug-panel__btn debug-panel__full"
            >
              Reset dice (random)
            </button>
          </DebugSection>

          <DebugSection title="Tiles">
            <div className="debug-panel__grid-2">
              <DebugButton onClick={() => onLandOnTile("spike")}>
                Land on spike
              </DebugButton>
              <DebugButton onClick={onTriggerShop}>Land on shop</DebugButton>
              <DebugButton onClick={() => onLandOnTile("minigame")}>
                Land on minigame
              </DebugButton>
              <DebugButton
                onClick={() => onLandOnTile("event")}
                disabled={eventPipelineBusy}
              >
                Land on event
              </DebugButton>
            </div>
          </DebugSection>

          <div className="debug-panel__status">
            <p>Player: {players[selectedPlayerIndex]?.name ?? "-"}</p>
            <p>Active spike: {activeSpike?.plantedOnNodeId ?? "None"}</p>
            <p>Spike status: {activeSpike?.status ?? "None"}</p>
            <p>Forced roll: {forcedRoll ?? "Random"}</p>
            <p>Pipeline: {eventPipelineBusy ? "Busy" : "Idle"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
