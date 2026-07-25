import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import {
  CYPHER_WEAPON_RULE_LABELS,
  TDM_WEAPON_TIERS,
  customMatchRegistry,
  cypherModeAllowsWeaponConfig,
  describeCypherWeaponRule,
  getMapSplashPath,
  placeCypherPlayer,
  validateCypherTeamAssignment,
  type CypherMatchConfig,
  type CypherMatchup,
  type CypherTeamBucket,
  type CypherWeaponRule,
  type CustomMatchId,
} from "../../shared/customMatches";
import type { UltimateDefinition } from "../../shared/ultimates";

export type CypherConfiguratorPlayer = {
  index: number;
  name: string;
  avatar?: string;
};

type CypherMatchConfiguratorProps = {
  ultimate: UltimateDefinition;
  players: CypherConfiguratorPlayer[];
  onConfirm: (config: CypherMatchConfig) => void;
  onCancel: () => void;
};

const MATCHUPS: { id: CypherMatchup; label: string }[] = [
  { id: "free_for_all", label: "Free for All" },
  { id: "2v2", label: "2v2" },
  { id: "1v3", label: "1v3" },
];

const WEAPON_RULES: CypherWeaponRule[] = [
  "full_progression",
  "start_tier",
  "locked_tier",
];

function modesForMatchup(matchup: CypherMatchup) {
  return customMatchRegistry.filter((entry) => entry.category === matchup);
}

function PlayerChip({
  player,
  draggable,
  onDragStart,
  onClick,
  selected,
}: {
  player: CypherConfiguratorPlayer;
  draggable: boolean;
  onDragStart?: (event: DragEvent) => void;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`cypher-config__chip ${selected ? "cypher-config__chip--selected" : ""} ${
        draggable ? "" : "cypher-config__chip--static"
      }`}
      title={player.name}
      style={draggable ? undefined : { cursor: "default" }}
    >
      {player.avatar ? (
        <img src={player.avatar} alt="" className="cypher-config__chip-avatar" />
      ) : (
        <span className="cypher-config__chip-fallback">
          {player.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="cypher-config__chip-name">{player.name}</span>
    </button>
  );
}

function DropSlot({
  title,
  tone,
  children,
  onDropPlayer,
  onSelectSlot,
  active,
}: {
  title: string;
  tone: "cyan" | "orange" | "red" | "emerald" | "slate";
  children: ReactNode;
  onDropPlayer: () => void;
  onSelectSlot?: () => void;
  active?: boolean;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`cypher-config__slot cypher-config__slot--${tone} ${
        over ? "cypher-config__slot--over" : ""
      } ${active ? "cypher-config__slot--active" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onDropPlayer();
      }}
      onClick={onSelectSlot}
    >
      <p className="cypher-config__slot-title">{title}</p>
      <div className="cypher-config__slot-body">{children}</div>
    </div>
  );
}

/**
 * Cypher Neural Theft — configure the next custom match only.
 * Map cannot be changed here. Cancel spends no orbs.
 * Vertical stack: matchup → teams → modes → weapons → confirm.
 */
export default function CypherMatchConfigurator({
  ultimate,
  players,
  onConfirm,
  onCancel,
}: CypherMatchConfiguratorProps) {
  const [matchup, setMatchup] = useState<CypherMatchup>("free_for_all");
  const availableModes = useMemo(() => modesForMatchup(matchup), [matchup]);
  const [modeId, setModeId] = useState<CustomMatchId>(
    () => modesForMatchup("free_for_all")[0]?.id ?? "deathmatch"
  );
  const [weaponRule, setWeaponRule] =
    useState<CypherWeaponRule>("full_progression");
  const [weaponTier, setWeaponTier] = useState(1);
  const [teamAlpha, setTeamAlpha] = useState<number[]>([]);
  const [teamBravo, setTeamBravo] = useState<number[]>([]);
  const [attackerIndex, setAttackerIndex] = useState<number | null>(null);
  const [defenderIndices, setDefenderIndices] = useState<number[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const needsTeams = matchup !== "free_for_all";
  const showWeapons = cypherModeAllowsWeaponConfig(modeId);

  const assigned = useMemo(() => {
    if (matchup === "2v2") return new Set([...teamAlpha, ...teamBravo]);
    if (matchup === "1v3") {
      const set = new Set(defenderIndices);
      if (attackerIndex != null) set.add(attackerIndex);
      return set;
    }
    return new Set<number>();
  }, [matchup, teamAlpha, teamBravo, attackerIndex, defenderIndices]);

  const pool = players.filter((player) => !assigned.has(player.index));

  const effectiveWeaponRule: CypherWeaponRule = showWeapons
    ? weaponRule
    : "full_progression";
  const effectiveWeaponTier =
    showWeapons && weaponRule !== "full_progression" ? weaponTier : 1;

  const draftConfig: CypherMatchConfig = {
    matchup,
    modeId,
    teamAlpha: matchup === "2v2" ? teamAlpha : undefined,
    teamBravo: matchup === "2v2" ? teamBravo : undefined,
    attackerIndex: matchup === "1v3" ? attackerIndex ?? undefined : undefined,
    defenderIndices: matchup === "1v3" ? defenderIndices : undefined,
    weaponRule: effectiveWeaponRule,
    weaponTier: effectiveWeaponTier,
  };

  const validationError =
    matchup === "free_for_all"
      ? null
      : validateCypherTeamAssignment(draftConfig, players.length);

  const canConfirm = !validationError && availableModes.some((m) => m.id === modeId);

  function clearTeams() {
    setTeamAlpha([]);
    setTeamBravo([]);
    setAttackerIndex(null);
    setDefenderIndices([]);
    setSelectedIndex(null);
    setDraggingIndex(null);
  }

  function selectMatchup(next: CypherMatchup) {
    setMatchup(next);
    const modes = modesForMatchup(next);
    setModeId(modes[0]?.id ?? "deathmatch");
    clearTeams();
  }

  function placePlayer(playerIndex: number, bucket: CypherTeamBucket) {
    const next = placeCypherPlayer(
      { teamAlpha, teamBravo, attackerIndex, defenderIndices },
      playerIndex,
      bucket
    );
    setTeamAlpha(next.teamAlpha);
    setTeamBravo(next.teamBravo);
    setAttackerIndex(next.attackerIndex);
    setDefenderIndices(next.defenderIndices);
    setSelectedIndex(null);
  }

  function handleDrop(bucket: CypherTeamBucket) {
    const index = draggingIndex ?? selectedIndex;
    if (index == null) return;
    placePlayer(index, bucket);
    setDraggingIndex(null);
  }

  function handleChipClick(playerIndex: number) {
    setSelectedIndex((current) => (current === playerIndex ? null : playerIndex));
  }

  function playersFromIndices(indices: number[]) {
    return indices
      .map((index) => players.find((player) => player.index === index))
      .filter((player): player is CypherConfiguratorPlayer => !!player);
  }

  function bindChipDrag(playerIndex: number) {
    return (event: DragEvent) => {
      setDraggingIndex(playerIndex);
      event.dataTransfer.setData("text/plain", String(playerIndex));
      event.dataTransfer.effectAllowed = "move";
    };
  }

  return (
    <div className="fixed inset-0 z-[85] flex animate-fadeIn items-center justify-center bg-black/75 p-2 sm:p-3">
      <div className="ultimate-modal ultimate-modal--cypher">
        <div className="ultimate-modal__header cypher-config__header">
          {ultimate.icon ? (
            <img src={ultimate.icon} alt="" className="ultimate-modal__icon cypher-config__icon" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="cypher-config__eyebrow">Neural Theft</p>
            <h2 className="cypher-config__title">{ultimate.name}</h2>
            <p className="cypher-config__lead">
              Next custom match only — cancel spends no orbs.
            </p>
          </div>
        </div>

        <div className="cypher-config cypher-config--board">
          <section className="cypher-config__panel cypher-config__panel--matchup">
            <p className="cypher-config__label">Matchup</p>
            <div className="cypher-config__matchup-grid">
              {MATCHUPS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`cypher-config__matchup ${
                    matchup === entry.id ? "cypher-config__matchup--active" : ""
                  }`}
                  onClick={() => selectMatchup(entry.id)}
                >
                  <span className="cypher-config__matchup-title">{entry.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="cypher-config__panel cypher-config__panel--teams">
            <p className="cypher-config__label">
              {matchup === "free_for_all" ? "Team Preview" : "Teams"}
            </p>

            <div className="cypher-config__teams-body">
              {matchup === "free_for_all" ? (
                <div className="cypher-config__ffa-preview">
                  {players.map((player) => (
                    <DropSlot
                      key={player.index}
                      title="Solo"
                      tone="slate"
                      onDropPlayer={() => undefined}
                    >
                      <PlayerChip player={player} draggable={false} />
                    </DropSlot>
                  ))}
                </div>
              ) : (
                <>
                  <div>
                    <p className="cypher-config__sublabel">Unassigned</p>
                    <div
                      className="cypher-config__pool"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDrop("pool");
                      }}
                    >
                      {pool.length === 0 ? (
                        <span className="cypher-config__pool-empty">
                          All players assigned
                        </span>
                      ) : (
                        pool.map((player) => (
                          <PlayerChip
                            key={player.index}
                            player={player}
                            draggable
                            selected={selectedIndex === player.index}
                            onDragStart={bindChipDrag(player.index)}
                            onClick={() => handleChipClick(player.index)}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {matchup === "2v2" ? (
                    <div className="cypher-config__slots">
                      <DropSlot
                        title="Team A"
                        tone="cyan"
                        active={selectedIndex != null}
                        onDropPlayer={() => handleDrop("alpha")}
                        onSelectSlot={() => {
                          if (selectedIndex != null) placePlayer(selectedIndex, "alpha");
                        }}
                      >
                        {playersFromIndices(teamAlpha).map((player) => (
                          <PlayerChip
                            key={player.index}
                            player={player}
                            draggable
                            selected={selectedIndex === player.index}
                            onDragStart={bindChipDrag(player.index)}
                            onClick={() => handleChipClick(player.index)}
                          />
                        ))}
                      </DropSlot>
                      <DropSlot
                        title="Team B"
                        tone="orange"
                        active={selectedIndex != null}
                        onDropPlayer={() => handleDrop("bravo")}
                        onSelectSlot={() => {
                          if (selectedIndex != null) placePlayer(selectedIndex, "bravo");
                        }}
                      >
                        {playersFromIndices(teamBravo).map((player) => (
                          <PlayerChip
                            key={player.index}
                            player={player}
                            draggable
                            selected={selectedIndex === player.index}
                            onDragStart={bindChipDrag(player.index)}
                            onClick={() => handleChipClick(player.index)}
                          />
                        ))}
                      </DropSlot>
                    </div>
                  ) : (
                    <div className="cypher-config__slots">
                      <DropSlot
                        title="Solo"
                        tone="red"
                        active={selectedIndex != null}
                        onDropPlayer={() => handleDrop("solo")}
                        onSelectSlot={() => {
                          if (selectedIndex != null) placePlayer(selectedIndex, "solo");
                        }}
                      >
                        {attackerIndex != null &&
                          playersFromIndices([attackerIndex]).map((player) => (
                            <PlayerChip
                              key={player.index}
                              player={player}
                              draggable
                              selected={selectedIndex === player.index}
                              onDragStart={bindChipDrag(player.index)}
                              onClick={() => handleChipClick(player.index)}
                            />
                          ))}
                      </DropSlot>
                      <DropSlot
                        title="Team of 3"
                        tone="emerald"
                        active={selectedIndex != null}
                        onDropPlayer={() => handleDrop("squad")}
                        onSelectSlot={() => {
                          if (selectedIndex != null) placePlayer(selectedIndex, "squad");
                        }}
                      >
                        {playersFromIndices(defenderIndices).map((player) => (
                          <PlayerChip
                            key={player.index}
                            player={player}
                            draggable
                            selected={selectedIndex === player.index}
                            onDragStart={bindChipDrag(player.index)}
                            onClick={() => handleChipClick(player.index)}
                          />
                        ))}
                      </DropSlot>
                    </div>
                  )}

                  {validationError && (
                    <p className="cypher-config__error">{validationError}</p>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="cypher-config__panel cypher-config__panel--modes">
            <p className="cypher-config__label">Gamemode</p>
            <div
              className={`cypher-config__mode-grid ${
                availableModes.length <= 2
                  ? "cypher-config__mode-grid--few"
                  : availableModes.length <= 4
                    ? "cypher-config__mode-grid--mid"
                    : "cypher-config__mode-grid--many"
              }`}
            >
              {availableModes.map((mode) => {
                const splashMap = mode.eligibleMaps[0];
                const splashPath = splashMap
                  ? getMapSplashPath(splashMap)
                  : undefined;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    className={`cypher-config__mode ${
                      modeId === mode.id ? "cypher-config__mode--active" : ""
                    }`}
                    onClick={() => setModeId(mode.id)}
                  >
                    {splashPath ? (
                      <span
                        className="cypher-config__mode-bg"
                        style={{ backgroundImage: `url(${splashPath})` }}
                        aria-hidden
                      />
                    ) : null}
                    <span className="cypher-config__mode-veil" aria-hidden />
                    <span className="cypher-config__mode-name">{mode.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {showWeapons && (
            <section className="cypher-config__panel cypher-config__panel--weapons">
              <div className="cypher-config__weapons-head">
                <p className="cypher-config__label cypher-config__label--inline">
                  Weapons
                </p>
                <p className="cypher-config__weapon-summary">
                  {describeCypherWeaponRule(
                    weaponRule,
                    weaponRule === "full_progression" ? 1 : weaponTier
                  )}
                </p>
              </div>

              <div className="cypher-config__weapons-row">
                <div className="cypher-config__rule-grid">
                  {WEAPON_RULES.map((rule) => (
                    <button
                      key={rule}
                      type="button"
                      className={`cypher-config__rule ${
                        weaponRule === rule ? "cypher-config__rule--active" : ""
                      }`}
                      onClick={() => setWeaponRule(rule)}
                    >
                      {CYPHER_WEAPON_RULE_LABELS[rule]}
                    </button>
                  ))}
                </div>

                {weaponRule !== "full_progression" && (
                  <div className="cypher-config__tier-grid">
                    {TDM_WEAPON_TIERS.map((tier) => (
                      <button
                        key={tier.tier}
                        type="button"
                        className={`cypher-config__tier-btn ${
                          weaponTier === tier.tier
                            ? "cypher-config__tier-btn--active"
                            : ""
                        }`}
                        onClick={() => setWeaponTier(tier.tier)}
                      >
                        <span>T{tier.tier}</span>
                        <span>{tier.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="cypher-config__tier-list">
                {TDM_WEAPON_TIERS.map((tier) => {
                  const emphasized =
                    weaponRule === "full_progression" ||
                    (weaponRule === "start_tier" && tier.tier <= weaponTier) ||
                    (weaponRule === "locked_tier" && tier.tier === weaponTier);
                  return (
                    <div
                      key={tier.tier}
                      className={`cypher-config__tier-card ${
                        emphasized ? "cypher-config__tier-card--on" : ""
                      }`}
                    >
                      <p className="cypher-config__tier-card-title">
                        T{tier.tier} · {tier.name}
                      </p>
                      <p className="cypher-config__tier-card-weapons">
                        {tier.weapons.join(" · ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="cypher-config__actions">
          <button
            type="button"
            className="ultimate-modal__btn cypher-config__btn-confirm disabled:opacity-40"
            disabled={!canConfirm}
            onClick={() => onConfirm(draftConfig)}
          >
            Confirm — Spend 3 Orbs
          </button>
          <button
            type="button"
            className="ultimate-modal__btn cypher-config__btn-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
