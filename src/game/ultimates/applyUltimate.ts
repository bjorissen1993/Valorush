import {
  ULTIMATE_BOARD_PATHS,
  createEmptyPlayerUltimateStatus,
  getUltimateForAgent,
  type BoardUltimateState,
  type UltimateApplyInput,
  type UltimateApplyResult,
  type UltimatePlayerState,
  type PlayerUltimateStatus,
} from "../../../shared/ultimates";
import { spendUltimate, clampOrbs } from "./orbs";
import {
  boardDistance,
  collectConnectedZone,
  getAdjacentNodeIds,
  moveBackSpaces,
  moveTowardNode,
} from "./boardHelpers";
import {
  applyNegativeEffect,
  isUntargetable,
  tryConsumeCloveShield,
} from "./negativeEffects";
import {
  stealCredits,
  stealRadianite,
  formatStealMessage,
  CHAMBER_LOOT_FALLBACK_CREDS,
} from "../economy";
import { tileIdsInArea, AREA_RADIUS } from "./areaTargeting";
import { getNodeById } from "../boardLayout";

function newActivationId(): string {
  return `ult-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function clonePlayers(players: UltimatePlayerState[]): UltimatePlayerState[] {
  return players.map((p) => ({
    ...p,
    items: [...p.items],
    status: { ...p.status },
  }));
}

function cloneBoard(board: BoardUltimateState): BoardUltimateState {
  return {
    poisonClouds: board.poisonClouds.map((c) => ({
      ...c,
      nodeIds: c.nodeIds ? [...c.nodeIds] : undefined,
    })),
    walls: board.walls.map((w) => ({ ...w })),
    traps: board.traps.map((t) => ({ ...t })),
    detainZones: (board.detainZones ?? []).map((z) => ({ ...z })),
    killjoyDevices: (board.killjoyDevices ?? []).map((d) => ({
      ...d,
      nodeIds: [...d.nodeIds],
    })),
    slowZones: (board.slowZones ?? []).map((z) => ({ ...z })),
  };
}

function applyNegativeToPlayer(
  player: UltimatePlayerState,
  apply: (p: UltimatePlayerState) => void
): boolean {
  return applyNegativeEffect(player, apply).applied;
}

function loseRandomItem(player: UltimatePlayerState): string | null {
  if (player.items.length === 0) return null;
  const idx = Math.floor(Math.random() * player.items.length);
  const [item] = player.items.splice(idx, 1);
  return item ?? null;
}

function clearStatusEffects(status: PlayerUltimateStatus): PlayerUltimateStatus {
  return {
    ...createEmptyPlayerUltimateStatus(),
    // Keep beneficial buffs the player intentionally armed this turn.
    phoenixRunItBack: status.phoenixRunItBack,
    turnStartPosition: status.turnStartPosition,
    neonOverdrive: status.neonOverdrive,
    reynaBuffRounds: status.reynaBuffRounds,
    yoruDriftRounds: status.yoruDriftRounds,
    cloveShield: status.cloveShield,
  };
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function incompleteResult(
  input: UltimateApplyInput,
  headline: string,
  description: string
): UltimateApplyResult {
  return {
    players: input.players,
    board: input.board,
    headline,
    description,
    positionChanges: [],
    incomplete: true,
  };
}

/**
 * Apply an agent ultimate. Caller must verify orbs === 3 and spend them
 * (this function spends on success). Missing targets return `incomplete`
 * without spending orbs.
 */
export function applyUltimate(input: UltimateApplyInput): UltimateApplyResult {
  const def = getUltimateForAgent(input.agentName);
  const players = clonePlayers(input.players);
  const board = cloneBoard(input.board);
  const caster = players[input.casterPlayerIndex];

  if (!caster) {
    return incompleteResult(input, "Ultimate failed", "Caster not found.");
  }

  if (!def) {
    return incompleteResult(
      input,
      "Ultimate failed",
      `No ultimate registered for ${input.agentName}.`
    );
  }

  if (def.implementation === "stub") {
    caster.ultimateOrbs = spendUltimate(caster.ultimateOrbs);
    return {
      players,
      board,
      headline: def.name,
      description: `${def.name} is not playable yet — orbs consumed as a placeholder.`,
      positionChanges: [],
      stub: true,
    };
  }

  if (caster.ultimateOrbs < 3) {
    // Sova follow-up shots reuse the same cast (orbs already spent).
    const sovaFollowUp =
      def.id === "hunters-fury" &&
      input.sovaShotsRemaining != null &&
      input.sovaShotsRemaining < 3;
    if (!sovaFollowUp) {
      return incompleteResult(
        input,
        "Ultimate not ready",
        "Need 3/3 ultimate orbs."
      );
    }
  }

  // Validate required targeting before spending orbs.
  switch (def.id) {
    case "orbital-strike":
    case "vipers-pit":
    case "lockdown": {
      const hasArea =
        (input.areaNodeIds && input.areaNodeIds.length > 0) ||
        Boolean(input.targetNodeId);
      if (!hasArea) {
        return incompleteResult(input, def.name, "Place the area on the board.");
      }
      break;
    }
    case "from-the-shadows":
    case "steel-garden":
    case "thrash":
    case "armageddon":
      if (!input.targetNodeId) {
        return incompleteResult(input, def.name, "Pick a tile.");
      }
      break;
    case "hunters-fury": {
      if (!input.targetNodeId && !input.targetPlayerIndex && !input.choiceId) {
        return incompleteResult(input, def.name, "Aim a shot.");
      }
      break;
    }
    case "reckoning":
    case "saturating-fire": {
      const pathId = input.choiceId ?? input.targetNodeId;
      const path =
        ULTIMATE_BOARD_PATHS.find((p) => p.id === pathId) ??
        input.paths.find((p) => p.id === pathId);
      if (!path) {
        return incompleteResult(input, def.name, "Pick a path to fire along.");
      }
      break;
    }
    case "neural-theft":
      // Match configurator — allow empty config (uses defaults).
      break;
    case "run-it-back":
    case "resurrection":
      // Reactive arm — no target required.
      break;
    case "showstopper":
    case "tour-de-force":
    case "annihilation":
    case "kill-contract":
      if (
        input.targetPlayerIndex == null ||
        input.targetPlayerIndex === input.casterPlayerIndex
      ) {
        return incompleteResult(input, def.name, "Pick a target.");
      }
      break;
    case "cosmic-divide-ult":
      if (!input.targetNodeId || !input.targetNodeId2) {
        return incompleteResult(
          input,
          def.name,
          "Pick a connected path edge to wall off."
        );
      }
      break;
    default:
      break;
  }

  // Spend orbs only on confirm of a fresh cast (not Sova follow-up shots).
  const sovaFollowUp =
    def.id === "hunters-fury" &&
    input.sovaShotsRemaining != null &&
    input.sovaShotsRemaining < 3;
  if (!sovaFollowUp) {
    caster.ultimateOrbs = spendUltimate(caster.ultimateOrbs);
  }
  const positionChanges: UltimateApplyResult["positionChanges"] = [];
  const activationId = input.activationId ?? newActivationId();

  switch (def.id) {
    case "orbital-strike": {
      const centerId = input.targetNodeId;
      const centerNode = centerId ? getNodeById(centerId) : null;
      const radius = def.areaRadius ?? AREA_RADIUS.brimstone;
      const damage = def.creditDamage ?? 400;
      const affected = new Set(
        input.areaNodeIds?.length
          ? input.areaNodeIds
          : centerNode
            ? tileIdsInArea({
                center: { x: centerNode.x, y: centerNode.y },
                radius,
              })
            : centerId
              ? [centerId, ...getAdjacentNodeIds(centerId)]
              : []
      );
      const hitParts: string[] = [];
      for (let i = 0; i < players.length; i += 1) {
        if (i === input.casterPlayerIndex) continue;
        const p = players[i]!;
        if (!affected.has(p.position)) continue;
        applyNegativeToPlayer(p, (target) => {
          const stolen = stealCredits(target.creds, caster.creds, damage);
          target.creds = stolen.fromCredsAfter;
          caster.creds = stolen.toCredsAfter;
          hitParts.push(formatStealMessage(target.name, stolen));
        });
      }
      return {
        players,
        board,
        headline: "Orbital Strike",
        description:
          hitParts.length > 0
            ? `Orbital strike: ${hitParts.join("; ")}.`
            : "Orbital strike — no agents in the blast.",
        positionChanges,
      };
    }

    case "vipers-pit": {
      const centerId = input.targetNodeId!;
      const centerNode = getNodeById(centerId);
      const radius = def.areaRadius ?? AREA_RADIUS.viper;
      const nodeIds = input.areaNodeIds?.length
        ? input.areaNodeIds
        : centerNode
          ? tileIdsInArea({
              center: { x: centerNode.x, y: centerNode.y },
              radius,
            })
          : [centerId];
      board.poisonClouds = [
        {
          nodeId: centerId,
          nodeIds,
          roundsLeft: 1,
          ownerPlayerIndex: input.casterPlayerIndex,
          activationId,
          movementDebuff: 2,
        },
      ];
      for (const p of players) {
        const inZone = nodeIds.includes(p.position);
        p.status = {
          ...p.status,
          inViperPit: inZone && p !== caster,
        };
      }
      return {
        players,
        board,
        headline: "Viper's Pit",
        description: `Poison zone covers ${nodeIds.length} tiles for 1 round (−2 move once per cast).`,
        positionChanges: [],
      };
    }

    case "from-the-shadows": {
      const dest = input.targetNodeId!;
      const from = caster.position;
      caster.position = dest;
      if (from !== dest) {
        positionChanges.push({
          playerIndex: input.casterPlayerIndex,
          fromNodeId: from,
          toNodeId: dest,
        });
      }
      return {
        players,
        board,
        headline: "From The Shadows",
        description: `Omen emerges on ${dest}. Turn ends — landing not activated.`,
        positionChanges,
        endTurnImmediately: true,
        skipLandingActivation: true,
      };
    }

    case "lockdown": {
      const centerId = input.targetNodeId!;
      const centerNode = getNodeById(centerId);
      const radius = def.areaRadius ?? AREA_RADIUS.killjoy;
      const nodeIds = input.areaNodeIds?.length
        ? input.areaNodeIds
        : centerNode
          ? tileIdsInArea({
              center: { x: centerNode.x, y: centerNode.y },
              radius,
            })
          : [centerId];
      board.killjoyDevices = [
        ...(board.killjoyDevices ?? []).filter(
          (d) => d.ownerPlayerIndex !== input.casterPlayerIndex
        ),
        {
          centerNodeId: centerId,
          nodeIds,
          ownerPlayerIndex: input.casterPlayerIndex,
          activationId,
          detonateOnOwnerTurn: true,
          armed: true,
        },
      ];
      return {
        players,
        board,
        headline: "Lockdown",
        description: `Device armed on ${centerId} (${nodeIds.length} tiles). Detonates at the start of your next turn.`,
        positionChanges: [],
      };
    }

    case "neural-theft": {
      const config = input.cypherMatchConfig ?? {
        matchup: "standard",
        teams: "auto",
        mode: "Spike Rush",
        weapons: "standard",
        agents: "all",
        modifiers: [],
      };
      return {
        players,
        board,
        headline: "Neural Theft",
        description: `Next custom match configured: ${config.mode} (${config.matchup}). Resets after that match.`,
        positionChanges: [],
        cypherMatchConfig: config,
      };
    }

    case "hunters-fury": {
      const damage = def.creditDamage ?? 250;
      // First shot starts at 3; each apply consumes one.
      const shotsBefore = input.sovaShotsRemaining ?? 3;
      const remaining = Math.max(0, shotsBefore - 1);
      const parts: string[] = [];
      const hitIndices = new Set<number>();

      if (input.targetPlayerIndex != null) {
        hitIndices.add(input.targetPlayerIndex);
      } else if (input.targetNodeId) {
        for (let i = 0; i < players.length; i += 1) {
          if (i === input.casterPlayerIndex) continue;
          if (players[i]!.position === input.targetNodeId) hitIndices.add(i);
        }
      } else {
        const pathId = input.choiceId;
        const path =
          ULTIMATE_BOARD_PATHS.find((p) => p.id === pathId) ??
          input.paths.find((p) => p.id === pathId);
        if (path) {
          const hitSet = new Set(path.nodeIds);
          for (let i = 0; i < players.length; i += 1) {
            if (i === input.casterPlayerIndex) continue;
            if (hitSet.has(players[i]!.position)) hitIndices.add(i);
          }
        }
      }

      for (const i of hitIndices) {
        const p = players[i]!;
        applyNegativeToPlayer(p, (target) => {
          const stolen = stealCredits(target.creds, caster.creds, damage);
          target.creds = stolen.fromCredsAfter;
          caster.creds = stolen.toCredsAfter;
          target.status = {
            ...target.status,
            revealedRounds: Math.max(target.status.revealedRounds ?? 0, 1),
          };
          parts.push(
            `${formatStealMessage(target.name, stolen)}; Revealed 1 round`
          );
        });
      }

      // Only spend orbs on first shot — already spent above. Subsequent shots
      // should be called with ultimateOrbs already 0; re-grant temporarily if needed.
      return {
        players,
        board,
        headline: "Hunter's Fury",
        description:
          parts.length > 0
            ? `Shot hits: ${parts.join("; ")}.${remaining > 0 ? ` ${remaining} shot(s) left.` : ""}`
            : `Shot missed.${remaining > 0 ? ` ${remaining} shot(s) left.` : ""}`,
        positionChanges: [],
        sovaShotsRemaining: remaining,
      };
    }

    case "resurrection": {
      caster.status = {
        ...caster.status,
        reactiveUltArmed: true,
        reactiveUltAgent: "Sage",
        reactiveSnapshot: null,
      };
      return {
        players,
        board,
        headline: "Resurrection",
        description:
          "Reactive ultimate armed. When a negative effect hits you, choose to fully roll it back.",
        positionChanges: [],
      };
    }

    case "run-it-back": {
      caster.status = {
        ...caster.status,
        reactiveUltArmed: true,
        reactiveUltAgent: "Phoenix",
        reactiveSnapshot: null,
        // Keep legacy post-turn restore as secondary option.
        phoenixRunItBack: true,
        turnStartPosition: caster.position,
      };
      return {
        players,
        board,
        headline: "Run It Back",
        description:
          "Reactive ultimate armed. Negatives can be fully rolled back. Post-turn restore also available.",
        positionChanges: [],
        awaitPhoenixChoice: true,
      };
    }

    case "blade-storm": {
      const rolls = input.diceRolls?.length
        ? input.diceRolls
        : [rollDie(), rollDie()];
      const steps = Math.max(rolls[0] ?? 1, rolls[1] ?? 1);
      return {
        players,
        board,
        headline: "Blade Storm",
        description: `Rolled ${rolls.join(" & ")} — moving ${steps}. Opponents passed pay 200.`,
        positionChanges: [],
        jettMoveSteps: steps,
      };
    }

    case "empress": {
      caster.status = { ...caster.status, reynaBuffRounds: 3 };
      return {
        players,
        board,
        headline: "Empress",
        description: "Next 3 rounds: double minigame rewards, ignore minigame penalties.",
        positionChanges: [],
      };
    }

    case "showstopper": {
      const targetIdx = input.targetPlayerIndex!;
      const target = players[targetIdx]!;
      const mode =
        input.razeMode ?? (input.choiceId === "spaces" ? "spaces" : "creds");
      if (isUntargetable(target) || tryConsumeCloveShield(target)) {
        return {
          players,
          board,
          headline: "Showstopper",
          description: `${target.name} avoided the blast.`,
          positionChanges: [],
        };
      }
      if (mode === "spaces") {
        const from = target.position;
        target.position = moveBackSpaces(target.position, 4);
        if (from !== target.position) {
          positionChanges.push({
            playerIndex: targetIdx,
            fromNodeId: from,
            toNodeId: target.position,
          });
        }
        return {
          players,
          board,
          headline: "Showstopper",
          description: `${target.name} blasted back to ${target.position}.`,
          positionChanges,
        };
      }
      target.creds = Math.max(0, target.creds - 600);
      return {
        players,
        board,
        headline: "Showstopper",
        description: `${target.name} loses 600 creds.`,
        positionChanges: [],
      };
    }

    case "rolling-thunder": {
      const names: string[] = [];
      for (let i = 0; i < players.length; i += 1) {
        if (i === input.casterPlayerIndex) continue;
        const p = players[i]!;
        applyNegativeToPlayer(p, (target) => {
          target.status = {
            ...target.status,
            movementPenalty: 1,
            movementPenaltyTurns: 1,
          };
          names.push(target.name);
        });
      }
      return {
        players,
        board,
        headline: "Rolling Thunder",
        description:
          names.length > 0
            ? `${names.join(", ")}: −1 movement next turn.`
            : "No opponents affected.",
        positionChanges: [],
      };
    }

    case "seekers": {
      const opponents = players
        .map((_, i) => i)
        .filter((i) => i !== input.casterPlayerIndex);
      const parts: string[] = [];
      for (let s = 0; s < 3; s += 1) {
        if (opponents.length === 0) break;
        const idx = opponents[Math.floor(Math.random() * opponents.length)]!;
        const p = players[idx]!;
        applyNegativeToPlayer(p, (target) => {
          if (Math.random() < 0.5) {
            const item = loseRandomItem(target);
            if (item) {
              caster.items = [...caster.items, item];
              parts.push(`Seeker stole ${item} from ${target.name}`);
            } else {
              target.creds = Math.max(0, target.creds - 200);
              parts.push(`${target.name} −200 creds (no item)`);
            }
          } else {
            target.creds = Math.max(0, target.creds - 200);
            parts.push(`${target.name} −200 creds`);
          }
        });
      }
      return {
        players,
        board,
        headline: "Seekers",
        description: parts.join(". ") || "Seekers found nothing.",
        positionChanges: [],
      };
    }

    case "dimensional-drift": {
      caster.status = { ...caster.status, yoruDriftRounds: 2 };
      return {
        players,
        board,
        headline: "Dimensional Drift",
        description:
          "Untargetable for 2 rounds. Ignore negatives and pass through walls.",
        positionChanges: [],
      };
    }

    case "cosmic-divide-ult": {
      const from = input.targetNodeId!;
      const to = input.targetNodeId2!;
      board.walls = board.walls.filter(
        (w) =>
          !(
            (w.fromNodeId === from && w.toNodeId === to) ||
            (w.fromNodeId === to && w.toNodeId === from)
          )
      );
      board.walls.push({
        fromNodeId: from,
        toNodeId: to,
        roundsLeft: 2,
        ownerPlayerIndex: input.casterPlayerIndex,
      });
      return {
        players,
        board,
        headline: "Cosmic Divide",
        description: `Wall blocks ${from} ↔ ${to} for 2 rounds.`,
        positionChanges: [],
      };
    }

    case "null-cmd": {
      const range = def.rangeTiles ?? 3;
      const names: string[] = [];
      for (let i = 0; i < players.length; i += 1) {
        if (i === input.casterPlayerIndex) continue;
        const p = players[i]!;
        const dist = boardDistance(caster.position, p.position);
        if (dist > range) continue;
        applyNegativeToPlayer(p, (target) => {
          target.status = { ...target.status, itemsLockedTurns: 1 };
          names.push(target.name);
        });
      }
      return {
        players,
        board,
        headline: "NULL/CMD",
        description:
          names.length > 0
            ? `${names.join(", ")} cannot use items next turn.`
            : "No opponents in range.",
        positionChanges: [],
      };
    }

    case "tour-de-force": {
      const targetIdx = input.targetPlayerIndex!;
      const target = players[targetIdx]!;
      if (isUntargetable(target)) {
        return {
          players,
          board,
          headline: "Tour de Force",
          description: `${target.name} is untargetable.`,
          positionChanges: [],
        };
      }

      // Slow zone on target's tile.
      board.slowZones = [
        ...(board.slowZones ?? []).filter((z) => z.nodeId !== target.position),
        {
          nodeId: target.position,
          roundsLeft: 1,
          ownerPlayerIndex: input.casterPlayerIndex,
          activationId,
          movementDebuff: 2,
        },
      ];

      // Weighted loot wheel — segments proportional to holdings.
      const radAvailable = Math.max(0, target.radianitePoints);
      const segments: { id: string; label: string; weight: number }[] = [
        {
          id: "creds-small",
          label: "Steal 500 creds",
          weight: Math.max(1, Math.floor(target.creds / 500)),
        },
        {
          id: "creds-large",
          label: "Steal 1500 creds",
          weight: Math.max(1, Math.floor(target.creds / 1500)),
        },
        {
          id: "rad-1",
          label: "Steal 1 radianite",
          weight: radAvailable > 0 ? radAvailable * 3 : 0,
        },
        {
          id: "rad-all",
          label: "Steal all radianite",
          weight: radAvailable > 0 ? radAvailable : 0,
        },
        {
          id: "fallback",
          label: `Fallback +${CHAMBER_LOOT_FALLBACK_CREDS} creds`,
          weight: radAvailable === 0 ? 4 : 1,
        },
      ].filter((s) => s.weight > 0);

      const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
      let pick = Math.random() * totalWeight;
      let chosen = segments[segments.length - 1]!;
      for (const seg of segments) {
        pick -= seg.weight;
        if (pick <= 0) {
          chosen = seg;
          break;
        }
      }
      if (input.chamberLootId) {
        chosen = segments.find((s) => s.id === input.chamberLootId) ?? chosen;
      }

      let credsStolen = 0;
      let radStolen = 0;
      let intendedCreds = 0;
      let intendedRadianite = 0;

      applyNegativeToPlayer(target, (t) => {
        if (chosen.id === "creds-small") {
          intendedCreds = 500;
          const r = stealCredits(t.creds, caster.creds, 500);
          t.creds = r.fromCredsAfter;
          caster.creds = r.toCredsAfter;
          credsStolen = r.actual;
        } else if (chosen.id === "creds-large") {
          intendedCreds = 1500;
          const r = stealCredits(t.creds, caster.creds, 1500);
          t.creds = r.fromCredsAfter;
          caster.creds = r.toCredsAfter;
          credsStolen = r.actual;
        } else if (chosen.id === "rad-1") {
          intendedRadianite = 1;
          const r = stealRadianite(t.radianitePoints, caster.radianitePoints, 1);
          t.radianitePoints = r.fromCredsAfter;
          caster.radianitePoints = r.toCredsAfter;
          radStolen = r.actual;
          if (r.actual === 0) {
            intendedCreds = CHAMBER_LOOT_FALLBACK_CREDS;
            const fallback = stealCredits(
              t.creds,
              caster.creds,
              CHAMBER_LOOT_FALLBACK_CREDS
            );
            t.creds = fallback.fromCredsAfter;
            caster.creds = fallback.toCredsAfter;
            credsStolen = fallback.actual;
          }
        } else if (chosen.id === "rad-all") {
          intendedRadianite = t.radianitePoints;
          const r = stealRadianite(
            t.radianitePoints,
            caster.radianitePoints,
            t.radianitePoints
          );
          t.radianitePoints = r.fromCredsAfter;
          caster.radianitePoints = r.toCredsAfter;
          radStolen = r.actual;
        } else {
          intendedCreds = CHAMBER_LOOT_FALLBACK_CREDS;
          caster.creds += CHAMBER_LOOT_FALLBACK_CREDS;
          credsStolen = CHAMBER_LOOT_FALLBACK_CREDS;
        }
      });

      return {
        players,
        board,
        headline: "Tour de Force",
        description: `Slow Zone on ${target.position}. Loot: ${chosen.label} (creds ${credsStolen}/${intendedCreds}, rad ${radStolen}/${intendedRadianite}).`,
        positionChanges: [],
        chamberLoot: {
          segmentId: chosen.id,
          label: chosen.label,
          credsStolen,
          radianiteStolen: radStolen,
          intendedCreds,
          intendedRadianite,
          targetPlayerIndex: targetIdx,
          targetName: target.name,
          segments,
        },
      };
    }

    case "overdrive": {
      caster.status = { ...caster.status, neonOverdrive: true };
      return {
        players,
        board,
        headline: "Overdrive",
        description: "Next movement is doubled.",
        positionChanges: [],
      };
    }

    case "nightfall": {
      const names: string[] = [];
      for (let i = 0; i < players.length; i += 1) {
        if (i === input.casterPlayerIndex) continue;
        const p = players[i]!;
        applyNegativeToPlayer(p, (target) => {
          target.ultimateOrbs = clampOrbs(target.ultimateOrbs - 1);
          names.push(target.name);
        });
      }
      return {
        players,
        board,
        headline: "Nightfall",
        description:
          names.length > 0
            ? `${names.join(", ")} lost 1 ultimate orb.`
            : "No opponents affected.",
        positionChanges: [],
      };
    }

    case "not-dead-yet": {
      caster.status = { ...caster.status, cloveShield: true };
      return {
        players,
        board,
        headline: "Not Dead Yet",
        description: "Next negative effect will be ignored once.",
        positionChanges: [],
      };
    }

    case "steel-garden": {
      const nodeId = input.targetNodeId!;
      board.traps = board.traps.filter((t) => t.nodeId !== nodeId);
      board.traps.push({
        nodeId,
        ownerPlayerIndex: input.casterPlayerIndex,
        armed: true,
      });
      return {
        players,
        board,
        headline: "Steel Garden",
        description: `Trap armed on ${nodeId}. First visitor ends movement.`,
        positionChanges: [],
      };
    }

    case "reckoning": {
      const pathId = input.choiceId ?? input.targetNodeId;
      const path =
        ULTIMATE_BOARD_PATHS.find((p) => p.id === pathId) ??
        input.paths.find((p) => p.id === pathId)!;
      const hitSet = new Set(path.nodeIds);
      const parts: string[] = [];
      for (let i = 0; i < players.length; i += 1) {
        if (i === input.casterPlayerIndex) continue;
        const p = players[i]!;
        if (!hitSet.has(p.position)) continue;
        applyNegativeToPlayer(p, (target) => {
          target.creds = Math.max(0, target.creds - 200);
          target.status = {
            ...target.status,
            movementPenalty: 1,
            movementPenaltyTurns: 1,
          };
          parts.push(`${target.name} −200 & −1 move`);
        });
      }
      return {
        players,
        board,
        headline: "Reckoning",
        description:
          parts.length > 0
            ? `Cascade along ${path.label}: ${parts.join("; ")}.`
            : `Cascade along ${path.label} — no one caught.`,
        positionChanges: [],
      };
    }

    case "thrash": {
      const nodeId = input.targetNodeId!;
      board.detainZones = (board.detainZones ?? []).filter(
        (z) => z.nodeId !== nodeId
      );
      board.detainZones.push({
        nodeId,
        ownerPlayerIndex: input.casterPlayerIndex,
        armed: true,
      });
      return {
        players,
        board,
        headline: "Thrash",
        description: `Thrash waits on ${nodeId}. First opponent detained.`,
        positionChanges: [],
      };
    }

    case "annihilation": {
      const targetIdx = input.targetPlayerIndex!;
      const target = players[targetIdx]!;
      if (isUntargetable(target) || tryConsumeCloveShield(target)) {
        return {
          players,
          board,
          headline: "Annihilation",
          description: `${target.name} escaped the pull.`,
          positionChanges: [],
        };
      }
      const from = target.position;
      const to = caster.position;
      const result = applyNegativeEffect(target, (t) => {
        t.position = to;
      });
      if (from !== target.position) {
        positionChanges.push({
          playerIndex: targetIdx,
          fromNodeId: from,
          toNodeId: target.position,
        });
      }
      return {
        players,
        board,
        headline: "Annihilation",
        description: `Pulled ${target.name} to ${to}. Landing not activated.${
          result.deferredReactive ? " Reactive ultimate pending…" : ""
        }`,
        positionChanges,
        skipLandingActivation: true,
        awaitReactivePrompt: result.deferredReactive
          ? {
              playerIndex: targetIdx,
              agent: target.status.reactiveUltAgent ?? "Phoenix",
            }
          : undefined,
      };
    }

    case "kill-contract": {
      const targetIdx = input.targetPlayerIndex!;
      const target = players[targetIdx]!;
      if (isUntargetable(target)) {
        return {
          players,
          board,
          headline: "Kill Contract",
          description: `${target.name} is untargetable.`,
          positionChanges: [],
        };
      }
      const casterRoll = input.diceRolls?.[0] ?? rollDie();
      const targetRoll = input.diceRolls?.[1] ?? rollDie();
      const winnerIdx =
        casterRoll >= targetRoll ? input.casterPlayerIndex : targetIdx;
      const loserIdx =
        winnerIdx === input.casterPlayerIndex
          ? targetIdx
          : input.casterPlayerIndex;
      players[winnerIdx]!.creds += 400;
      players[loserIdx]!.ultimateOrbs = clampOrbs(
        players[loserIdx]!.ultimateOrbs - 1
      );
      return {
        players,
        board,
        headline: "Kill Contract",
        description: `${players[input.casterPlayerIndex]!.name} ${casterRoll} vs ${target.name} ${targetRoll}. ${players[winnerIdx]!.name} wins +400; ${players[loserIdx]!.name} −1 orb.`,
        positionChanges: [],
        chamberDuel: {
          casterRoll,
          targetRoll,
          winnerPlayerIndex: winnerIdx,
        },
      };
    }

    case "armageddon": {
      const center = input.targetNodeId!;
      const zone = collectConnectedZone(center, 3);
      const hitNames: string[] = [];
      for (let i = 0; i < players.length; i += 1) {
        if (i === input.casterPlayerIndex) continue;
        const p = players[i]!;
        if (!zone.has(p.position)) continue;
        applyNegativeToPlayer(p, (target) => {
          target.creds = Math.max(0, target.creds - 350);
          hitNames.push(target.name);
        });
      }
      return {
        players,
        board,
        headline: "Armageddon",
        description:
          hitNames.length > 0
            ? `Zone blast hits ${hitNames.join(", ")} — −350 creds.`
            : `Armageddon marks ${[...zone].join(", ")} — no one hit.`,
        positionChanges: [],
      };
    }

    case "saturating-fire": {
      const pathId = input.choiceId ?? input.targetNodeId;
      const path =
        ULTIMATE_BOARD_PATHS.find((p) => p.id === pathId) ??
        input.paths.find((p) => p.id === pathId)!;
      const hitSet = new Set(path.nodeIds);
      const parts: string[] = [];
      for (let i = 0; i < players.length; i += 1) {
        if (i === input.casterPlayerIndex) continue;
        const p = players[i]!;
        if (!hitSet.has(p.position)) continue;
        applyNegativeToPlayer(p, (target) => {
          const item = loseRandomItem(target);
          if (item) {
            parts.push(`${target.name} discarded ${item}`);
          } else {
            target.creds = Math.max(0, target.creds - 150);
            parts.push(`${target.name} −150 creds`);
          }
        });
      }
      return {
        players,
        board,
        headline: "Saturating Fire",
        description:
          parts.length > 0
            ? `Spray along ${path.label}: ${parts.join("; ")}.`
            : `Spray along ${path.label} — no one hit.`,
        positionChanges: [],
      };
    }

    default:
      return {
        players,
        board,
        headline: def.name,
        description: "Ultimate resolved.",
        positionChanges: [],
      };
  }
}

/** Apply Jett Blade Storm pass toll after movement. */
export function applyJettPassToll(
  players: UltimatePlayerState[],
  casterPlayerIndex: number,
  passedOpponentIndices: number[]
): { players: UltimatePlayerState[]; description: string } {
  const next = clonePlayers(players);
  const caster = next[casterPlayerIndex];
  if (!caster) return { players, description: "" };
  const unique = [...new Set(passedOpponentIndices)];
  const names: string[] = [];
  for (const idx of unique) {
    if (idx === casterPlayerIndex) continue;
    const p = next[idx];
    if (!p) continue;
    applyNegativeToPlayer(p, (target) => {
      const paid = Math.min(200, target.creds);
      target.creds -= paid;
      caster.creds += paid;
      names.push(target.name);
    });
  }
  return {
    players: next,
    description:
      names.length > 0
        ? `Blade Storm: ${names.join(", ")} paid 200.`
        : "Blade Storm: no opponents passed.",
  };
}
