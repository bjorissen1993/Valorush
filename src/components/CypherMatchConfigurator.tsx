import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import {
  CUSTOM_MATCH_CATEGORY_LABELS,
  CYPHER_WEAPON_RULE_HINTS,
  CYPHER_WEAPON_RULE_LABELS,
  TDM_WEAPON_TIERS,
  customMatchRegistry,
  describeCypherWeaponRule,
  validateCypherTeamAssignment,
  type CypherMatchConfig,
  type CypherMatchup,
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

const MATCHUPS: { id: CypherMatchup; label: string; blurb: string }[] = [
  {
    id: "free_for_all",
    label: "Free for All",
    blurb: "Everyone for themselves — no team slots.",
  },
  {
    id: "2v2",
    label: "2v2",
    blurb: "Drag players into Team A and Team B.",
  },
  {
    id: "1v3",
    label: "1v3",
    blurb: "Drag one Solo vs a Team of 3.",
  },
];

const WEAPON_RULES: CypherWeaponRule[] = [
  "full_progression",
  "start_tier",
  "locked_tier",
];

type TeamBucket = "pool" | "alpha" | "bravo" | "solo" | "squad";

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
      className={`cypher-config__chip ${selected ? "cypher-config__chip--selected" : ""}`}
      title={player.name}
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
  hint,
}: {
  title: string;
  tone: "cyan" | "orange" | "red" | "emerald" | "zinc";
  children: ReactNode;
  onDropPlayer: () => void;
  onSelectSlot?: () => void;
  active?: boolean;
  hint: string;
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
      <p className="cypher-config__slot-hint">{hint}</p>
      <div className="cypher-config__slot-body">{children}</div>
    </div>
  );
}

/**
 * Cypher Neural Theft — configure the next custom match only.
 * Map cannot be changed here. Cancel spends no orbs.
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

  const draftConfig: CypherMatchConfig = {
    matchup,
    modeId,
    teamAlpha: matchup === "2v2" ? teamAlpha : undefined,
    teamBravo: matchup === "2v2" ? teamBravo : undefined,
    attackerIndex: matchup === "1v3" ? attackerIndex ?? undefined : undefined,
    defenderIndices: matchup === "1v3" ? defenderIndices : undefined,
    weaponRule,
    weaponTier: weaponRule === "full_progression" ? 1 : weaponTier,
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

  function removeFromAll(playerIndex: number) {
    setTeamAlpha((current) => current.filter((i) => i !== playerIndex));
    setTeamBravo((current) => current.filter((i) => i !== playerIndex));
    setDefenderIndices((current) => current.filter((i) => i !== playerIndex));
    setAttackerIndex((current) => (current === playerIndex ? null : current));
  }

  function placePlayer(playerIndex: number, bucket: TeamBucket) {
    removeFromAll(playerIndex);
    if (bucket === "pool") {
      setSelectedIndex(null);
      return;
    }
    if (bucket === "alpha") {
      setTeamAlpha((current) => [...current, playerIndex]);
    } else if (bucket === "bravo") {
      setTeamBravo((current) => [...current, playerIndex]);
    } else if (bucket === "solo") {
      setAttackerIndex(playerIndex);
    } else if (bucket === "squad") {
      setDefenderIndices((current) => [...current, playerIndex]);
    }
    setSelectedIndex(null);
  }

  function handleDrop(bucket: TeamBucket) {
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

  return (
    <div className="fixed inset-0 z-[85] flex animate-fadeIn items-center justify-center bg-black/70 p-4">
      <div className="ultimate-modal ultimate-modal--cypher">
        <div className="ultimate-modal__header">
          {ultimate.icon ? (
            <img src={ultimate.icon} alt="" className="ultimate-modal__icon" />
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Neural Theft
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">{ultimate.name}</h2>
          </div>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          Configure the next custom match only. Map cannot be changed. Cancel
          spends no orbs.
        </p>

        <div className="cypher-config mt-5 max-h-[62vh] space-y-5 overflow-y-auto pr-1">
          <section>
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
                  <span className="cypher-config__matchup-blurb">{entry.blurb}</span>
                </button>
              ))}
            </div>
          </section>

          {matchup !== "free_for_all" && (
            <section>
              <p className="cypher-config__label">Teams</p>
              <p className="mb-2 text-xs text-zinc-500">
                Drag player icons into slots, or tap a player then tap a slot.
                Every player must be assigned exactly once.
              </p>

              <div className="mb-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Unassigned
                </p>
                <div
                  className="cypher-config__pool"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDrop("pool");
                  }}
                >
                  {pool.length === 0 ? (
                    <span className="text-xs text-zinc-600">All players assigned</span>
                  ) : (
                    pool.map((player) => (
                      <PlayerChip
                        key={player.index}
                        player={player}
                        draggable
                        selected={selectedIndex === player.index}
                        onDragStart={(event) => {
                          setDraggingIndex(player.index);
                          event.dataTransfer.setData(
                            "text/plain",
                            String(player.index)
                          );
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => handleChipClick(player.index)}
                      />
                    ))
                  )}
                </div>
              </div>

              {matchup === "2v2" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <DropSlot
                    title="Team A"
                    tone="cyan"
                    hint="Drop players here"
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
                        onDragStart={(event) => {
                          setDraggingIndex(player.index);
                          event.dataTransfer.setData(
                            "text/plain",
                            String(player.index)
                          );
                        }}
                        onClick={() => handleChipClick(player.index)}
                      />
                    ))}
                  </DropSlot>
                  <DropSlot
                    title="Team B"
                    tone="orange"
                    hint="Drop players here"
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
                        onDragStart={(event) => {
                          setDraggingIndex(player.index);
                          event.dataTransfer.setData(
                            "text/plain",
                            String(player.index)
                          );
                        }}
                        onClick={() => handleChipClick(player.index)}
                      />
                    ))}
                  </DropSlot>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <DropSlot
                    title="Solo"
                    tone="red"
                    hint="One attacker"
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
                          onDragStart={(event) => {
                            setDraggingIndex(player.index);
                            event.dataTransfer.setData(
                              "text/plain",
                              String(player.index)
                            );
                          }}
                          onClick={() => handleChipClick(player.index)}
                        />
                      ))}
                  </DropSlot>
                  <DropSlot
                    title="Team of 3"
                    tone="emerald"
                    hint="Defending squad"
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
                        onDragStart={(event) => {
                          setDraggingIndex(player.index);
                          event.dataTransfer.setData(
                            "text/plain",
                            String(player.index)
                          );
                        }}
                        onClick={() => handleChipClick(player.index)}
                      />
                    ))}
                  </DropSlot>
                </div>
              )}

              {validationError && (
                <p className="mt-2 text-xs font-medium text-amber-300/90">
                  {validationError}
                </p>
              )}
            </section>
          )}

          <section>
            <p className="cypher-config__label">Gamemode</p>
            <p className="mb-2 text-xs text-zinc-500">
              {CUSTOM_MATCH_CATEGORY_LABELS[matchup]} modes from the custom match
              registry.
            </p>
            <div className="cypher-config__mode-grid">
              {availableModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={`cypher-config__mode ${
                    modeId === mode.id ? "cypher-config__mode--active" : ""
                  }`}
                  onClick={() => setModeId(mode.id)}
                >
                  <span className="cypher-config__mode-name">{mode.name}</span>
                  <span className="cypher-config__mode-meta">{mode.playerFormat}</span>
                  <span className="cypher-config__mode-desc">{mode.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="cypher-config__label">Weapons</p>
            <p className="mb-2 text-xs text-zinc-500">
              Team Deathmatch–style tiers. Operator and Odin are excluded.
            </p>
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
                  <span className="font-semibold text-white">
                    {CYPHER_WEAPON_RULE_LABELS[rule]}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-zinc-400">
                    {CYPHER_WEAPON_RULE_HINTS[rule]}
                  </span>
                </button>
              ))}
            </div>

            {weaponRule !== "full_progression" && (
              <div className="mt-3 flex flex-wrap gap-2">
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
                    T{tier.tier} · {tier.name}
                  </button>
                ))}
              </div>
            )}

            <div className="cypher-config__tier-list mt-3">
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
                      Tier {tier.tier} — {tier.name}
                    </p>
                    <p className="cypher-config__tier-card-weapons">
                      {tier.weapons.join(" · ")}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-cyan-300/80">
              {describeCypherWeaponRule(
                weaponRule,
                weaponRule === "full_progression" ? 1 : weaponTier
              )}
            </p>
          </section>

          <section className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
              Map
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              Locked — Cypher cannot change the scheduled map.
            </p>
          </section>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="ultimate-modal__btn ultimate-modal__btn--primary flex-1 disabled:opacity-40"
            disabled={!canConfirm}
            onClick={() => onConfirm(draftConfig)}
          >
            Confirm — Spend 3 Orbs
          </button>
          <button
            type="button"
            className="ultimate-modal__btn flex-1"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
