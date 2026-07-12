import type { PlayerInGame } from "../../types/Game";

export const MINIGAME_WIN_CREDS = 150;
export const MINIGAME_WIN_RADIANITE = 1;

export type MinigameRollResult = {
  playerIndex: number;
  roll: number;
};

export function rollForAllPlayers(playerCount: number): MinigameRollResult[] {
  return Array.from({ length: playerCount }, (_, playerIndex) => ({
    playerIndex,
    roll: Math.floor(Math.random() * 6) + 1,
  }));
}

export function findMinigameWinner(
  results: MinigameRollResult[]
): MinigameRollResult {
  return results.reduce((best, current) =>
    current.roll > best.roll ? current : best
  );
}

export function applyMinigameWinReward(player: PlayerInGame): PlayerInGame {
  return {
    ...player,
    creds: player.creds + MINIGAME_WIN_CREDS,
    radianitePoints: player.radianitePoints + MINIGAME_WIN_RADIANITE,
  };
}
