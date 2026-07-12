export type TurnOrderRollRoundStep = {
  kind: "roll-round";
  players: { playerIndex: number; roll: number }[];
  isTiebreak: boolean;
};

export type TurnOrderAnnounceStep = {
  kind: "announce";
  message: string;
};

export type TurnOrderRevealStep = {
  kind: "reveal";
  place: 1 | 2 | 3 | 4;
  playerIndex: number;
  roll: number;
};

export type TurnOrderReadyStep = {
  kind: "ready";
};

export type TurnOrderStep =
  | TurnOrderRollRoundStep
  | TurnOrderAnnounceStep
  | TurnOrderRevealStep
  | TurnOrderReadyStep;

export type TurnOrderDiceSequence = {
  order: number[];
  originalRolls: Record<number, number>;
  steps: TurnOrderStep[];
};

export function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
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

function appendRevealStep(
  steps: TurnOrderStep[],
  order: number[],
  place: 1 | 2 | 3 | 4,
  playerIndex: number,
  roll: number
) {
  if (order[place - 1] !== undefined) return;
  order[place - 1] = playerIndex;
  steps.push({
    kind: "reveal",
    place,
    playerIndex,
    roll,
  });
}

function revealLockedPlacementsFromTie(
  remaining: number[],
  contenders: number[],
  place: number,
  playerCount: number,
  originalRolls: Record<number, number>,
  steps: TurnOrderStep[],
  order: number[]
): number[] {
  const nonContenders = remaining.filter((index) => !contenders.includes(index));
  const startPlace = place + contenders.length;

  if (nonContenders.length === 0 || startPlace > playerCount) {
    return remaining;
  }

  const sorted = [...nonContenders].sort(
    (left, right) => originalRolls[right] - originalRolls[left]
  );

  let currentPlace = startPlace;
  let index = 0;
  const revealed = new Set<number>();

  while (index < sorted.length && currentPlace <= playerCount) {
    const roll = originalRolls[sorted[index]];
    const group: number[] = [];

    while (index < sorted.length && originalRolls[sorted[index]] === roll) {
      group.push(sorted[index]);
      index += 1;
    }

    if (group.length !== 1) {
      break;
    }

    appendRevealStep(
      steps,
      order,
      currentPlace as 1 | 2 | 3 | 4,
      group[0],
      roll
    );
    revealed.add(group[0]);
    currentPlace += 1;
  }

  return remaining.filter((playerIndex) => !revealed.has(playerIndex));
}

function runTiebreakForPlace(
  contenders: number[],
  place: number,
  tiedRoll: number,
  steps: TurnOrderStep[]
): number {
  const placeLabel = getPlaceLabel(place);

  steps.push({
    kind: "announce",
    message: `Tie on ${tiedRoll}! Only tied players re-roll for ${placeLabel}`,
  });

  let activeContenders = [...contenders];

  while (activeContenders.length > 1) {
    const tiebreakRolls: Record<number, number> = {};
    for (const playerIndex of activeContenders) {
      tiebreakRolls[playerIndex] = rollD6();
    }

    steps.push({
      kind: "roll-round",
      players: activeContenders.map((playerIndex) => ({
        playerIndex,
        roll: tiebreakRolls[playerIndex],
      })),
      isTiebreak: true,
    });

    const tieMax = Math.max(
      ...activeContenders.map((index) => tiebreakRolls[index])
    );
    const top = activeContenders.filter(
      (index) => tiebreakRolls[index] === tieMax
    );

    if (top.length === 1) {
      return top[0];
    }

    steps.push({
      kind: "announce",
      message: `Still tied on ${tieMax}! Re-rolling for ${placeLabel}`,
    });
    activeContenders = top;
  }

  return activeContenders[0];
}

export function buildTurnOrderDiceSequence(
  playerCount: number
): TurnOrderDiceSequence {
  const playerIndices = Array.from({ length: playerCount }, (_, index) => index);
  const originalRolls: Record<number, number> = {};
  const steps: TurnOrderStep[] = [];

  for (const playerIndex of playerIndices) {
    originalRolls[playerIndex] = rollD6();
  }

  steps.push({
    kind: "roll-round",
    players: playerIndices.map((playerIndex) => ({
      playerIndex,
      roll: originalRolls[playerIndex],
    })),
    isTiebreak: false,
  });

  const order: number[] = new Array<number>(playerCount);
  let remaining = [...playerIndices];

  for (let place = 1; place <= playerCount; place += 1) {
    if (remaining.length === 0) break;

    const maxRoll = Math.max(
      ...remaining.map((index) => originalRolls[index])
    );
    const contenders = remaining.filter(
      (index) => originalRolls[index] === maxRoll
    );

    if (contenders.length > 1) {
      remaining = revealLockedPlacementsFromTie(
        remaining,
        contenders,
        place,
        playerCount,
        originalRolls,
        steps,
        order
      );
    }

    const winner =
      contenders.length === 1
        ? contenders[0]
        : runTiebreakForPlace(contenders, place, maxRoll, steps);

    remaining = remaining.filter((index) => index !== winner);

    appendRevealStep(
      steps,
      order,
      place as 1 | 2 | 3 | 4,
      winner,
      originalRolls[winner]
    );
  }

  steps.push({
    kind: "announce",
    message: "Turn order locked in",
  });

  steps.push({ kind: "ready" });

  return { order, originalRolls, steps };
}

export function getRollRoundPlayerIndices(step: TurnOrderRollRoundStep): number[] {
  return step.players.map((entry) => entry.playerIndex);
}

export function getRollForPlayer(
  step: TurnOrderRollRoundStep,
  playerIndex: number
): number | undefined {
  return step.players.find((entry) => entry.playerIndex === playerIndex)?.roll;
}
