import type { PlayerInGame } from "../../types/Game";

export const DUEL_WIN_CREDS = 200;
export const DUEL_WIN_RADIANITE = 1;

export type DuelOutcome = "challenger" | "opponent" | "tie";

export function compareDuelRolls(
  challengerRoll: number,
  opponentRoll: number
): DuelOutcome {
  if (challengerRoll > opponentRoll) return "challenger";
  if (opponentRoll > challengerRoll) return "opponent";
  return "tie";
}

export function applyDuelWinReward(player: PlayerInGame): PlayerInGame {
  return {
    ...player,
    creds: player.creds + DUEL_WIN_CREDS,
    radianitePoints: player.radianitePoints + DUEL_WIN_RADIANITE,
  };
}
