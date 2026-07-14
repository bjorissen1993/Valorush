/** Minigame registry — register new minigames without code changes elsewhere. */

import type { ValorantMapId } from "../customMatches/types";

export type MinigameId = "neon-race" | "cypher-seek" | "quick-roll";

export type MinigameDefinition = {
  id: MinigameId;
  name: string;
  description: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  rules: string;
  rewards: { creds: number; radianite: number };
  map: ValorantMapId;
  durationLabel: string;
  /** stub = dice roll placeholder; full = future dedicated UI */
  playMode: "stub" | "full";
};
