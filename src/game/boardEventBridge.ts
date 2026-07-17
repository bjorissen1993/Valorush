import type { GameEvent, GameEventStory } from "../types/Game";
import type { BoardEventDefinition, EventApplyContext, PlayerBoardState } from "../../shared/events";
import type { PlayerInGame } from "../types/Game";
import { boardLayout } from "./boardLayout";

export function toPlayerBoardState(player: PlayerInGame): PlayerBoardState {
  const primary =
    player.primaryWeapon ?? player.weapon ?? null;
  return {
    id: player.id,
    slotIndex: player.slotIndex,
    name: player.name,
    position: player.position,
    creds: player.creds,
    radianitePoints: player.radianitePoints,
    primaryWeapon: primary,
    secondaryWeapon: player.secondaryWeapon ?? null,
    weapon: primary,
    shield: player.shield,
    nextWeaponDiscount: player.nextWeaponDiscount,
    items: player.items ?? [],
    movementBonus: player.movementBonus ?? 0,
    movementBonusTurns: player.movementBonusTurns ?? 0,
    maxStepsPerTurn: player.maxStepsPerTurn ?? null,
    maxStepsTurns: player.maxStepsTurns ?? 0,
  };
}

export function mergeBoardStateIntoPlayer(
  player: PlayerInGame,
  board: PlayerBoardState
): PlayerInGame {
  const primary =
    board.primaryWeapon ?? board.weapon ?? player.primaryWeapon ?? null;
  return {
    ...player,
    position: board.position,
    creds: board.creds,
    radianitePoints: board.radianitePoints,
    primaryWeapon: primary,
    secondaryWeapon: board.secondaryWeapon ?? player.secondaryWeapon ?? null,
    weapon: primary,
    nextWeaponDiscount: board.nextWeaponDiscount,
    items: board.items,
    movementBonus: board.movementBonus,
    movementBonusTurns: board.movementBonusTurns,
    maxStepsPerTurn: board.maxStepsPerTurn,
    maxStepsTurns: board.maxStepsTurns,
  };
}

export function getBoardNodeIds(): string[] {
  return boardLayout.map((node) => node.id);
}

export function boardEventToGameEvent(
  def: BoardEventDefinition,
  outcome?: {
    headline: string;
    description: string;
    mood: GameEventStory["mood"];
    flatEffect?: { type: "creds" | "radianite" | "discount"; amount: number };
  }
): GameEvent {
  const story: GameEventStory = {
    ...def.story,
    presentation: def.story.presentation ?? "agent",
  };

  const flatEffect = outcome?.flatEffect;
  const effect = flatEffect ?? { type: "creds" as const, amount: 0 };

  return {
    id: def.id,
    title: def.name,
    description: outcome?.description ?? def.description,
    effect,
    story: outcome
      ? {
          ...story,
          headline: outcome.headline,
          mood: outcome.mood,
        }
      : story,
    outcome: outcome
      ? {
          effect,
          mood: outcome.mood,
          headline: outcome.headline,
          description: outcome.description,
          dialogueText: def.story.paragraphs[1] ?? def.description,
        }
      : undefined,
  };
}

export function buildEventApplyContext(
  triggerPlayerIndex: number,
  players: PlayerInGame[],
  currentRound: number,
  extras?: Partial<EventApplyContext>
): EventApplyContext {
  return {
    triggerPlayerIndex,
    players: players.map(toPlayerBoardState),
    boardNodeIds: getBoardNodeIds(),
    currentRound,
    ...extras,
  };
}

/** Decrement multi-turn movement modifiers at start of a player's turn.
 * One-shot bonuses (movementBonusTurns === 0 with movementBonus > 0) are left alone
 * until consumed by the next movement roll.
 */
export function tickMovementModifiers(player: PlayerInGame): PlayerInGame {
  let next = { ...player };
  if (next.movementBonusTurns > 0) {
    next.movementBonusTurns -= 1;
    if (next.movementBonusTurns <= 0) {
      next.movementBonus = 0;
      next.movementBonusTurns = 0;
    }
  }
  if (next.maxStepsTurns > 0) {
    next.maxStepsTurns -= 1;
    if (next.maxStepsTurns <= 0) {
      next.maxStepsPerTurn = null;
    }
  }
  return next;
}

export function computeEffectiveRoll(
  baseRoll: number,
  player: PlayerInGame
): number {
  let roll = baseRoll + (player.movementBonus ?? 0);
  if (player.maxStepsPerTurn != null) {
    roll = Math.min(roll, player.maxStepsPerTurn);
  }
  return Math.max(1, roll);
}

/** Clear one-shot movement bonus after it has been applied to a roll. */
export function consumeOneShotMovementBonus(
  player: PlayerInGame
): PlayerInGame {
  if ((player.movementBonus ?? 0) <= 0) return player;
  // Multi-turn bonuses (turns > 0) stay until tickMovementModifiers clears them.
  if ((player.movementBonusTurns ?? 0) > 0) return player;
  return {
    ...player,
    movementBonus: 0,
    movementBonusTurns: 0,
  };
}

/** Normalize legacy `weapon` into primary/secondary slots. */
export function normalizePlayerLoadout<T extends {
  weapon?: string | null;
  primaryWeapon?: string | null;
  secondaryWeapon?: string | null;
  shield?: string | null;
}>(player: T): T & {
  primaryWeapon: string | null;
  secondaryWeapon: string | null;
  weapon: string | null;
} {
  const primary =
    player.primaryWeapon ?? player.weapon ?? null;
  const secondary = player.secondaryWeapon ?? null;
  return {
    ...player,
    primaryWeapon: primary,
    secondaryWeapon: secondary,
    weapon: primary,
  };
}
