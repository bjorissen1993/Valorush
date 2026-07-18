import { gainFullOrbs, gainOrb } from "./orbs";

/**
 * Wire hooks for non-turn orb gains (events, shop, minigames).
 * Call these from event resolution / shop purchase / minigame rewards.
 */
export function grantUltimateOrbs(
  currentOrbs: number,
  amount: 1 | 2 | "full"
): number {
  if (amount === "full") return gainFullOrbs();
  return gainOrb(currentOrbs, amount);
}

/** Optional shop stub — Ultimate Charge pack (+1 orb). */
export const SHOP_ULTIMATE_ORB_STUB = {
  id: "ultimate-orb-pack",
  label: "Ultimate Orb (+1)",
  description: "Gain 1 ultimate orb (capped at 3).",
  price: 400,
  orbAmount: 1 as const,
};

/** Minigame reward hook — grant +1 or +2 orbs to a winner. */
export function minigameOrbReward(
  currentOrbs: number,
  amount: 1 | 2 = 1
): number {
  return gainOrb(currentOrbs, amount);
}
