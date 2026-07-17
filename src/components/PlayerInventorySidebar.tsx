import type { PlayerInGame } from "../types/Game";
import { itemById, type ItemDefinition } from "../../shared/items";
import { weaponImageMap, shieldImageMap } from "../game/data/weaponImages";
import type { WeaponName } from "../game/systems/shopSystem";

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
  onClose?: () => void;
};

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
  onClose,
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
  const headshotImage = agentPortraitImage;

  function handleItemClick(item: ItemDefinition) {
    if (!canAct || !onUseItem || !isUsableBoardItem(item)) return;
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
              {isCurrentTurn && (
                <p className="player-inventory-panel__turn-tag">Active turn</p>
              )}
            </div>
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

          {headshotImage && (
            <div className="player-inventory-panel__headshot-wrap">
              <img
                src={headshotImage}
                alt={agentName}
                className="player-inventory-panel__headshot"
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
      <p className="player-inventory-panel__gear-label">{label}</p>
      <div className="player-inventory-panel__gear-body">
        {equipped && image ? (
          <img src={image} alt="" />
        ) : (
          <div className="player-inventory-panel__gear-placeholder" aria-hidden />
        )}
        <span>{equipped ? name : label}</span>
      </div>
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
