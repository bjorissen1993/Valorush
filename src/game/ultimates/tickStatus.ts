import {
  createEmptyBoardUltimateState,
  type BoardUltimateState,
  type PlayerUltimateStatus,
  type UltimatePlayerState,
} from "../../../shared/ultimates";
import { ensureUltimateStatus } from "./orbs";
import { isInPoisonCloud } from "./boardHelpers";

/** Tick board hazards at round wrap (poison/walls countdown). */
export function tickBoardUltimateState(
  board: BoardUltimateState
): BoardUltimateState {
  return {
    poisonClouds: board.poisonClouds
      .map((c) => ({ ...c, roundsLeft: c.roundsLeft - 1 }))
      .filter((c) => c.roundsLeft > 0),
    walls: board.walls
      .map((w) => ({ ...w, roundsLeft: w.roundsLeft - 1 }))
      .filter((w) => w.roundsLeft > 0),
    traps: board.traps.filter((t) => t.armed),
    detainZones: (board.detainZones ?? []).filter((z) => z.armed),
  };
}

/**
 * Tick per-player ultimate status at the start of their turn.
 * Also syncs inViperPit from board clouds.
 */
export function tickPlayerUltimateStatus(
  status: PlayerUltimateStatus,
  position: string,
  board: BoardUltimateState
): PlayerUltimateStatus {
  let next = ensureUltimateStatus(status);

  if (next.reynaBuffRounds > 0) {
    next = { ...next, reynaBuffRounds: next.reynaBuffRounds - 1 };
  }
  if (next.yoruDriftRounds > 0) {
    next = { ...next, yoruDriftRounds: next.yoruDriftRounds - 1 };
  }
  if (next.movementPenaltyTurns > 0) {
    const turns = next.movementPenaltyTurns - 1;
    next = {
      ...next,
      movementPenaltyTurns: turns,
      movementPenalty: turns > 0 ? next.movementPenalty : 0,
    };
  }
  if (next.itemsLockedTurns > 0) {
    next = { ...next, itemsLockedTurns: next.itemsLockedTurns - 1 };
  }

  next = {
    ...next,
    inViperPit: isInPoisonCloud(board, position),
    turnStartPosition: position,
  };

  return next;
}

export function syncViperPitFlags(
  players: UltimatePlayerState[],
  board: BoardUltimateState
): UltimatePlayerState[] {
  return players.map((p) => ({
    ...p,
    status: {
      ...ensureUltimateStatus(p.status),
      inViperPit: isInPoisonCloud(board, p.position),
    },
  }));
}

export function emptyBoardUltimateState(): BoardUltimateState {
  return createEmptyBoardUltimateState();
}
