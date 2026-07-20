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
  getAdjacentNodeIds,
  moveBackSpaces,
} from "./boardHelpers";

function clonePlayers(players: UltimatePlayerState[]): UltimatePlayerState[] {
  return players.map((p) => ({
    ...p,
    items: [...p.items],
    status: { ...p.status },
  }));
}

function cloneBoard(board: BoardUltimateState): BoardUltimateState {
  return {
    poisonClouds: board.poisonClouds.map((c) => ({ ...c })),
    walls: board.walls.map((w) => ({ ...w })),
    traps: board.traps.map((t) => ({ ...t })),
  };
}

function isUntargetable(player: UltimatePlayerState): boolean {
  return (player.status.yoruDriftRounds ?? 0) > 0;
}

function tryConsumeCloveShield(player: UltimatePlayerState): boolean {
  if (!player.status.cloveShield) return false;
  player.status = { ...player.status, cloveShield: false };
  return true;
}

function applyNegativeToPlayer(
  player: UltimatePlayerState,
  apply: (p: UltimatePlayerState) => void
): boolean {
  if (isUntargetable(player)) return false;
  if (tryConsumeCloveShield(player)) return false;
  apply(player);
  return true;
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
    return incompleteResult(
      input,
      "Ultimate not ready",
      "Need 3/3 ultimate orbs."
    );
  }

  // Validate required targeting before spending orbs.
  switch (def.id) {
    case "orbital-strike":
    case "vipers-pit":
    case "from-the-shadows":
    case "steel-garden":
      if (!input.targetNodeId) {
        return incompleteResult(input, def.name, "Pick a tile.");
      }
      break;
    case "hunters-fury": {
      const pathId = input.choiceId ?? input.targetNodeId;
      const path =
        ULTIMATE_BOARD_PATHS.find((p) => p.id === pathId) ??
        input.paths.find((p) => p.id === pathId);
      if (!path) {
        return incompleteResult(input, def.name, "Pick a path to fire along.");
      }
      break;
    }
    case "resurrection":
      if (
        input.choiceId !== "to-start" &&
        input.choiceId !== "extra-turn" &&
        input.choiceId !== "cleanse"
      ) {
        return incompleteResult(input, def.name, "Choose an effect.");
      }
      break;
    case "showstopper":
    case "tour-de-force":
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

  caster.ultimateOrbs = spendUltimate(caster.ultimateOrbs);
  const positionChanges: UltimateApplyResult["positionChanges"] = [];

  switch (def.id) {
    case "orbital-strike": {
      const center = input.targetNodeId!;
      const affected = new Set([center, ...getAdjacentNodeIds(center)]);
      const hitNames: string[] = [];
      for (let i = 0; i < players.length; i += 1) {
        if (i === input.casterPlayerIndex) continue;
        const p = players[i]!;
        if (!affected.has(p.position)) continue;
        applyNegativeToPlayer(p, (target) => {
          const from = target.position;
          target.creds = Math.max(0, target.creds - 300);
          target.position = moveBackSpaces(target.position, 2);
          if (from !== target.position) {
            positionChanges.push({
              playerIndex: i,
              fromNodeId: from,
              toNodeId: target.position,
            });
          }
          hitNames.push(target.name);
        });
      }
      return {
        players,
        board,
        headline: "Orbital Strike",
        description:
          hitNames.length > 0
            ? `Strike hits ${hitNames.join(", ")} — −300 creds, back 2.`
            : `Orbital strike on ${center} — no agents in the blast.`,
        positionChanges,
      };
    }

    case "vipers-pit": {
      const nodeId = input.targetNodeId!;
      board.poisonClouds = board.poisonClouds.filter((c) => c.nodeId !== nodeId);
      board.poisonClouds.push({
        nodeId,
        roundsLeft: 1,
        ownerPlayerIndex: input.casterPlayerIndex,
      });
      return {
        players,
        board,
        headline: "Viper's Pit",
        description: `Poison cloud covers ${nodeId} for 1 round. Half movement while inside.`,
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
        description: `Omen emerges on ${dest}. Mini-move up to ${def.miniMoveSteps ?? 3} spaces.`,
        positionChanges,
        omenMiniMoveSteps: def.miniMoveSteps ?? 3,
      };
    }

    case "lockdown": {
      const choices = input.opponentChoices ?? {};
      const parts: string[] = [];
      for (let i = 0; i < players.length; i += 1) {
        if (i === input.casterPlayerIndex) continue;
        const p = players[i]!;
        if (isUntargetable(p)) {
          parts.push(`${p.name} drifted away`);
          continue;
        }
        if (tryConsumeCloveShield(p)) {
          parts.push(`${p.name}'s shield held`);
          continue;
        }
        const choice = choices[i] ?? (p.creds >= 300 ? "pay" : "skip");
        if (choice === "pay" && p.creds >= 300) {
          p.creds -= 300;
          parts.push(`${p.name} paid 300`);
        } else {
          p.status = { ...p.status, skipNextTurn: true };
          parts.push(`${p.name} will skip next turn`);
        }
      }
      return {
        players,
        board,
        headline: "Lockdown",
        description: parts.join(". ") || "No opponents affected.",
        positionChanges: [],
      };
    }

    case "neural-theft": {
      const reveal = {
        players: players
          .map((p, playerIndex) => ({
            playerIndex,
            name: p.name,
            creds: p.creds,
            items: [...p.items],
            ultimateOrbs: p.ultimateOrbs,
          }))
          .filter((p) => p.playerIndex !== input.casterPlayerIndex),
      };
      const stealIdx = input.stealFromPlayerIndex ?? input.targetPlayerIndex;
      let stealMsg = "Intel gathered.";
      if (stealIdx != null && stealIdx !== input.casterPlayerIndex) {
        const victim = players[stealIdx];
        if (victim && !isUntargetable(victim) && !tryConsumeCloveShield(victim)) {
          const stolen = loseRandomItem(victim);
          if (stolen) {
            caster.items = [...caster.items, stolen];
            stealMsg = `Stole ${stolen} from ${victim.name}.`;
          } else {
            stealMsg = `${victim.name} had no items to steal.`;
          }
        }
      }
      return {
        players,
        board,
        headline: "Neural Theft",
        description: stealMsg,
        positionChanges: [],
        cypherReveal: reveal,
      };
    }

    case "hunters-fury": {
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
            parts.push(`${target.name} lost ${item}`);
          } else {
            target.creds = Math.max(0, target.creds - 250);
            parts.push(`${target.name} −250 creds`);
          }
        });
      }
      return {
        players,
        board,
        headline: "Hunter's Fury",
        description:
          parts.length > 0
            ? `Bolt along ${path.label}: ${parts.join("; ")}.`
            : `Bolt along ${path.label} — no one in the lane.`,
        positionChanges: [],
      };
    }

    case "resurrection": {
      const choice = input.choiceId;
      if (choice === "to-start") {
        const from = caster.position;
        caster.position = "start";
        if (from !== "start") {
          positionChanges.push({
            playerIndex: input.casterPlayerIndex,
            fromNodeId: from,
            toNodeId: "start",
          });
        }
        return {
          players,
          board,
          headline: "Resurrection",
          description: `${caster.name} returns to Start.`,
          positionChanges,
        };
      }
      if (choice === "extra-turn") {
        caster.status = {
          ...caster.status,
          skipNextTurn: false,
          extraTurnPending: true,
        };
        return {
          players,
          board,
          headline: "Resurrection",
          description: `${caster.name} will take an extra turn.`,
          positionChanges: [],
        };
      }
      // cleanse
      caster.status = clearStatusEffects(caster.status);
      return {
        players,
        board,
        headline: "Resurrection",
        description: `${caster.name}'s status effects were cleared.`,
        positionChanges: [],
      };
    }

    case "run-it-back": {
      caster.status = {
        ...caster.status,
        phoenixRunItBack: true,
        turnStartPosition: caster.position,
      };
      return {
        players,
        board,
        headline: "Run It Back",
        description:
          "After this turn, choose to keep your end position or return to turn start.",
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
      const casterRoll = input.diceRolls?.[0] ?? rollDie();
      const targetRoll = input.diceRolls?.[1] ?? rollDie();
      const winnerIdx =
        casterRoll >= targetRoll ? input.casterPlayerIndex : targetIdx;
      players[winnerIdx]!.creds += 500;
      return {
        players,
        board,
        headline: "Tour de Force",
        description: `${players[input.casterPlayerIndex]!.name} rolled ${casterRoll}, ${target.name} rolled ${targetRoll}. ${players[winnerIdx]!.name} wins +500.`,
        positionChanges: [],
        chamberDuel: {
          casterRoll,
          targetRoll,
          winnerPlayerIndex: winnerIdx,
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
