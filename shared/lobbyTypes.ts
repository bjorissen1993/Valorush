/** Shared lobby protocol types — used by WebSocket server and browser client. */

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
  name: string;
  avatar?: string;
  twitchLogin?: string;
  twitchId?: string;
  twitchImportedName?: string;
  selectedAgentId?: string;
  isHost: boolean;
};

export type LobbyRoomState = {
  code: string;
  status: LobbyStatus;
  players: LobbyPlayer[];
  maxPlayers: number;
};

/** Client → server */
export type ClientMessage =
  | { type: "create"; profile: PlayerProfile }
  | { type: "join"; code: string; profile: PlayerProfile }
  | { type: "rejoin"; code: string; playerId: string }
  | { type: "update_profile"; name?: string; avatar?: string }
  | { type: "select_agent"; agentId: string }
  | { type: "start_game" }
  | { type: "leave" }
  | { type: "ping" };

/** Server → client */
export type ServerMessage =
  | {
      type: "room_state";
      state: LobbyRoomState;
      yourPlayerId: string;
      isHost: boolean;
    }
  | { type: "game_starting"; players: LobbyPlayer[] }
  | { type: "error"; message: string }
  | { type: "pong" };

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
    }));
}
