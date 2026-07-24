/** Drag/drop team buckets used by Cypher Neural Theft configurator. */
export type CypherTeamBucket = "pool" | "alpha" | "bravo" | "solo" | "squad";

export type CypherTeamState = {
  teamAlpha: number[];
  teamBravo: number[];
  attackerIndex: number | null;
  defenderIndices: number[];
};

const MAX_2V2 = 2;
const MAX_DEFENDERS = 3;

function withoutPlayer(indices: number[], playerIndex: number): number[] {
  return indices.filter((index) => index !== playerIndex);
}

/**
 * Place a player onto a team bucket with capacity-aware swaps.
 *
 * 2v2 (max 2 per team): if the target is full, the oldest/first member is
 * moved to the other team. If that overflows the other team, its oldest
 * member becomes unassigned.
 *
 * 1v3 (solo max 1, defenders max 3):
 * - Solo occupied → current solo is pushed onto defenders (oldest defender
 *   drops to the pool if defenders are already full).
 * - Defenders full → oldest defender swaps into solo (or takes solo if empty).
 */
export function placeCypherPlayer(
  state: CypherTeamState,
  playerIndex: number,
  bucket: CypherTeamBucket
): CypherTeamState {
  let teamAlpha = withoutPlayer(state.teamAlpha, playerIndex);
  let teamBravo = withoutPlayer(state.teamBravo, playerIndex);
  let defenderIndices = withoutPlayer(state.defenderIndices, playerIndex);
  let attackerIndex =
    state.attackerIndex === playerIndex ? null : state.attackerIndex;

  if (bucket === "pool") {
    return { teamAlpha, teamBravo, attackerIndex, defenderIndices };
  }

  if (bucket === "alpha" || bucket === "bravo") {
    const targetingAlpha = bucket === "alpha";
    let target = targetingAlpha ? [...teamAlpha] : [...teamBravo];
    let other = targetingAlpha ? [...teamBravo] : [...teamAlpha];

    if (target.length >= MAX_2V2) {
      const oldest = target[0];
      target = target.slice(1);
      other = [...other, oldest];
      if (other.length > MAX_2V2) {
        // Overflow: drop the oldest on the receiving team to the pool.
        other = other.slice(other.length - MAX_2V2);
      }
    }

    target = [...target, playerIndex];

    return {
      teamAlpha: targetingAlpha ? target : other,
      teamBravo: targetingAlpha ? other : target,
      attackerIndex,
      defenderIndices,
    };
  }

  if (bucket === "solo") {
    if (attackerIndex != null) {
      const displaced = attackerIndex;
      if (defenderIndices.length >= MAX_DEFENDERS) {
        // Oldest defender returns to the pool to make room.
        defenderIndices = defenderIndices.slice(1);
      }
      defenderIndices = [...defenderIndices, displaced];
    }
    attackerIndex = playerIndex;
    return { teamAlpha, teamBravo, attackerIndex, defenderIndices };
  }

  // squad — max 3 defenders
  if (defenderIndices.length >= MAX_DEFENDERS) {
    const oldest = defenderIndices[0];
    defenderIndices = defenderIndices.slice(1);
    if (attackerIndex == null) {
      attackerIndex = oldest;
    } else {
      // Swap oldest defender with current solo.
      defenderIndices = [...defenderIndices, attackerIndex];
      attackerIndex = oldest;
    }
  }

  defenderIndices = [...defenderIndices, playerIndex];
  return { teamAlpha, teamBravo, attackerIndex, defenderIndices };
}
