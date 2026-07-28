import { Tile } from "./gameState";

/**
 * Legacy linear board helper — unused by the clover map.
 * Prefer `boardLayout` from `./boardLayout`.
 */
export function createBoard(): Tile[] {
  const tiles: Tile[] = [];

  const types = [
    "empty",
    "event",
    "spike",
    "shop",
    "empty",
    "minigame",
    "event",
    "minigame",
  ];

  for (let i = 0; i < 20; i++) {
    tiles.push({
      id: i,
      type: types[i % types.length] as Tile["type"],
    });
  }

  return tiles;
}
