import type {
  ClientMessage,
  LobbyPlayer,
  LobbyRoomState,
  PlayerProfile,
  ServerMessage,
} from "../../shared/lobbyTypes";

export type LobbyConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

const SESSION_PLAYER_ID = "valorush_lobby_player_id";
const SESSION_ROOM_CODE = "valorush_lobby_room_code";
const LOBBY_WS_URL_KEY = "valorush_lobby_ws_url";

export function getBakedLobbyWsUrl(): string | null {
  return (
    import.meta.env.VITE_LOBBY_WS_URL?.trim() ||
    import.meta.env.VITE_DEFAULT_LOBBY_WS_URL?.trim() ||
    null
  );
}

export function getStoredLobbyWsUrl(): string | null {
  try {
    return localStorage.getItem(LOBBY_WS_URL_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function setStoredLobbyWsUrl(url: string): void {
  localStorage.setItem(LOBBY_WS_URL_KEY, url.trim());
}

export function normalizeLobbyWsUrl(input: string): string {
  let raw = input.trim();
  if (!raw) throw new Error("Enter the host server address.");

  if (!raw.includes("://")) {
    raw = raw.startsWith("localhost") || raw.startsWith("127.0.0.1")
      ? `http://${raw}`
      : `https://${raw}`;
  }

  const parsed = new URL(raw);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = "/ws";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function getLobbyWsUrl(): string {
  const stored = getStoredLobbyWsUrl();
  if (stored) return stored;

  const configured = getBakedLobbyWsUrl();
  if (configured) return configured;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function persistLobbySession(code: string, playerId: string): void {
  sessionStorage.setItem(SESSION_ROOM_CODE, code);
  sessionStorage.setItem(SESSION_PLAYER_ID, playerId);
}

export function readLobbySession(): { code: string; playerId: string } | null {
  const code = sessionStorage.getItem(SESSION_ROOM_CODE);
  const playerId = sessionStorage.getItem(SESSION_PLAYER_ID);
  if (!code || !playerId) return null;
  return { code, playerId };
}

export function clearLobbySession(): void {
  sessionStorage.removeItem(SESSION_ROOM_CODE);
  sessionStorage.removeItem(SESSION_PLAYER_ID);
}

export type LobbyClientCallbacks = {
  onRoomState: (state: LobbyRoomState, yourPlayerId: string, isHost: boolean) => void;
  onGameStarting: (players: LobbyPlayer[]) => void;
  onError: (message: string) => void;
  onStatusChange: (status: LobbyConnectionStatus) => void;
};

export class LobbyClient {
  private ws: WebSocket | null = null;
  private callbacks: LobbyClientCallbacks;
  private intentionalClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRejoin: { code: string; playerId: string } | null = null;

  constructor(callbacks: LobbyClientCallbacks) {
    this.callbacks = callbacks;
  }

  connect(): void {
    this.intentionalClose = false;
    this.callbacks.onStatusChange("connecting");

    const ws = new WebSocket(getLobbyWsUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.callbacks.onStatusChange("connected");
      if (this.pendingRejoin) {
        this.send({ type: "rejoin", ...this.pendingRejoin });
        this.pendingRejoin = null;
      }
    };

    ws.onmessage = (event) => {
      this.handleMessage(event.data as string);
    };

    ws.onerror = () => {
      this.callbacks.onStatusChange("error");
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.intentionalClose) {
        this.callbacks.onStatusChange("disconnected");
        return;
      }

      this.callbacks.onStatusChange("disconnected");
      this.reconnectTimer = setTimeout(() => this.connect(), 1500);
    };
  }

  private handleMessage(raw: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      this.callbacks.onError("Invalid server message.");
      return;
    }

    switch (message.type) {
      case "room_state":
        persistLobbySession(message.state.code, message.yourPlayerId);
        this.callbacks.onRoomState(
          message.state,
          message.yourPlayerId,
          message.isHost
        );
        return;
      case "game_starting":
        this.callbacks.onGameStarting(message.players);
        return;
      case "error":
        this.callbacks.onError(message.message);
        return;
      case "pong":
        return;
      default:
        return;
    }
  }

  send(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  createLobby(profile: PlayerProfile): void {
    this.send({ type: "create", profile });
  }

  joinLobby(code: string, profile: PlayerProfile): void {
    this.send({ type: "join", code, profile });
  }

  scheduleRejoin(code: string, playerId: string): void {
    this.pendingRejoin = { code, playerId };
  }

  selectAgent(agentId: string): void {
    this.send({ type: "select_agent", agentId });
  }

  startGame(): void {
    this.send({ type: "start_game" });
  }

  leave(): void {
    this.send({ type: "leave" });
    this.disconnect();
    clearLobbySession();
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

export function buildJoinUrl(code: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("join", code);
  return url.toString();
}

export function readJoinCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const join = params.get("join")?.trim();
  return join ? join.toUpperCase() : null;
}

export function clearJoinCodeFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("join")) return;
  url.searchParams.delete("join");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}
