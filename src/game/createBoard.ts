import { Tile } from "./gameState";

export function createBoard(): Tile[] {
  const tiles: Tile[] = [];

  const types = [
    "empty",
    "duel",
    "spike",
    "shop",
    "empty",
    "duel",
    "event",
    "minigame"
  ];

  for (let i = 0; i < 20; i++) {
    tiles.push({
      id: i,
      type: types[i % types.length] as any
    });
  }

  return tiles;
}