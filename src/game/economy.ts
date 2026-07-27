/** Central economy helpers — steal clamps, normal-tile rewards, shop constants. */

export { RADIANITE_BUY_COST } from "../../shared/items/registry";

/** Configurable credits for foundation / normal tiles. */
export const NORMAL_TILE_CREDIT_TABLE: ReadonlyArray<{
  amount: number;
  weight: number;
}> = [
  { amount: 300, weight: 50 },
  { amount: 400, weight: 35 },
  { amount: 500, weight: 15 },
];

/** Lucky tile credit choice amount. */
export const LUCKY_CREDITS_AMOUNT = 500;

/** Mild risk credit loss range. */
export const RISK_CREDIT_LOSS_TABLE: ReadonlyArray<{
  amount: number;
  weight: number;
}> = [
  { amount: 200, weight: 50 },
  { amount: 300, weight: 35 },
  { amount: 400, weight: 15 },
];

/** Credits paid into the shared jackpot on a risk outcome. */
export const RISK_JACKPOT_PAYMENT = 250;

/** Starting jackpot seed. */
export const JACKPOT_SEED = 500;

/** Credits to use a portal teleport between the BL / TR portals. */
export const PORTAL_CREDIT_COST = 400;

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

function rollWeightedAmount(
  table: ReadonlyArray<{ amount: number; weight: number }>,
  random: () => number = Math.random
): number {
  const totalWeight = table.reduce((sum, row) => sum + row.weight, 0);
  let roll = random() * totalWeight;
  for (const row of table) {
    roll -= row.weight;
    if (roll <= 0) return row.amount;
  }
  return table[0]!.amount;
}

export function rollNormalTileCredits(
  random: () => number = Math.random
): number {
  return rollWeightedAmount(NORMAL_TILE_CREDIT_TABLE, random);
}

export function rollRiskCreditLoss(
  random: () => number = Math.random
): number {
  return rollWeightedAmount(RISK_CREDIT_LOSS_TABLE, random);
}

/** Chamber Tour de Force fallback when target has no radianite to steal. */
export const CHAMBER_LOOT_FALLBACK_CREDS = 3000;

/** Cheap shop items eligible as Lucky free-item rewards. */
export const LUCKY_FREE_ITEM_POOL: ReadonlyArray<string> = [
  "extra-dice",
  "lucky-backpack",
  "advanced-defuse-kit",
  "defuse-drone",
  "dice-holder",
];

export function pickLuckyFreeItemId(
  random: () => number = Math.random
): string {
  const idx = Math.floor(random() * LUCKY_FREE_ITEM_POOL.length);
  return LUCKY_FREE_ITEM_POOL[Math.max(0, Math.min(idx, LUCKY_FREE_ITEM_POOL.length - 1))]!;
}
