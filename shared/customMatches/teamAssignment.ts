import type { CustomMatchCategory } from "./types";

function shuffleIndices(count: number): number[] {
  const indices = Array.from({ length: count }, (_, index) => index);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

export type TeamAssignmentResult = {
  teamAlpha?: number[];
  teamBravo?: number[];
  attackerIndex?: number;
  defenderIndices?: number[];
};

/** Random balanced team split for custom match lobby display. */
export function assignTeamsForCategory(
  category: CustomMatchCategory,
  playerCount: number
): TeamAssignmentResult {
  if (playerCount <= 0) return {};

  const shuffled = shuffleIndices(playerCount);

  if (category === "2v2") {
    const alphaSize = Math.ceil(playerCount / 2);
    return {
      teamAlpha: shuffled.slice(0, alphaSize),
      teamBravo: shuffled.slice(alphaSize),
    };
  }

  if (category === "1v3") {
    const defenderCount = Math.min(3, Math.max(0, playerCount - 1));
    return {
      attackerIndex: shuffled[0],
      defenderIndices: shuffled.slice(1, 1 + defenderCount),
    };
  }

  return {};
}
