import { Player } from "../types/Player";

export type TileType =
  | "empty"
  | "duel"
  | "spike"
  | "shop"
  | "event"
  | "minigame";

export type Tile = {
  id: number;
  type: TileType;
};

export type GameState = {
  players: Player[];
  turn: number;
  currentPlayerIndex: number;
  board: Tile[];
};