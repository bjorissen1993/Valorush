/**
 * Board event pool — bridges shared/events registry to GameEvent for Director + story modal.
 */
import type { GameEvent } from "../types/Game";
import {
  boardEventRegistry,
  pickWeightedBoardEvent,
  boardEventById,
  type BoardEventDefinition,
} from "../../shared/events";
import { boardEventToGameEvent } from "./boardEventBridge";

export { boardEventRegistry, pickWeightedBoardEvent, boardEventById };
export type { BoardEventDefinition };

export function boardEventAsGameEvent(def: BoardEventDefinition): GameEvent {
  return boardEventToGameEvent(def);
}

/** Pool used by Director System and landing resolution. */
export function buildEventPool(): GameEvent[] {
  return boardEventRegistry.map((def) => boardEventToGameEvent(def));
}

export const eventPool: GameEvent[] = buildEventPool();

export function getRandomEvent(pool: GameEvent[] = eventPool): GameEvent {
  const def = pickWeightedBoardEvent();
  return boardEventToGameEvent(def);
}

export function getRandomBoardEvent(): BoardEventDefinition {
  return pickWeightedBoardEvent();
}

export function formatEventEffect(event: GameEvent): string {
  const effect =
    event.outcome?.effect ??
    (event.effect.type !== "gamble" ? event.effect : null);

  if (!effect) return "Win or lose";

  switch (effect.type) {
    case "creds":
      return effect.amount >= 0
        ? `+${effect.amount} Creds`
        : `${effect.amount} Creds`;
    case "radianite":
      return effect.amount >= 0
        ? `+${effect.amount} Radianite`
        : `${effect.amount} Radianite`;
    case "discount":
      return `-${effect.amount} on next weapon`;
    default:
      return event.description;
  }
}

export function formatEventOutcomeLabel(event: GameEvent): string {
  if (event.outcome?.gambleResult === "win") return "You won";
  if (event.outcome?.gambleResult === "lose") return "You lost";
  if (event.effect.type === "gamble" && !event.outcome) return "At stake";
  return event.outcome?.effect && event.outcome.effect.type === "creds" &&
    event.outcome.effect.amount < 0
    ? "Cost"
    : "Reward";
}
