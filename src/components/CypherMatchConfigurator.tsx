import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import {
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
import FitText from "./FitText";

export type CypherConfiguratorPlayer = {
  index: number;
  name: string;
  avatar?: string;
  /** Agent display name for team-slot player cards. */
  agentName?: string;
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

/** UI selection: all weapons, or one locked tier (1–4). */
type WeaponSelection = "all" | 1 | 2 | 3 | 4;

function modesForMatchup(matchup: CypherMatchup) {
  return customMatchRegistry.filter((entry) => entry.category === matchup);
}

function selectionToRule(selection: WeaponSelection): {
  weaponRule: CypherWeaponRule;
  weaponTier: number;
} {
  if (selection === "all") {
    return { weaponRule: "all", weaponTier: 1 };
  }
  return { weaponRule: "tier", weaponTier: selection };
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

/** Compact lobby-style card for team slots / FFA preview (avatar + name + agent). */
function PlayerCard({
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
  const agentLabel = player.agentName?.trim() || "No agent";
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`cypher-config__player-card ${
        selected ? "cypher-config__player-card--selected" : ""
      } ${draggable ? "" : "cypher-config__player-card--static"}`}
      title={`${player.name} · ${agentLabel}`}
      style={draggable ? undefined : { cursor: "default" }}
    >
      {player.avatar ? (
        <img
          src={player.avatar}
          alt=""
          className="cypher-config__player-card-avatar"
        />
      ) : (
        <span className="cypher-config__player-card-fallback">
          {player.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="cypher-config__player-card-meta">
        <FitText
          text={player.name}
          className="cypher-config__player-card-name"
        />
        <FitText
          text={agentLabel}
          className="cypher-config__player-card-agent"
        />
      </span>
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
 * Vertical stack: matchup → gamemodes → teams → weapons → confirm.
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
  const [weaponSelection, setWeaponSelection] = useState<WeaponSelection>("all");
  const [teamAlpha, setTeamAlpha] = useState<number[]>([]);
  const [teamBravo, setTeamBravo] = useState<number[]>([]);
  const [attackerIndex, setAttackerIndex] = useState<number | null>(null);
  const [defenderIndices, setDefenderIndices] = useState<number[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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
  const showUnassigned = matchup !== "free_for_all" && pool.length > 0;

  const weaponPayload = showWeapons
    ? selectionToRule(weaponSelection)
    : { weaponRule: "all" as const, weaponTier: 1 };

  const draftConfig: CypherMatchConfig = {
    matchup,
    modeId,
    teamAlpha: matchup === "2v2" ? teamAlpha : undefined,
    teamBravo: matchup === "2v2" ? teamBravo : undefined,
    attackerIndex: matchup === "1v3" ? attackerIndex ?? undefined : undefined,
    defenderIndices: matchup === "1v3" ? defenderIndices : undefined,
    weaponRule: weaponPayload.weaponRule,
    weaponTier: weaponPayload.weaponTier,
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

          <section className="cypher-config__panel cypher-config__panel--modes">
            <p className="cypher-config__label">Gamemodes</p>
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
                const splashPath = getMapSplashPath(mode.uiSplashMap);
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
                      <PlayerCard player={player} draggable={false} />
                    </DropSlot>
                  ))}
                </div>
              ) : (
                <>
                  <div
                    className={`cypher-config__reveal ${
                      showUnassigned
                        ? "cypher-config__reveal--open"
                        : "cypher-config__reveal--closed"
                    }`}
                    aria-hidden={!showUnassigned}
                  >
                    <div className="cypher-config__reveal-inner">
                      <p className="cypher-config__sublabel">Unassigned</p>
                      <div
                        className="cypher-config__pool"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleDrop("pool");
                        }}
                      >
                        {pool.map((player) => (
                          <PlayerChip
                            key={player.index}
                            player={player}
                            draggable
                            selected={selectedIndex === player.index}
                            onDragStart={bindChipDrag(player.index)}
                            onClick={() => handleChipClick(player.index)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {matchup === "2v2" ? (
                    <div className="cypher-config__slots">
                      <DropSlot
                        title="Team Alpha"
                        tone="red"
                        active={selectedIndex != null}
                        onDropPlayer={() => handleDrop("alpha")}
                        onSelectSlot={() => {
                          if (selectedIndex != null) placePlayer(selectedIndex, "alpha");
                        }}
                      >
                        {playersFromIndices(teamAlpha).map((player) => (
                          <PlayerCard
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
                        title="Team Bravo"
                        tone="emerald"
                        active={selectedIndex != null}
                        onDropPlayer={() => handleDrop("bravo")}
                        onSelectSlot={() => {
                          if (selectedIndex != null) placePlayer(selectedIndex, "bravo");
                        }}
                      >
                        {playersFromIndices(teamBravo).map((player) => (
                          <PlayerCard
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
                            <PlayerCard
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
                          <PlayerCard
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

          <div
            className={`cypher-config__reveal ${
              showWeapons
                ? "cypher-config__reveal--open"
                : "cypher-config__reveal--closed"
            }`}
            aria-hidden={!showWeapons}
          >
            <div className="cypher-config__reveal-inner">
              <section className="cypher-config__panel cypher-config__panel--weapons">
                <div className="cypher-config__weapons-head">
                  <p className="cypher-config__label cypher-config__label--inline">
                    Weapons
                  </p>
                  <p className="cypher-config__weapon-summary">
                    {describeCypherWeaponRule(
                      weaponPayload.weaponRule,
                      weaponPayload.weaponTier
                    )}
                  </p>
                </div>

                <div className="cypher-config__weapon-pick">
                  <button
                    type="button"
                    className={`cypher-config__weapon-opt cypher-config__weapon-opt--all ${
                      weaponSelection === "all"
                        ? "cypher-config__weapon-opt--active"
                        : ""
                    }`}
                    onClick={() => setWeaponSelection("all")}
                  >
                    All Weapons
                  </button>
                  {TDM_WEAPON_TIERS.map((tier) => {
                    const lit =
                      weaponSelection === "all" || weaponSelection === tier.tier;
                    return (
                      <button
                        key={tier.tier}
                        type="button"
                        className={`cypher-config__weapon-opt ${
                          lit ? "cypher-config__weapon-opt--active" : ""
                        }`}
                        onClick={() => setWeaponSelection(tier.tier as 1 | 2 | 3 | 4)}
                      >
                        <span className="cypher-config__weapon-opt-tier">
                          T{tier.tier}
                        </span>
                        <span className="cypher-config__weapon-opt-name">
                          {tier.name}
                        </span>
                        <span className="cypher-config__weapon-opt-list">
                          {tier.weapons.join(" · ")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
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
