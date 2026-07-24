/**
 * Dice & movement — default 2d6, central finalMovement formula.
 * Agent dice (Phoenix/Neon/Jett/Breach/Raze) remain special overrides.
 */

export const DEFAULT_DICE_COUNT = 2;
export const DIE_SIDES = 6;

export type DiceRollResult = {
  dice: number[];
  sum: number;
  /** Highest single die — used by some agent ultimates (e.g. Jett). */
  highest: number;
};

export function rollDie(
  sides = DIE_SIDES,
  random: () => number = Math.random
): number {
  return Math.floor(random() * sides) + 1;
}

export function rollDice(
  count = DEFAULT_DICE_COUNT,
  sides = DIE_SIDES,
  random: () => number = Math.random
): DiceRollResult {
  const dice = Array.from({ length: Math.max(1, count) }, () =>
    rollDie(sides, random)
  );
  const sum = dice.reduce((a, b) => a + b, 0);
  const highest = Math.max(...dice);
  return { dice, sum, highest };
}

export type MovementModifiers = {
  bonuses?: number;
  debuffs?: number;
  /** Neon Overdrive — double after bonus/debuff. */
  doubleMovement?: boolean;
  /** Viper pit — floor half after other modifiers. */
  halfMovement?: boolean;
  maxSteps?: number | null;
};

/**
 * Central movement formula:
 * finalMovement = max(0, rolled + bonuses - debuffs)
 * then optional double / half / maxSteps clamps.
 */
export function computeFinalMovement(
  rolled: number,
  mods: MovementModifiers = {}
): number {
  const bonuses = mods.bonuses ?? 0;
  const debuffs = mods.debuffs ?? 0;
  let movement = Math.max(0, Math.floor(rolled) + bonuses - debuffs);

  if (mods.doubleMovement) {
    movement *= 2;
  }
  if (mods.halfMovement) {
    movement = Math.floor(movement / 2);
  }
  if (mods.maxSteps != null) {
    movement = Math.min(movement, mods.maxSteps);
  }

  return Math.max(0, movement);
}

/** Agent-special dice modes kept for ultimates / items. */
export type AgentDiceMode =
  | "standard"
  | "phoenix" // reactive — not a roll mode; reserved
  | "neon" // double via overdrive flag
  | "jett" // 2 dice, take highest
  | "breach" // apply −1 debuff via status
  | "raze"; // blast choice — not a roll mode

export function resolveAgentDiceRoll(
  mode: AgentDiceMode,
  random: () => number = Math.random
): DiceRollResult {
  if (mode === "jett") {
    const result = rollDice(2, DIE_SIDES, random);
    return {
      dice: result.dice,
      sum: result.highest,
      highest: result.highest,
    };
  }
  return rollDice(DEFAULT_DICE_COUNT, DIE_SIDES, random);
}
