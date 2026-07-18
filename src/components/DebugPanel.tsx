import type { ReactNode } from "react";
import type { PlayerInGame } from "../types/Game";
import type { ActiveSpike } from "../game/systems/spikeSystem";
import type { TileType } from "../game/boardLayout";
import type { BoardEventDefinition } from "../../shared/events";
import type { MinigameId } from "../../shared/minigames/types";
import HoverTooltip from "./HoverTooltip";

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
  onAdjustUltimateOrbs: (amount: number) => void;
  onSetUltimateOrbs: (orbs: number) => void;
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
  tooltip,
}: {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  className?: string;
  disabled?: boolean;
  tooltip: string;
}) {
  const layoutClasses = [
    "hover-tooltip--block",
    "hover-tooltip--fill",
    className.includes("debug-panel__span-2") ? "debug-panel__span-2" : "",
    className.includes("debug-panel__full") ? "debug-panel__full" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <HoverTooltip content={tooltip} className={layoutClasses}>
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
    </HoverTooltip>
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
  onAdjustUltimateOrbs,
  onSetUltimateOrbs,
  onGiveItem,
  onTriggerMinigame,
  onLandOnTile,
  onTriggerShop,
  logs = [],
  onClearLogs,
}: DebugPanelProps) {
  const selectedPlayer = players[selectedPlayerIndex];
  const selectedPlayerName = selectedPlayer?.name ?? "player";
  const selectedOrbs = selectedPlayer?.ultimateOrbs ?? 0;

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
          <HoverTooltip content="Close the debug console overlay.">
            <button type="button" onClick={onClose} className="debug-panel__close">
              Close
            </button>
          </HoverTooltip>
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
                <HoverTooltip content="Clear all entries from the debug action log.">
                  <button
                    type="button"
                    onClick={onClearLogs}
                    className="debug-panel__log-clear"
                    disabled={logs.length === 0}
                  >
                    Clear
                  </button>
                </HoverTooltip>
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
                <HoverTooltip
                  key={player.id}
                  content={`Select ${player.name} as the target for economy, items, skip, and teleport actions.`}
                >
                  <button
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
                </HoverTooltip>
              ))}
            </div>
          </DebugSection>

          <DebugSection title="Turn Control">
            <div className="debug-panel__grid-2">
              <DebugButton
                onClick={onForceNextTurn}
                tooltip="Advance one seat in turn order only. Does not end the round or start a custom match."
              >
                Next turn
              </DebugButton>
              <DebugButton
                onClick={onEndRound}
                tooltip="Force the round to complete as if every seat has acted — triggers round wrap and any scheduled custom match."
              >
                End round
              </DebugButton>
              <DebugButton
                onClick={() => onSkipToPlayer(selectedPlayerIndex)}
                className="debug-panel__span-2"
                tooltip={`Jump turn ownership to ${selectedPlayerName} without playing intermediate turns.`}
              >
                Skip to {selectedPlayerName}
              </DebugButton>
            </div>
            <div className="debug-panel__chip-row debug-panel__chip-row--tight">
              {players.map((player, index) => (
                <HoverTooltip
                  key={`skip-${player.id}`}
                  content={`Skip ahead so it becomes ${player.name}'s turn.`}
                >
                  <button
                    type="button"
                    onClick={() => onSkipToPlayer(index)}
                    className="debug-panel__mini-chip"
                  >
                    {player.name}
                  </button>
                </HoverTooltip>
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
                      tooltip={
                        eventPipelineBusy
                          ? "Event pipeline is busy — wait for the current event to finish."
                          : `Force-trigger board event “${event.name}” (${event.id}) for the selected player.`
                      }
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
                tooltip="Trigger a director sequence with a randomly chosen agent."
              >
                Random agent director
              </DebugButton>
              <DebugButton
                onClick={onTriggerKingdomProtocol}
                className="debug-panel__full"
                disabled={eventPipelineBusy}
                tooltip="Force the Kingdom Protocol director presentation and effects."
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
                    tooltip={`Trigger the director sequence as ${agent.agentName}.`}
                  >
                    {agent.agentName}
                  </DebugButton>
                ))}
              </div>
            </div>
          </DebugSection>

          <DebugSection title="Spike">
            <div className="debug-panel__grid-2">
              <DebugButton
                onClick={onPlantSpike}
                tooltip="Plant the spike at the selected player's current tile."
              >
                Plant spike
              </DebugButton>
              <DebugButton
                onClick={onOpenDefusePrompt}
                tooltip="Open the spike defuse modal as if a player started defusing."
              >
                Defuse modal
              </DebugButton>
              <DebugButton
                onClick={onHalfDefuseSpike}
                tooltip="Mark the active spike as half-defused (partial progress)."
              >
                Half-defused
              </DebugButton>
              <DebugButton
                onClick={onForceDefuseSpike}
                tooltip="Instantly complete a successful spike defuse."
              >
                Force defused
              </DebugButton>
              <DebugButton
                onClick={onDetonateSpike}
                className="debug-panel__span-2"
                tooltip="Detonate the active spike immediately and apply explosion effects."
              >
                Detonate now
              </DebugButton>
              <DebugButton
                onClick={() => onSetBoardAction("plant-spike")}
                active={boardAction === "plant-spike"}
                tooltip="Enable board click mode: next tile click plants the spike there."
              >
                Plant on tile click
              </DebugButton>
              <DebugButton
                onClick={() => onSetBoardAction("teleport-player")}
                active={boardAction === "teleport-player"}
                tooltip="Enable board click mode: next tile click teleports the selected player."
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
                  <DebugButton
                    onClick={() => onScheduleCustomMatch(match.id)}
                    tooltip={`Queue “${match.name}” to play after the current round ends.`}
                  >
                    Schedule {match.name}
                  </DebugButton>
                  <DebugButton
                    onClick={() => onPlayCustomMatch(match.id)}
                    tooltip={`Start “${match.name}” immediately, skipping the schedule wait.`}
                  >
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
                  tooltip={`Launch the “${minigame.name}” minigame for the selected player.`}
                >
                  {minigame.name}
                </DebugButton>
              ))}
            </div>
          </DebugSection>

          <DebugSection title="Round End">
            <div className="debug-panel__grid-2">
              <DebugButton
                onClick={onForceRoundComplete}
                tooltip="Mark the round as complete and jump into round-end flow."
              >
                Force round complete
              </DebugButton>
              <DebugButton
                onClick={onTriggerScheduledMatch}
                tooltip="Start whatever custom match is currently scheduled, if any."
              >
                Play scheduled match
              </DebugButton>
              <DebugButton
                onClick={onTriggerMapReveal}
                className="debug-panel__span-2"
                tooltip="Play the map reveal presentation used at round / match transitions."
              >
                Map reveal presentation
              </DebugButton>
            </div>
          </DebugSection>

          <DebugSection title="Economy & Items">
            <div className="debug-panel__grid-2">
              <DebugButton
                onClick={() => onAdjustCreds(500)}
                tooltip={`Add 500 creds to ${selectedPlayerName}.`}
              >
                +500 Creds
              </DebugButton>
              <DebugButton
                onClick={() => onAdjustCreds(-500)}
                tooltip={`Remove 500 creds from ${selectedPlayerName}.`}
              >
                -500 Creds
              </DebugButton>
              <DebugButton
                onClick={() => onAdjustRadianite(1)}
                tooltip={`Add 1 radianite to ${selectedPlayerName}.`}
              >
                +1 Radianite
              </DebugButton>
              <DebugButton
                onClick={() => onAdjustRadianite(-1)}
                tooltip={`Remove 1 radianite from ${selectedPlayerName}.`}
              >
                -1 Radianite
              </DebugButton>
            </div>
            <div className="debug-panel__scroll-list valorant-scrollbar">
              {items.map((item) => (
                <DebugButton
                  key={item.id}
                  onClick={() => onGiveItem(item.id)}
                  className="debug-panel__full"
                  tooltip={`Give “${item.name}” to ${selectedPlayerName}'s inventory.`}
                >
                  Give {item.name}
                </DebugButton>
              ))}
            </div>
          </DebugSection>

          <DebugSection title="Ultimate Orbs">
            <p className="debug-panel__hint">
              {selectedPlayerName}: {selectedOrbs}/3 orbs
              {selectedOrbs >= 3 ? " — ULT READY" : ""}
            </p>
            <div className="debug-panel__grid-2">
              <DebugButton
                onClick={() => onAdjustUltimateOrbs(1)}
                tooltip={`Give ${selectedPlayerName} +1 ultimate orb (capped at 3).`}
              >
                +1 Ultimate Orb
              </DebugButton>
              <DebugButton
                onClick={() => onAdjustUltimateOrbs(2)}
                tooltip={`Give ${selectedPlayerName} +2 ultimate orbs (capped at 3).`}
              >
                +2 Orbs
              </DebugButton>
              <DebugButton
                onClick={() => onSetUltimateOrbs(3)}
                tooltip={`Set ${selectedPlayerName}'s ultimate to full (3/3) — ULT READY.`}
              >
                Full Ultimate (3/3)
              </DebugButton>
              <DebugButton
                onClick={() => onSetUltimateOrbs(0)}
                tooltip={`Clear ${selectedPlayerName}'s ultimate orbs to 0.`}
              >
                Clear orbs
              </DebugButton>
            </div>
          </DebugSection>

          <DebugSection title="Dice">
            <div className="debug-panel__dice-grid">
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <HoverTooltip
                  key={value}
                  content={`Force the next dice roll to land on ${value}.`}
                  className="hover-tooltip--block hover-tooltip--fill"
                >
                  <button
                    type="button"
                    onClick={() => onSetForcedRoll(value)}
                    className={`debug-panel__dice ${
                      forcedRoll === value ? "debug-panel__dice--active" : ""
                    }`}
                  >
                    {value}
                  </button>
                </HoverTooltip>
              ))}
            </div>
            <HoverTooltip
              content="Clear the forced roll so the next dice result is random again."
              className="hover-tooltip--block hover-tooltip--fill"
            >
              <button
                type="button"
                onClick={() => onSetForcedRoll(null)}
                className="debug-panel__btn debug-panel__full"
              >
                Reset dice (random)
              </button>
            </HoverTooltip>
          </DebugSection>

          <DebugSection title="Tiles">
            <div className="debug-panel__grid-2">
              <DebugButton
                onClick={() => onLandOnTile("spike")}
                tooltip="Simulate the selected player landing on a spike tile."
              >
                Land on spike
              </DebugButton>
              <DebugButton
                onClick={onTriggerShop}
                tooltip="Simulate landing on a shop tile and open the shop."
              >
                Land on shop
              </DebugButton>
              <DebugButton
                onClick={() => onLandOnTile("minigame")}
                tooltip="Simulate landing on a minigame tile."
              >
                Land on minigame
              </DebugButton>
              <DebugButton
                onClick={() => onLandOnTile("event")}
                disabled={eventPipelineBusy}
                tooltip={
                  eventPipelineBusy
                    ? "Event pipeline is busy — wait before forcing an event tile."
                    : "Simulate landing on an event tile and trigger its event."
                }
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
