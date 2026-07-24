import {
  createEmptyBoardUltimateState,
  type BoardUltimateState,
  type PlayerUltimateStatus,
  type UltimatePlayerState,
} from "../../../shared/ultimates";
import { ensureUltimateStatus } from "./orbs";
import { isInPoisonCloud } from "./boardHelpers";

/** Tick board hazards at round wrap (poison/walls/slow countdown). */
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
    killjoyDevices: (board.killjoyDevices ?? []).filter((d) => d.armed),
    slowZones: (board.slowZones ?? [])
      .map((z) => ({ ...z, roundsLeft: z.roundsLeft - 1 }))
      .filter((z) => z.roundsLeft > 0),
  };
}

/**
 * Detonate Killjoy devices belonging to `ownerPlayerIndex`.
 * Survivors in zone get −2 movement once (activationId-gated).
 */
export function detonateKilljoyDevices(
  board: BoardUltimateState,
  players: UltimatePlayerState[],
  ownerPlayerIndex: number
): {
  board: BoardUltimateState;
  players: UltimatePlayerState[];
  description: string;
} {
  const devices = (board.killjoyDevices ?? []).filter(
    (d) => d.armed && d.ownerPlayerIndex === ownerPlayerIndex
  );
  if (devices.length === 0) {
    return { board, players, description: "" };
  }

  const nextPlayers = players.map((p) => ({
    ...p,
    status: { ...ensureUltimateStatus(p.status) },
    items: [...p.items],
  }));
  const hitNames: string[] = [];

  for (const device of devices) {
    for (let i = 0; i < nextPlayers.length; i += 1) {
      if (i === ownerPlayerIndex) continue;
      const p = nextPlayers[i]!;
      if (!device.nodeIds.includes(p.position)) continue;
      if (p.status.appliedActivationIds.includes(device.activationId)) continue;
      p.status.movementPenalty = Math.max(p.status.movementPenalty, 2);
      p.status.movementPenaltyTurns = Math.max(
        p.status.movementPenaltyTurns,
        1
      );
      p.status.appliedActivationIds = [
        ...p.status.appliedActivationIds,
        device.activationId,
      ];
      hitNames.push(p.name);
    }
  }

  const nextBoard: BoardUltimateState = {
    ...board,
    killjoyDevices: (board.killjoyDevices ?? []).filter(
      (d) => !(d.armed && d.ownerPlayerIndex === ownerPlayerIndex)
    ),
  };

  return {
    board: nextBoard,
    players: nextPlayers,
    description:
      hitNames.length > 0
        ? `Lockdown detonates — ${hitNames.join(", ")} −2 movement.`
        : "Lockdown detonates — zone clear.",
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
  if (next.revealedRounds > 0) {
    next = { ...next, revealedRounds: next.revealedRounds - 1 };
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

  next.statusEffects = next.statusEffects
    .map((e) => ({ ...e, roundsLeft: e.roundsLeft - 1 }))
    .filter((e) => e.roundsLeft > 0);

  // Slow zones on this tile.
  for (const zone of board.slowZones ?? []) {
    if (zone.roundsLeft <= 0 || zone.nodeId !== position) continue;
    if (next.appliedActivationIds.includes(zone.activationId)) continue;
    next = {
      ...next,
      movementPenalty: Math.max(next.movementPenalty, zone.movementDebuff),
      movementPenaltyTurns: Math.max(next.movementPenaltyTurns, 1),
      appliedActivationIds: [
        ...next.appliedActivationIds,
        zone.activationId,
      ],
    };
  }

  // Viper pit once-per-activation debuff.
  const inPit = isInPoisonCloud(board, position);
  if (inPit) {
    for (const cloud of board.poisonClouds) {
      const covers =
        cloud.nodeIds?.includes(position) || cloud.nodeId === position;
      if (!covers || cloud.roundsLeft <= 0) continue;
      if (next.appliedActivationIds.includes(cloud.activationId)) continue;
      const debuff = cloud.movementDebuff ?? 2;
      next = {
        ...next,
        movementPenalty: Math.max(next.movementPenalty, debuff),
        movementPenaltyTurns: Math.max(next.movementPenaltyTurns, 1),
        appliedActivationIds: [
          ...next.appliedActivationIds,
          cloud.activationId,
        ],
      };
    }
  }

  next = {
    ...next,
    inViperPit: inPit,
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

/** Normalize legacy board ultimate snapshots missing newer hazard arrays. */
export function normalizeBoardUltimateState(
  board?: Partial<BoardUltimateState> | null
): BoardUltimateState {
  const base = createEmptyBoardUltimateState();
  if (!board) return base;
  return {
    poisonClouds: (board.poisonClouds ?? []).map((c) => ({
      ...c,
      activationId: c.activationId ?? `legacy-poison-${c.nodeId}`,
      movementDebuff: c.movementDebuff ?? 2,
      nodeIds: c.nodeIds,
    })),
    walls: board.walls ?? [],
    traps: board.traps ?? [],
    detainZones: board.detainZones ?? [],
    killjoyDevices: board.killjoyDevices ?? [],
    slowZones: board.slowZones ?? [],
  };
}
