import type { ReactNode } from "react";
import type { PlayerInGame } from "../types/Game";
import { itemById, type ItemDefinition } from "../../shared/items";
import { getUltimateForAgent, MAX_ULTIMATE_ORBS } from "../../shared/ultimates";
import { weaponImageMap, shieldImageMap } from "../game/data/weaponImages";
import type { WeaponName } from "../game/systems/shopSystem";
import HoverTooltip from "./HoverTooltip";
import UltimateMeter, { ULTIMATE_TOOLTIP_DELAY_MS } from "./UltimateMeter";
import { canActivateUltimate } from "../game/ultimates";

const SPIKE_ONLY_ITEM_IDS = new Set([
  "wire-cutter",
  "stim-beacon",
  "owl-drone",
  "ultimate-charge",
]);

export type InventoryItemAction =
  | { kind: "use"; itemId: string }
  | { kind: "use-with-target"; itemId: string; targetPlayerIndex: number };

export type PlantedSpikeInfo = {
  nodeId: string;
  status: "planted" | "half-defused";
};

type PlayerInventorySidebarProps = {
  player: PlayerInGame;
  agentName: string;
  agentBackgroundImage: string | null;
  agentPortraitImage: string | null;
  isCurrentTurn: boolean;
  /** Local pass-and-play or online when it is your seat. */
  canAct: boolean;
  canOpenDice: boolean;
  diceHint?: string | null;
  performanceMode?: boolean;
  compact?: boolean;
  pendingTargetItemId?: string | null;
  otherPlayers?: { index: number; name: string }[];
  plantedSpike?: PlantedSpikeInfo | null;
  onOpenDice?: () => void;
  onUseItem?: (action: InventoryItemAction) => void;
  onCancelTarget?: () => void;
  /** Activate ultimate when meter is full (current turn + canAct). */
  onActivateUltimate?: () => void;
  onClose?: () => void;
  onOpenMenu?: () => void;
  menuOpen?: boolean;
  /** Chat trigger rendered left of the settings cog in the header. */
  chatWidget?: ReactNode;
  showDebugButton?: boolean;
  debugOpen?: boolean;
  onToggleDebug?: () => void;
};

function SettingsGearIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  );
}

function getWeaponImage(weapon: string | null): string | undefined {
  if (!weapon) return undefined;
  return weaponImageMap[weapon as WeaponName];
}

function getShieldImage(label: string | null): string | undefined {
  if (!label) return undefined;
  switch (label) {
    case "Light Shields":
      return shieldImageMap.light;
    case "Regen Shield":
      return shieldImageMap.regen;
    case "Heavy Shields":
      return shieldImageMap.heavy;
    default:
      return undefined;
  }
}

function classifyItem(item: ItemDefinition): "dice" | "special" | "spike" {
  if (SPIKE_ONLY_ITEM_IDS.has(item.id)) return "spike";
  if (item.boardEffect?.kind === "dice_bonus") return "dice";
  return "special";
}

function isUsableBoardItem(item: ItemDefinition): boolean {
  if (!item.boardEffect) return false;
  if (SPIKE_ONLY_ITEM_IDS.has(item.id)) return false;
  return (
    item.boardEffect.kind === "dice_bonus" ||
    item.boardEffect.kind === "steal_creds" ||
    item.boardEffect.kind === "swap_position"
  );
}

function needsTarget(item: ItemDefinition): boolean {
  const kind = item.boardEffect?.kind;
  return kind === "steal_creds" || kind === "swap_position";
}

function formatSpikeNodeLabel(nodeId: string): string {
  return nodeId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function PlayerInventorySidebar({
  player,
  agentName,
  agentBackgroundImage,
  agentPortraitImage,
  isCurrentTurn,
  canAct,
  canOpenDice,
  diceHint,
  performanceMode = false,
  compact = false,
  pendingTargetItemId = null,
  otherPlayers = [],
  plantedSpike = null,
  onOpenDice,
  onUseItem,
  onCancelTarget,
  onActivateUltimate,
  onClose,
  onOpenMenu,
  menuOpen = false,
  chatWidget,
  showDebugButton = false,
  debugOpen = false,
  onToggleDebug,
}: PlayerInventorySidebarProps) {
  const ownedItems = player.items
    .map((id) => itemById.get(id))
    .filter((item): item is ItemDefinition => !!item);

  const diceItems = ownedItems.filter((item) => classifyItem(item) === "dice");
  const specialItems = ownedItems.filter(
    (item) => classifyItem(item) === "special"
  );
  const spikeItems = ownedItems.filter((item) => classifyItem(item) === "spike");

  const primaryWeapon = player.primaryWeapon ?? player.weapon ?? null;
  const secondaryWeapon = player.secondaryWeapon ?? null;
  const primaryImage = getWeaponImage(primaryWeapon);
  const secondaryImage = getWeaponImage(secondaryWeapon);
  const shieldImage = getShieldImage(player.shield);
  const pendingItem = pendingTargetItemId
    ? itemById.get(pendingTargetItemId)
    : null;
  const rosterImage = agentPortraitImage;
  const ultimateDef = getUltimateForAgent(agentName);
  const orbs = player.ultimateOrbs ?? 0;
  const ultReady = canActivateUltimate(orbs);
  const itemsLocked = (player.ultimateStatus?.itemsLockedTurns ?? 0) > 0;
  const canShowUltActivate =
    Boolean(ultimateDef) &&
    ultimateDef?.implementation === "full" &&
    isCurrentTurn &&
    canAct &&
    ultReady &&
    Boolean(onActivateUltimate);

  function handleItemClick(item: ItemDefinition) {
    if (!canAct || !onUseItem || !isUsableBoardItem(item)) return;
    if (itemsLocked) return;
    onUseItem({ kind: "use", itemId: item.id });
  }

  return (
    <div
      className={`player-inventory-panel ${
        isCurrentTurn ? "player-inventory-panel--active" : ""
      } ${compact ? "player-inventory-panel--compact" : ""}`}
    >
      {agentBackgroundImage && (
        <img
          src={agentBackgroundImage}
          alt=""
          className={`player-inventory-panel__bg ${
            performanceMode
              ? "player-inventory-panel__bg--perf"
              : "player-inventory-panel__bg--full"
          }`}
        />
      )}
      <div className="player-inventory-panel__veil" />

      <div className="player-inventory-panel__body">
        <header className="player-inventory-panel__header">
          <div className="player-inventory-panel__identity">
            <div className="min-w-0 flex-1">
              <p className="player-inventory-panel__name">{player.name}</p>
              <p className="player-inventory-panel__agent">{agentName}</p>
            </div>
            <div className="player-inventory-panel__header-actions">
              {chatWidget}
              {onOpenMenu && (
                <button
                  type="button"
                  className="player-inventory-panel__menu-btn"
                  onClick={onOpenMenu}
                  aria-label="Game menu"
                  aria-expanded={menuOpen}
                  aria-controls="in-game-menu"
                >
                  <SettingsGearIcon className="h-5 w-5" />
                </button>
              )}
              {onClose && (
                <button
                  type="button"
                  className="player-inventory-panel__close"
                  onClick={onClose}
                  aria-label="Close inventory"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {rosterImage && (
            <div className="player-inventory-panel__roster-wrap">
              <img
                src={rosterImage}
                alt={agentName}
                className="player-inventory-panel__roster"
              />
            </div>
          )}
        </header>

        <div className="player-inventory-panel__economy">
          <div className="player-inventory-panel__stat">
            <img src="/points/Credits_icon.png" alt="" />
            <span>{player.creds}</span>
          </div>
          <div className="player-inventory-panel__stat player-inventory-panel__stat--rad">
            <img src="/points/Radianite_Points.png" alt="" />
            <span>{player.radianitePoints}</span>
          </div>
        </div>

        <div className="player-inventory-panel__ultimate">
          {ultimateDef ? (
            <HoverTooltip
              delayMs={ULTIMATE_TOOLTIP_DELAY_MS}
              className="player-inventory-panel__ultimate-art-tooltip"
              content={
                <span className="ultimate-meter__tooltip">
                  <strong className="ultimate-meter__tooltip-name">
                    {ultimateDef.name}
                  </strong>
                  <span className="ultimate-meter__tooltip-desc">
                    {ultimateDef.description}
                  </span>
                  <span className="ultimate-meter__tooltip-orbs">
                    Orbs {orbs}/{MAX_ULTIMATE_ORBS}
                    {ultReady ? " — ready" : ""}
                  </span>
                </span>
              }
            >
              <div
                className={`player-inventory-panel__ultimate-art ${
                  ultReady
                    ? "player-inventory-panel__ultimate-art--ready"
                    : ""
                }`}
              >
                {ultimateDef.icon ? (
                  <img
                    src={ultimateDef.icon}
                    alt={ultimateDef.name}
                    className="player-inventory-panel__ultimate-icon"
                  />
                ) : (
                  <span className="player-inventory-panel__ultimate-fallback">
                    {ultimateDef.name.charAt(0)}
                  </span>
                )}
              </div>
            </HoverTooltip>
          ) : (
            <span className="player-inventory-panel__ultimate-label">
              Ultimate
            </span>
          )}

          <div className="player-inventory-panel__ultimate-charges">
            <UltimateMeter orbs={orbs} showReadyLabel />
          </div>

          {canShowUltActivate && (
            <button
              type="button"
              className="player-inventory-panel__ult-btn"
              onClick={onActivateUltimate}
            >
              Activate Ultimate
            </button>
          )}
          <div className="player-inventory-panel__status-row">
            {player.ultimateStatus?.cloveShield && (
              <span className="player-status-chip player-status-chip--shield">
                Shield
              </span>
            )}
            {(player.ultimateStatus?.yoruDriftRounds ?? 0) > 0 && (
              <span className="player-status-chip player-status-chip--drift">
                Drift · {player.ultimateStatus?.yoruDriftRounds}
              </span>
            )}
            {(player.ultimateStatus?.reynaBuffRounds ?? 0) > 0 && (
              <span className="player-status-chip player-status-chip--empress">
                Empress · {player.ultimateStatus?.reynaBuffRounds}
              </span>
            )}
            {(player.ultimateStatus?.movementPenaltyTurns ?? 0) > 0 && (
              <span className="player-status-chip player-status-chip--breach">
                −{player.ultimateStatus?.movementPenalty ?? 1} move
              </span>
            )}
            {player.ultimateStatus?.neonOverdrive && (
              <span className="player-status-chip player-status-chip--overdrive">
                Overdrive
              </span>
            )}
            {player.ultimateStatus?.inViperPit && (
              <span className="player-status-chip player-status-chip--poison">
                In Pit
              </span>
            )}
            {player.ultimateStatus?.phoenixRunItBack && (
              <span className="player-status-chip player-status-chip--rewind">
                Run It Back
              </span>
            )}
            {itemsLocked && (
              <span className="player-status-chip player-status-chip--null">
                Items locked
              </span>
            )}
          </div>
        </div>

        {canOpenDice && onOpenDice && (
          <button
            type="button"
            className="player-inventory-panel__roll-btn"
            onClick={onOpenDice}
          >
            Roll dice
          </button>
        )}
        {diceHint && !canOpenDice && (
          <p className="player-inventory-panel__hint">{diceHint}</p>
        )}

        <section className="player-inventory-panel__section">
          <h3>Dice</h3>
          {(player.movementBonus ?? 0) > 0 && (
            <div className="player-inventory-panel__buff">
              +{player.movementBonus} on next movement roll
              {(player.movementBonusTurns ?? 0) > 0
                ? ` · ${player.movementBonusTurns} turn${
                    player.movementBonusTurns === 1 ? "" : "s"
                  }`
                : ""}
            </div>
          )}
          {diceItems.length === 0 && (player.movementBonus ?? 0) <= 0 ? (
            <p className="player-inventory-panel__empty">No dice items</p>
          ) : (
            <ul className="player-inventory-panel__list">
              {diceItems.map((item) => (
                <li key={item.id}>
                  <InventoryItemRow
                    item={item}
                    canAct={canAct}
                    usable={canAct && isUsableBoardItem(item)}
                    onUse={() => handleItemClick(item)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="player-inventory-panel__section">
          <h3>Special</h3>
          {specialItems.length === 0 ? (
            <p className="player-inventory-panel__empty">No special items</p>
          ) : (
            <ul className="player-inventory-panel__list">
              {specialItems.map((item) => (
                <li key={item.id}>
                  <InventoryItemRow
                    item={item}
                    canAct={canAct}
                    usable={canAct && isUsableBoardItem(item)}
                    pending={pendingTargetItemId === item.id}
                    onUse={() => handleItemClick(item)}
                  />
                </li>
              ))}
            </ul>
          )}
          {spikeItems.length > 0 && (
            <ul className="player-inventory-panel__list player-inventory-panel__list--spike">
              {spikeItems.map((item) => (
                <li key={item.id}>
                  <InventoryItemRow
                    item={item}
                    canAct={false}
                    usable={false}
                    badge="Defuse only"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {pendingItem && needsTarget(pendingItem) && canAct && (
          <section className="player-inventory-panel__section player-inventory-panel__section--target">
            <h3>Choose target</h3>
            <p className="player-inventory-panel__empty">
              {pendingItem.name} — pick a player
            </p>
            <div className="player-inventory-panel__targets">
              {otherPlayers.map((target) => (
                <button
                  key={target.index}
                  type="button"
                  className="player-inventory-panel__target-btn"
                  onClick={() =>
                    onUseItem?.({
                      kind: "use-with-target",
                      itemId: pendingItem.id,
                      targetPlayerIndex: target.index,
                    })
                  }
                >
                  {target.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="player-inventory-panel__cancel-target"
              onClick={onCancelTarget}
            >
              Cancel
            </button>
          </section>
        )}

        <section className="player-inventory-panel__section">
          <h3>Loadout</h3>
          <div className="player-inventory-panel__gear">
            <LoadoutSlot
              label="Shield"
              name={player.shield}
              image={shieldImage}
            />
            <LoadoutSlot
              label="Secondary"
              name={secondaryWeapon}
              image={secondaryImage}
            />
            <LoadoutSlot
              label="Primary"
              name={primaryWeapon}
              image={primaryImage}
            />
          </div>
          {player.nextWeaponDiscount > 0 && (
            <div className="player-inventory-panel__discount">
              Shop discount −{player.nextWeaponDiscount}
            </div>
          )}
        </section>

        <section className="player-inventory-panel__section">
          <h3>Spike planted</h3>
          {plantedSpike ? (
            <div
              className={`player-inventory-panel__spike-planted ${
                plantedSpike.status === "half-defused"
                  ? "player-inventory-panel__spike-planted--half"
                  : ""
              }`}
            >
              <p className="player-inventory-panel__spike-planted-title">
                {plantedSpike.status === "half-defused"
                  ? "Half-defused"
                  : "Active on map"}
              </p>
              <p className="player-inventory-panel__spike-planted-loc">
                {formatSpikeNodeLabel(plantedSpike.nodeId)}
              </p>
            </div>
          ) : (
            <div className="player-inventory-panel__spike-planted player-inventory-panel__spike-planted--empty">
              <p className="player-inventory-panel__spike-planted-title">
                No spike planted
              </p>
            </div>
          )}
        </section>

        {!canAct && isCurrentTurn && (
          <p className="player-inventory-panel__readonly">
            Viewing loadout — actions locked
          </p>
        )}
      </div>

      {showDebugButton && onToggleDebug && (
        <div className="player-inventory-panel__footer">
          <button
            type="button"
            className={`player-inventory-panel__debug-btn ${
              debugOpen ? "player-inventory-panel__debug-btn--active" : ""
            }`}
            onClick={onToggleDebug}
          >
            {debugOpen ? "Close Debug" : "Debug"}
          </button>
        </div>
      )}
    </div>
  );
}

function LoadoutSlot({
  label,
  name,
  image,
}: {
  label: string;
  name: string | null;
  image?: string;
}) {
  const equipped = Boolean(name);
  return (
    <div
      className={`player-inventory-panel__gear-slot ${
        equipped ? "" : "player-inventory-panel__gear-slot--empty"
      }`}
    >
      {equipped ? (
        <>
          <p className="player-inventory-panel__gear-label">{label}</p>
          <div className="player-inventory-panel__gear-body">
            {image ? <img src={image} alt="" /> : null}
            <span>{name}</span>
          </div>
        </>
      ) : (
        <div className="player-inventory-panel__gear-placeholder">{label}</div>
      )}
    </div>
  );
}

function InventoryItemRow({
  item,
  canAct,
  usable,
  pending,
  badge,
  onUse,
}: {
  item: ItemDefinition;
  canAct: boolean;
  usable: boolean;
  pending?: boolean;
  badge?: string;
  onUse?: () => void;
}) {
  return (
    <div
      className={`player-inventory-item ${
        pending ? "player-inventory-item--pending" : ""
      }`}
    >
      <div className="player-inventory-item__icon">
        {item.icon ? (
          <img src={item.icon} alt="" />
        ) : (
          <span>{item.name.charAt(0)}</span>
        )}
      </div>
      <div className="player-inventory-item__meta">
        <p className="player-inventory-item__name">{item.name}</p>
        <p className="player-inventory-item__desc">{item.description}</p>
        {badge && (
          <span className="player-inventory-item__badge">{badge}</span>
        )}
      </div>
      {usable && onUse ? (
        <button
          type="button"
          className="player-inventory-item__use"
          onClick={onUse}
        >
          Use
        </button>
      ) : canAct && !usable && !badge ? (
        <span className="player-inventory-item__locked">—</span>
      ) : null}
    </div>
  );
}

/**
 * Rotate turn-order seats so the active player is first, then upcoming
 * players left → right (wrapping around the turn cycle).
 */
export function rotatePlayersToActive(
  turnOrder: number[],
  activePlayerIndex: number
): number[] {
  if (turnOrder.length === 0) return [];
  const start = turnOrder.findIndex((index) => index === activePlayerIndex);
  if (start < 0) {
    return [...turnOrder];
  }
  return Array.from(
    { length: turnOrder.length },
    (_, i) => turnOrder[(start + i) % turnOrder.length]!
  );
}
