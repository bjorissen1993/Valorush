/** Central economy helpers — steal clamps, normal-tile rewards, shop constants. */

export { RADIANITE_BUY_COST } from "../../shared/items/registry";

export const NORMAL_TILE_CREDIT_TABLE: ReadonlyArray<{
  amount: number;
  weight: number;
}> = [
  { amount: 300, weight: 80 },
  { amount: 500, weight: 15 },
  { amount: 1000, weight: 5 },
];

export type StealResult = {
  intended: number;
  actual: number;
  fromCredsBefore: number;
  fromCredsAfter: number;
  toCredsAfter: number;
};

/**
 * Steal credits without going negative or taking more than the target has.
 * `intended` is the uncapped request; `actual` is what transferred.
 */
export function stealCredits(
  fromCreds: number,
  toCreds: number,
  intended: number
): StealResult {
  const safeIntended = Math.max(0, Math.floor(intended));
  const available = Math.max(0, Math.floor(fromCreds));
  const actual = Math.min(safeIntended, available);
  return {
    intended: safeIntended,
    actual,
    fromCredsBefore: available,
    fromCredsAfter: available - actual,
    toCredsAfter: Math.max(0, Math.floor(toCreds)) + actual,
  };
}

/** Steal radianite with the same clamp rules. */
export function stealRadianite(
  fromRad: number,
  toRad: number,
  intended: number
): StealResult {
  return stealCredits(fromRad, toRad, intended);
}

export function formatStealMessage(
  label: string,
  result: StealResult,
  unit = "creds"
): string {
  if (result.actual === result.intended) {
    return `${label}: −${result.actual} ${unit}`;
  }
  if (result.actual === 0) {
    return `${label}: intended −${result.intended} ${unit}, took 0 (empty)`;
  }
  return `${label}: intended −${result.intended} ${unit}, took ${result.actual}`;
}

export function rollNormalTileCredits(
  random: () => number = Math.random
): number {
  const totalWeight = NORMAL_TILE_CREDIT_TABLE.reduce(
    (sum, row) => sum + row.weight,
    0
  );
  let roll = random() * totalWeight;
  for (const row of NORMAL_TILE_CREDIT_TABLE) {
    roll -= row.weight;
    if (roll <= 0) return row.amount;
  }
  return NORMAL_TILE_CREDIT_TABLE[0]!.amount;
}

/** Chamber Tour de Force fallback when target has no radianite to steal. */
export const CHAMBER_LOOT_FALLBACK_CREDS = 3000;
