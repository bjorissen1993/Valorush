import type { PlayerInGame } from "../../types/Game";

export type TurnPlacement = {
  playerIndex: number;
  place: 1 | 2 | 3 | 4;
};

export function shuffleArray<T>(array: T[]) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

export function getPlaceLabel(place: number) {
  switch (place) {
    case 1:
      return "1st";
    case 2:
      return "2nd";
    case 3:
      return "3rd";
    default:
      return "4th";
  }
}

export function getNextPlayerMeta(args: {
  fromPlayerIndex: number;
  turnOrder: number[];
  currentTurnOrderIndex: number;
}) {
  const { fromPlayerIndex, turnOrder, currentTurnOrderIndex } = args;

  const currentOrderIndexResolved = turnOrder.findIndex(
    (index) => index === fromPlayerIndex
  );

  const safeCurrentOrderIndex =
    currentOrderIndexResolved >= 0
      ? currentOrderIndexResolved
      : currentTurnOrderIndex;

  const nextOrderIndex = safeCurrentOrderIndex + 1;
  const wrapsRound = nextOrderIndex >= turnOrder.length;
  const resolvedNextOrderIndex = wrapsRound ? 0 : nextOrderIndex;
  const nextPlayerIndex = turnOrder[resolvedNextOrderIndex] ?? 0;

  return {
    nextPlayerIndex,
    nextOrderIndex: resolvedNextOrderIndex,
    wrapsRound,
  };
}

export function getNextPlayerName(args: {
  fromPlayerIndex: number;
  turnOrder: number[];
  currentTurnOrderIndex: number;
  playersInGame: PlayerInGame[];
}) {
  const { turnOrder, playersInGame } = args;

  if (turnOrder.length === 0) return "Next player";

  const meta = getNextPlayerMeta(args);
  return playersInGame[meta.nextPlayerIndex]?.name ?? "Next player";
}