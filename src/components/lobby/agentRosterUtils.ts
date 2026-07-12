type PlayerWithAgent = {
  id: string | number;
  selectedAgentId?: string;
};

export function isAgentTakenByOther(
  agentId: string,
  players: PlayerWithAgent[],
  activePlayerId?: string | number | null
): boolean {
  return players.some(
    (player) =>
      player.selectedAgentId === agentId && player.id !== activePlayerId
  );
}

export function getTakenAgentIds(
  players: PlayerWithAgent[],
  excludePlayerId?: string | number | null
): Set<string> {
  const taken = new Set<string>();
  for (const player of players) {
    if (!player.selectedAgentId) continue;
    if (excludePlayerId != null && player.id === excludePlayerId) continue;
    taken.add(player.selectedAgentId);
  }
  return taken;
}

export function getActivePlayerSelectedAgentId(
  players: PlayerWithAgent[],
  activePlayerId?: string | number | null
): string | undefined {
  if (activePlayerId == null) return undefined;
  return players.find((player) => player.id === activePlayerId)
    ?.selectedAgentId;
}

/** Pick a column count for square tiles clustered in the tall center roster without scrolling. */
export function getRosterGridLayout(count: number): { cols: number; rows: number } {
  if (count <= 0) return { cols: 1, rows: 1 };
  if (count <= 3) return { cols: count, rows: 1 };

  let bestCols = 4;
  let bestRows = Math.ceil(count / 4);
  let bestScore = Infinity;

  const minCols = Math.min(4, count);
  const maxCols = Math.min(count, 8);

  for (let cols = minCols; cols <= maxCols; cols++) {
    const rows = Math.ceil(count / cols);
    const waste = cols * rows - count;
    const aspect = rows / cols;
    // Prefer wider, shorter grids so square tiles sit centered with room above/below.
    const score = waste * 5 + aspect * 4;
    if (score < bestScore) {
      bestScore = score;
      bestCols = cols;
      bestRows = rows;
    }
  }

  return { cols: bestCols, rows: bestRows };
}
