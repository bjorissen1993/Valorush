/** Shared lobby protocol types — used by WebSocket server and browser client. */

import type { TurnOrderDiceSequence } from "./turnOrderDiceSystem.js";
import type {
  GameBeginPayload,
  OnlineGameAction,
  OnlineGameSnapshot,
} from "./onlineGameTypes.js";

export const MAX_LOBBY_PLAYERS = 4;

export type LobbyStatus = "waiting" | "starting" | "in_game";

export type PlayerProfile = {
  name: string;
  avatar?: string;
  twitchLogin?: string;
  twitchId?: string;
  twitchImportedName?: string;
};

export type LobbyPlayer = {
  id: string;
  slotIndex: number;
  /** Milliseconds since epoch — determines join order for host succession. */
  joinedAt: number;
  name: string;
  avatar?: string;
  twitchLogin?: string;
  twitchId?: string;
  twitchImportedName?: string;
  selectedAgentId?: string;
  isRandomizePending?: boolean;
  isReady?: boolean;
  isHost: boolean;
};

export type LobbyRoomState = {
  code: string;
  status: LobbyStatus;
  players: LobbyPlayer[];
  maxPlayers: number;
};

export type GameStartingPayload = {
  players: LobbyPlayer[];
  turnOrder: {
    sequence: TurnOrderDiceSequence;
    playerIndexById: Record<string, number>;
  };
};

export const SYSTEM_CHAT_PLAYER_ID = "system";

export type LobbyChatMessageKind = "player" | "system";

export type LobbyChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  sentAt: number;
  kind?: LobbyChatMessageKind;
};

/** Client → server */
export type ClientMessage =
  | { type: "create"; profile: PlayerProfile }
  | { type: "join"; code: string; profile: PlayerProfile }
  | { type: "rejoin"; code: string; playerId: string }
  | { type: "update_profile"; name?: string; avatar?: string }
  | { type: "select_agent"; agentId: string }
  | { type: "toggle_randomize" }
  | { type: "randomize_all" }
  | { type: "set_ready"; ready: boolean }
  | { type: "start_game" }
  | { type: "turn_order_roll"; stepIndex: number }
  | { type: "turn_order_done" }
  | { type: "chat_message"; text: string }
  /** Host-only: broadcast a system/game-event line into the shared room chat. */
  | { type: "system_chat"; text: string }
  | { type: "game_state_publish"; snapshot: OnlineGameSnapshot }
  | { type: "game_action"; action: OnlineGameAction }
  | { type: "leave" }
  | { type: "ping" }
  | { type: "check_lobby"; code: string }
  | { type: "kick_player"; targetPlayerId: string }
  | { type: "transfer_host"; targetPlayerId: string };

/** Server → client */
export type ServerMessage =
  | {
      type: "room_state";
      state: LobbyRoomState;
      yourPlayerId: string;
      isHost: boolean;
    }
  | { type: "game_starting"; payload: GameStartingPayload }
  | {
      type: "turn_order_roll";
      stepIndex: number;
      playerId: string;
      playerIndex: number;
      roll: number;
    }
  | { type: "turn_order_done" }
  | { type: "game_begin"; payload: GameBeginPayload }
  | { type: "game_state"; snapshot: OnlineGameSnapshot }
  | {
      type: "game_action";
      fromPlayerId: string;
      action: OnlineGameAction;
    }
  | { type: "chat_message"; message: LobbyChatMessage }
  | { type: "chat_history"; messages: LobbyChatMessage[] }
  | { type: "error"; message: string }
  | { type: "pong" }
  | { type: "lobby_check"; code: string };

export function lobbyPlayersToLocalIds(
  players: LobbyPlayer[]
): {
  id: number;
  slotIndex: number;
  name: string;
  avatar?: string;
  twitchLogin?: string;
  twitchId?: string;
  twitchImportedName?: string;
  selectedAgentId?: string;
  isRandomizePending?: boolean;
}[] {
  return [...players]
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((player, index) => ({
      id: index + 1,
      slotIndex: player.slotIndex,
      name: player.name,
      avatar: player.avatar,
      twitchLogin: player.twitchLogin,
      twitchId: player.twitchId,
      twitchImportedName: player.twitchImportedName,
      selectedAgentId: player.selectedAgentId,
      isRandomizePending: player.isRandomizePending,
    }));
}
