import type { PlayerInGame } from "../../types/Game";

export type RankedPlayer = {
  playerIndex: number;
  player: PlayerInGame;
  rank: number;
};

/** Rank by Radianite (desc), then Creds (desc) as tiebreaker. */
export function rankPlayersByScore(
  players: PlayerInGame[]
): RankedPlayer[] {
  const sorted = players
    .map((player, playerIndex) => ({ player, playerIndex }))
    .sort((a, b) => {
      if (b.player.radianitePoints !== a.player.radianitePoints) {
        return b.player.radianitePoints - a.player.radianitePoints;
      }
      return b.player.creds - a.player.creds;
    });

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}
