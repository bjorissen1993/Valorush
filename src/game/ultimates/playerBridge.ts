import type { PlayerInGame } from "../../types/Game";
import {
  createEmptyPlayerUltimateStatus,
  type BoardUltimateState,
  type UltimatePlayerState,
} from "../../../shared/ultimates";
import { ensureUltimateStatus, clampOrbs } from "./orbs";

export function toUltimatePlayerState(player: PlayerInGame): UltimatePlayerState {
  return {
    id: player.id,
    slotIndex: player.slotIndex,
    name: player.name,
    selectedAgentId: player.selectedAgentId,
    position: player.position,
    creds: player.creds,
    radianitePoints: player.radianitePoints,
    items: [...(player.items ?? [])],
    ultimateOrbs: clampOrbs(player.ultimateOrbs ?? 0),
    status: ensureUltimateStatus(player.ultimateStatus),
    movementBonus: player.movementBonus ?? 0,
    movementBonusTurns: player.movementBonusTurns ?? 0,
    maxStepsPerTurn: player.maxStepsPerTurn ?? null,
    maxStepsTurns: player.maxStepsTurns ?? 0,
  };
}

export function mergeUltimateIntoPlayer(
  player: PlayerInGame,
  ult: UltimatePlayerState
): PlayerInGame {
  return {
    ...player,
    position: ult.position,
    creds: ult.creds,
    radianitePoints: ult.radianitePoints,
    items: ult.items,
    ultimateOrbs: clampOrbs(ult.ultimateOrbs),
    ultimateStatus: ensureUltimateStatus(ult.status),
    movementBonus: ult.movementBonus,
    movementBonusTurns: ult.movementBonusTurns,
    maxStepsPerTurn: ult.maxStepsPerTurn,
    maxStepsTurns: ult.maxStepsTurns,
  };
}

export function mergeUltimatePlayers(
  players: PlayerInGame[],
  ultPlayers: UltimatePlayerState[]
): PlayerInGame[] {
  return players.map((player, index) => {
    const ult = ultPlayers[index];
    return ult ? mergeUltimateIntoPlayer(player, ult) : player;
  });
}

export function withDefaultUltimateFields(player: PlayerInGame): PlayerInGame {
  return {
    ...player,
    ultimateOrbs: clampOrbs(player.ultimateOrbs ?? 0),
    ultimateStatus:
      player.ultimateStatus ?? createEmptyPlayerUltimateStatus(),
  };
}

export type { BoardUltimateState };
