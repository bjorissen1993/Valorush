/** Serializable online game sync types — shared by server and browser client. */

import type { DirectorPickPayload } from "./director/types";

export type SyncedActiveStoryEvent = {
  playerIndex: number;
  /** JSON-serializable resolved event (GameEvent at runtime). */
  event: Record<string, unknown>;
  directorPick: DirectorPickPayload;
  introDurationMs: number;
  showDirectorIntro: boolean;
};

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
  items?: string[];
  movementBonus?: number;
  movementBonusTurns?: number;
  maxStepsPerTurn?: number | null;
  maxStepsTurns?: number;
};

export type SyncedCustomMatchStatus =
  | "scheduled"
  | "revealed"
  | "in_progress"
  | "completed";

export type SyncedScheduledCustomMatch = {
  matchId: string;
  mapId: string;
  scheduledAtRound: number;
  status: SyncedCustomMatchStatus;
  participants: string[];
  winnerPlayerIndex?: number;
};

export type SyncedCustomMatchPhase =
  | { step: "reveal" }
  | { step: "lobby"; selectingWinner?: boolean }
  | null;

export type SyncedPendingEventChoice = {
  eventId: string;
  playerIndex: number;
  choiceKind: "fixed" | "pick_player" | "bet_creds";
  followUpEventId?: string;
} | null;

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
  activeStoryEvent?: SyncedActiveStoryEvent | null;
  scheduledCustomMatch?: SyncedScheduledCustomMatch | null;
  customMatchPhase?: SyncedCustomMatchPhase;
  pendingEventChoice?: SyncedPendingEventChoice;
};

export type OnlineGameAction =
  | { type: "open_dice" }
  | { type: "roll_dice" }
  | { type: "begin_movement" }
  | { type: "choose_path"; nodeId: string };

export type GameBeginPayload = {
  turnOrder: number[];
};
