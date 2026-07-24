/**
 * Negative-effect pipeline with optional Phoenix/Sage reactive prompts.
 */

import {
  createEmptyPlayerUltimateStatus,
  type PlayerUltimateStatus,
  type UltimatePlayerState,
} from "../../../shared/ultimates";

export type NegativeEffectKind =
  | "creds"
  | "radianite"
  | "movement"
  | "position"
  | "orbs"
  | "item"
  | "skip"
  | "generic";

export type PendingNegativeEffect = {
  targetPlayerIndex: number;
  kind: NegativeEffectKind;
  description: string;
  /** Apply mutation; called only if reactive is declined or unavailable. */
  apply: (player: UltimatePlayerState) => void;
};

function cloneStatus(status: PlayerUltimateStatus): PlayerUltimateStatus {
  return {
    ...status,
    statusEffects: status.statusEffects.map((e) => ({ ...e })),
    appliedActivationIds: [...status.appliedActivationIds],
    reactiveSnapshot: null,
  };
}

export function captureReactiveSnapshot(
  player: UltimatePlayerState
): PlayerUltimateStatus["reactiveSnapshot"] {
  return {
    position: player.position,
    creds: player.creds,
    radianitePoints: player.radianitePoints,
    items: [...player.items],
    ultimateOrbs: player.ultimateOrbs,
    status: cloneStatus(player.status),
  };
}

export function restoreReactiveSnapshot(
  player: UltimatePlayerState
): UltimatePlayerState {
  const snap = player.status.reactiveSnapshot;
  if (!snap) return player;
  return {
    ...player,
    position: snap.position,
    creds: snap.creds,
    radianitePoints: snap.radianitePoints,
    items: [...snap.items],
    ultimateOrbs: snap.ultimateOrbs,
    status: {
      ...snap.status,
      reactiveUltArmed: false,
      reactiveUltAgent: null,
      reactiveSnapshot: null,
    },
  };
}

export function isUntargetable(player: UltimatePlayerState): boolean {
  return (player.status.yoruDriftRounds ?? 0) > 0;
}

export function tryConsumeCloveShield(player: UltimatePlayerState): boolean {
  if (!player.status.cloveShield) return false;
  player.status = { ...player.status, cloveShield: false };
  return true;
}

/**
 * Apply a negative effect, honouring Yoru / Clove / reactive arms.
 * Returns whether the effect was applied (true) or blocked/deferred (false).
 */
export function applyNegativeEffect(
  player: UltimatePlayerState,
  apply: (p: UltimatePlayerState) => void,
  options?: { deferReactive?: boolean }
): {
  applied: boolean;
  deferredReactive: boolean;
} {
  if (isUntargetable(player)) {
    return { applied: false, deferredReactive: false };
  }
  if (tryConsumeCloveShield(player)) {
    return { applied: false, deferredReactive: false };
  }

  if (player.status.reactiveUltArmed && options?.deferReactive !== false) {
    // Snapshot before applying so confirm can roll back.
    player.status = {
      ...player.status,
      reactiveSnapshot: captureReactiveSnapshot(player),
    };
    apply(player);
    return { applied: true, deferredReactive: true };
  }

  apply(player);
  return { applied: true, deferredReactive: false };
}

export function confirmReactiveRollback(
  player: UltimatePlayerState
): UltimatePlayerState {
  if (!player.status.reactiveSnapshot) {
    return {
      ...player,
      status: {
        ...createEmptyPlayerUltimateStatus(),
        ...player.status,
        reactiveUltArmed: false,
        reactiveUltAgent: null,
        reactiveSnapshot: null,
      },
    };
  }
  return restoreReactiveSnapshot(player);
}

export function declineReactiveRollback(
  player: UltimatePlayerState
): UltimatePlayerState {
  // Keep the applied negative; just clear the arm.
  return {
    ...player,
    status: {
      ...player.status,
      reactiveUltArmed: false,
      reactiveUltAgent: null,
      reactiveSnapshot: null,
    },
  };
}
