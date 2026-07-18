import {
  MAX_ULTIMATE_ORBS,
  type PlayerUltimateStatus,
  createEmptyPlayerUltimateStatus,
} from "../../../shared/ultimates";

export function clampOrbs(value: number): number {
  return Math.max(0, Math.min(MAX_ULTIMATE_ORBS, Math.floor(value)));
}

export function gainOrb(
  current: number,
  amount = 1
): number {
  return clampOrbs(current + amount);
}

export function gainFullOrbs(): number {
  return MAX_ULTIMATE_ORBS;
}

export function spendUltimate(current: number): number {
  if (current < MAX_ULTIMATE_ORBS) return current;
  return 0;
}

export function canActivateUltimate(orbs: number): boolean {
  return orbs >= MAX_ULTIMATE_ORBS;
}

export function isUltimateReady(orbs: number): boolean {
  return canActivateUltimate(orbs);
}

/** Normalize missing ultimate fields on a player-like object. */
export function ensureUltimateStatus(
  status?: Partial<PlayerUltimateStatus> | null
): PlayerUltimateStatus {
  const base = createEmptyPlayerUltimateStatus();
  if (!status) return base;
  return {
    ...base,
    ...status,
    turnStartPosition: status.turnStartPosition ?? null,
  };
}
