/** Serializable online game sync types — shared by server and browser client. */

export type SyncedPlayerInGame = {
  id: number;
  slotIndex: number;
  name: string;
  avatar?: string;
  twitchLogin?: string;
  twitchId?: string;
  twitchImportedName?: string;
  selectedAgentId?: string;
  isRandomizePending?: boolean;
  color?: string;
  position: string;
  creds: number;
  radianitePoints: number;
  weapon: string | null;
  shield: string | null;
  nextWeaponDiscount: number;
};

export type OnlineDiceFlowPhase = "hidden" | "ready" | "rolling" | "revealing" | "result";

export type OnlineAnimatedToken = {
  playerIndex: number;
  x: number;
  y: number;
  jumpOffset: number;
} | null;

export type OnlineGamePhase =
  | "roll-for-order"
  | "playing"
  | "resolving-event"
  | "game-over";

export type OnlinePendingPathChoice = {
  playerIndex: number;
  atNodeId: string;
  remainingSteps: number;
  options: string[];
};

export type OnlineGameSnapshot = {
  version: number;
  turnOrder: number[];
  currentTurnOrderIndex: number;
  round: number;
  phase: OnlineGamePhase;
  players: SyncedPlayerInGame[];
  lastRoll: number | null;
  diceDisplayValue: number | null;
  diceFlowPhase: OnlineDiceFlowPhase;
  hasRolledThisTurn: boolean;
  turnBannerPlayerIndex: number | null;
  statusTitle: string;
  statusSubtitle: string;
  isMoving: boolean;
  movingPlayerIndex: number | null;
  animatedToken: OnlineAnimatedToken;
  pendingPathChoice: OnlinePendingPathChoice | null;
};

export type OnlineGameAction =
  | { type: "open_dice" }
  | { type: "roll_dice" }
  | { type: "begin_movement" }
  | { type: "choose_path"; nodeId: string };

export type GameBeginPayload = {
  turnOrder: number[];
};
