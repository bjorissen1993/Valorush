import type { BoardEventDefinition, EventChoiceSpec } from "../../shared/events";
import { boardEventById } from "../../shared/events";
import type { PlayerBoardState, ScheduledCustomMatchPayload } from "../../shared/events/types";
import type { GameEvent } from "../types/Game";
import type { PlayerInGame } from "../types/Game";
import {
  buildEventApplyContext,
  boardEventToGameEvent,
  mergeBoardStateIntoPlayer,
} from "./boardEventBridge";

export type PendingEventChoiceState = {
  eventId: string;
  playerIndex: number;
  choiceSpec: EventChoiceSpec;
  /** After first step of multi-step events (e.g. fade paranoia). */
  followUpEventId?: string;
  partialChoiceId?: string;
};

export type ApplyBoardEventResult = {
  players: PlayerInGame[];
  gameEvent: GameEvent;
  scheduleCustomMatch?: ScheduledCustomMatchPayload;
  needsFollowUp?: PendingEventChoiceState;
};

export function getEventDefinition(eventId: string): BoardEventDefinition | undefined {
  return boardEventById.get(eventId);
}

export function startBoardEvent(
  def: BoardEventDefinition,
  playerIndex: number,
  players: PlayerInGame[],
  round: number
): { gameEvent: GameEvent; needsChoice: PendingEventChoiceState | null } {
  if (!def.playerChoices) {
    const ctx = buildEventApplyContext(playerIndex, players, round);
    const result = def.applyEffect(ctx);
    const updated = result.players.map((board: PlayerBoardState, i: number) =>
      mergeBoardStateIntoPlayer(players[i], board)
    );
    return {
      gameEvent: boardEventToGameEvent(def, {
        headline: result.outcomeHeadline,
        description: result.outcomeDescription,
        mood: result.outcomeMood,
        flatEffect: result.flatEffect,
      }),
      needsChoice: null,
    };
  }

  return {
    gameEvent: boardEventToGameEvent(def),
    needsChoice: {
      eventId: def.id,
      playerIndex,
      choiceSpec: def.playerChoices,
    },
  };
}

const FOLLOW_UP_MAP: Record<string, string> = {
  "deadlock-lockdown": "deadlock-lockdown-target",
  "fade-paranoia": "fade-paranoia-target",
};

export function applyEventChoice(args: {
  eventId: string;
  playerIndex: number;
  players: PlayerInGame[];
  round: number;
  choiceId?: string;
  targetPlayerIndex?: number;
  betAmount?: number;
}): ApplyBoardEventResult {
  const def = boardEventById.get(args.eventId);
  if (!def) {
    throw new Error(`Unknown event: ${args.eventId}`);
  }

  const ctx = buildEventApplyContext(args.playerIndex, args.players, args.round, {
    choiceId: args.choiceId,
    targetPlayerIndex: args.targetPlayerIndex,
    betAmount: args.betAmount,
  });

  const result = def.applyEffect(ctx);
  const updatedPlayers = result.players.map((board: PlayerBoardState, i: number) =>
    mergeBoardStateIntoPlayer(args.players[i], board)
  );

  const followUpId = FOLLOW_UP_MAP[args.eventId];
  if (
    followUpId &&
    args.choiceId === "target" &&
    result.outcomeHeadline.includes("Pick")
  ) {
    const followUp = boardEventById.get(followUpId)!;
    return {
      players: updatedPlayers,
      gameEvent: boardEventToGameEvent(followUp),
      needsFollowUp: {
        eventId: followUpId,
        playerIndex: args.playerIndex,
        choiceSpec: followUp.playerChoices!,
        partialChoiceId: args.choiceId,
      },
    };
  }

  if (
    args.eventId === "fade-paranoia" &&
    args.choiceId === "play" &&
    result.outcomeHeadline.includes("Pick")
  ) {
    const followUp = boardEventById.get("fade-paranoia-target")!;
    return {
      players: updatedPlayers,
      gameEvent: boardEventToGameEvent(followUp),
      needsFollowUp: {
        eventId: "fade-paranoia-target",
        playerIndex: args.playerIndex,
        choiceSpec: followUp.playerChoices!,
      },
    };
  }

  return {
    players: updatedPlayers,
    gameEvent: boardEventToGameEvent(def, {
      headline: result.outcomeHeadline,
      description: result.outcomeDescription,
      mood: result.outcomeMood,
      flatEffect: result.flatEffect,
    }),
    scheduleCustomMatch: result.scheduleCustomMatch,
  };
}
