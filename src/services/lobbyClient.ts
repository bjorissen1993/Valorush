import type {
  ClientMessage,
  GameStartingPayload,
  LobbyChatMessage,
  LobbyPlayer,
  LobbyRoomState,
  PlayerProfile,
  ServerMessage,
} from "../../shared/lobbyTypes";
import {
  classifyLobbyPathSegment,
  lobbyCodeToSlug,
  normalizeLobbyCode,
} from "../../shared/lobbySlug";

export type LobbySessionPhase = "lobby" | "turn_order" | "in_game";
import type {
  GameBeginPayload,
  OnlineGameAction,
  OnlineGameSnapshot,
} from "../../shared/onlineGameTypes";

export type LobbyConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/** Multiplayer session keys — localStorage so refresh and browser-close both restore. */
const SESSION_PLAYER_ID = "valorush_lobby_player_id";
const SESSION_ROOM_CODE = "valorush_lobby_room_code";
const SESSION_PHASE = "valorush_lobby_phase";
const SESSION_PROFILE = "valorush_lobby_profile";
const SESSION_IS_HOST = "valorush_lobby_is_host";
const SESSION_GAME_STARTING = "valorush_lobby_game_starting";
const SESSION_TURN_ORDER = "valorush_lobby_turn_order";
/** Ephemeral kick banner — sessionStorage is enough (same-tab handoff). */
const SESSION_KICKED = "valorush_kicked_reason";
const LOBBY_WS_URL_KEY = "valorush_lobby_ws_url";
/** Pending join code across Twitch OAuth (slug-only return URLs). */
const PENDING_JOIN_CODE_KEY = "valorush_pending_join_code";

const LOBBY_SESSION_KEYS = [
  SESSION_PLAYER_ID,
  SESSION_ROOM_CODE,
  SESSION_PHASE,
  SESSION_PROFILE,
  SESSION_IS_HOST,
  SESSION_GAME_STARTING,
  SESSION_TURN_ORDER,
] as const;

function readPersistedItem(key: string): string | null {
  try {
    const fromLocal = localStorage.getItem(key);
    if (fromLocal != null) return fromLocal;

    // One-time migrate from older sessionStorage sessions.
    const fromSession = sessionStorage.getItem(key);
    if (fromSession != null) {
      localStorage.setItem(key, fromSession);
      sessionStorage.removeItem(key);
      return fromSession;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function writePersistedItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    sessionStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

function removePersistedItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export type StoredLobbySession = {
  code: string;
  playerId: string;
  phase: LobbySessionPhase;
  profile?: PlayerProfile;
  isHost?: boolean;
  gameStarting?: GameStartingPayload;
  turnOrder?: number[];
};

export type PersistLobbySessionExtras = Partial<
  Omit<StoredLobbySession, "code" | "playerId">
>;

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
  localStorage.setItem(LOBBY_WS_URL_KEY, normalizeLobbyWsUrl(url));
}

export function clearStoredLobbyWsUrl(): void {
  try {
    localStorage.removeItem(LOBBY_WS_URL_KEY);
  } catch {
    // ignore
  }
}

function isLocalhostHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
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
  if (stored) {
    try {
      const normalized = normalizeLobbyWsUrl(stored);
      const storedHost = new URL(normalized).hostname;
      const pageHost = window.location.hostname;

      if (!isLocalhostHost(pageHost) && isLocalhostHost(storedHost)) {
        clearStoredLobbyWsUrl();
      } else {
        return normalized;
      }
    } catch {
      clearStoredLobbyWsUrl();
    }
  }

  const configured = getBakedLobbyWsUrl();
  if (configured) return configured;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

function readStoredPhase(): LobbySessionPhase | null {
  const phase = readPersistedItem(SESSION_PHASE);
  if (phase === "lobby" || phase === "turn_order" || phase === "in_game") {
    return phase;
  }
  return null;
}

export function persistLobbySession(
  code: string,
  playerId: string,
  extras?: PersistLobbySessionExtras
): void {
  const existing = readStoredLobbySession();
  const phase = extras?.phase ?? existing?.phase ?? "lobby";

  writePersistedItem(SESSION_ROOM_CODE, code);
  writePersistedItem(SESSION_PLAYER_ID, playerId);
  writePersistedItem(SESSION_PHASE, phase);
  clearPendingJoinCode();
  syncLobbyUrl(code);

  if (extras?.profile) {
    writePersistedItem(SESSION_PROFILE, JSON.stringify(extras.profile));
  }

  if (extras?.isHost !== undefined) {
    writePersistedItem(SESSION_IS_HOST, extras.isHost ? "1" : "0");
  }

  if (extras?.gameStarting) {
    writePersistedItem(
      SESSION_GAME_STARTING,
      JSON.stringify(extras.gameStarting)
    );
  }

  if (extras?.turnOrder) {
    writePersistedItem(SESSION_TURN_ORDER, JSON.stringify(extras.turnOrder));
  }
}

export function readLobbySession(): { code: string; playerId: string } | null {
  const stored = readStoredLobbySession();
  if (!stored) return null;
  return { code: stored.code, playerId: stored.playerId };
}

export function readStoredLobbySession(): StoredLobbySession | null {
  const code = readPersistedItem(SESSION_ROOM_CODE);
  const playerId = readPersistedItem(SESSION_PLAYER_ID);
  if (!code || !playerId) return null;

  const phase = readStoredPhase() ?? "lobby";
  const stored: StoredLobbySession = { code, playerId, phase };

  const profileRaw = readPersistedItem(SESSION_PROFILE);
  if (profileRaw) {
    try {
      stored.profile = JSON.parse(profileRaw) as PlayerProfile;
    } catch {
      // ignore corrupt profile
    }
  }

  const isHostRaw = readPersistedItem(SESSION_IS_HOST);
  if (isHostRaw === "1") stored.isHost = true;
  if (isHostRaw === "0") stored.isHost = false;

  const gameStartingRaw = readPersistedItem(SESSION_GAME_STARTING);
  if (gameStartingRaw) {
    try {
      stored.gameStarting = JSON.parse(gameStartingRaw) as GameStartingPayload;
    } catch {
      // ignore corrupt payload
    }
  }

  const turnOrderRaw = readPersistedItem(SESSION_TURN_ORDER);
  if (turnOrderRaw) {
    try {
      stored.turnOrder = JSON.parse(turnOrderRaw) as number[];
    } catch {
      // ignore corrupt turn order
    }
  }

  return stored;
}

export function clearLobbySession(): void {
  for (const key of LOBBY_SESSION_KEYS) {
    removePersistedItem(key);
  }
  clearPendingJoinCode();
}

export function setLobbyKickedFlag(reason = "host"): void {
  try {
    sessionStorage.setItem(SESSION_KICKED, reason);
  } catch {
    // ignore
  }
}

export function consumeLobbyKickedFlag(): string | null {
  try {
    const value = sessionStorage.getItem(SESSION_KICKED);
    if (value) {
      sessionStorage.removeItem(SESSION_KICKED);
      return value;
    }
  } catch {
    // ignore
  }
  return null;
}

export type TurnOrderRollEvent = {
  stepIndex: number;
  playerId: string;
  playerIndex: number;
  roll: number;
};

export type LobbyClientCallbacks = {
  onRoomState: (state: LobbyRoomState, yourPlayerId: string, isHost: boolean) => void;
  onGameStarting: (payload: GameStartingPayload) => void;
  onTurnOrderRoll: (event: TurnOrderRollEvent) => void;
  onTurnOrderDone: () => void;
  onGameBegin: (payload: GameBeginPayload) => void;
  onGameState: (snapshot: OnlineGameSnapshot) => void;
  onGameAction: (fromPlayerId: string, action: OnlineGameAction) => void;
  onChatMessage: (message: LobbyChatMessage) => void;
  onChatHistory?: (messages: LobbyChatMessage[]) => void;
  onError: (message: string) => void;
  onStatusChange: (status: LobbyConnectionStatus) => void;
};

export class LobbyClient {
  private ws: WebSocket | null = null;
  private callbacks: LobbyClientCallbacks;
  private intentionalClose = false;
  private hadConnection = false;
  private inLobby = false;
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

      const session = readLobbySession();
      if (this.pendingRejoin) {
        this.send({ type: "rejoin", ...this.pendingRejoin });
        this.pendingRejoin = null;
      } else if (session && (this.hadConnection || this.inLobby)) {
        this.send({
          type: "rejoin",
          code: session.code,
          playerId: session.playerId,
        });
      }

      this.hadConnection = true;
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
        this.inLobby = true;
        persistLobbySession(message.state.code, message.yourPlayerId, {
          phase:
            message.state.status === "waiting"
              ? "lobby"
              : readStoredPhase() ?? "lobby",
        });
        this.callbacks.onRoomState(
          message.state,
          message.yourPlayerId,
          message.isHost
        );
        return;
      case "game_starting":
        this.callbacks.onGameStarting(message.payload);
        return;
      case "turn_order_roll":
        this.callbacks.onTurnOrderRoll({
          stepIndex: message.stepIndex,
          playerId: message.playerId,
          playerIndex: message.playerIndex,
          roll: message.roll,
        });
        return;
      case "turn_order_done":
        this.callbacks.onTurnOrderDone();
        return;
      case "game_begin":
        this.callbacks.onGameBegin(message.payload);
        return;
      case "game_state":
        this.callbacks.onGameState(message.snapshot);
        return;
      case "game_action":
        this.callbacks.onGameAction(message.fromPlayerId, message.action);
        return;
      case "chat_message":
        this.callbacks.onChatMessage(message.message);
        return;
      case "chat_history":
        this.callbacks.onChatHistory?.(message.messages);
        return;
      case "error":
        this.callbacks.onError(message.message);
        return;
      case "lobby_check":
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

  rejoinLobby(code: string, playerId: string): void {
    this.send({ type: "rejoin", code, playerId });
  }

  scheduleRejoin(code: string, playerId: string): void {
    this.pendingRejoin = { code, playerId };
  }

  selectAgent(agentId: string): void {
    this.send({ type: "select_agent", agentId });
  }

  toggleRandomize(): void {
    this.send({ type: "toggle_randomize" });
  }

  randomizeAll(): void {
    this.send({ type: "randomize_all" });
  }

  setReady(ready: boolean): void {
    this.send({ type: "set_ready", ready });
  }

  sendChatMessage(text: string): void {
    this.send({ type: "chat_message", text });
  }

  sendSystemChat(text: string): void {
    this.send({ type: "system_chat", text });
  }

  requestTurnOrderRoll(stepIndex: number): void {
    this.send({ type: "turn_order_roll", stepIndex });
  }

  finishTurnOrder(): void {
    this.send({ type: "turn_order_done" });
  }

  publishGameState(snapshot: OnlineGameSnapshot): void {
    this.send({ type: "game_state_publish", snapshot });
  }

  sendGameAction(action: OnlineGameAction): void {
    this.send({ type: "game_action", action });
  }

  startGame(): void {
    this.send({ type: "start_game" });
  }

  kickPlayer(targetPlayerId: string): void {
    this.send({ type: "kick_player", targetPlayerId });
  }

  transferHost(targetPlayerId: string): void {
    this.send({ type: "transfer_host", targetPlayerId });
  }

  leave(): void {
    this.send({ type: "leave" });
    this.inLobby = false;
    this.disconnect();
    clearLobbySession();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.hadConnection = false;
    this.inLobby = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

const LOBBY_PATH_RE = /^\/lobby\/([A-Za-z0-9]+)\/?$/i;

export { normalizeLobbyCode, lobbyCodeToSlug };

export function buildLobbyPath(code: string): string {
  const slug = lobbyCodeToSlug(code);
  return slug ? `/lobby/${slug}` : "/";
}

export function buildJoinUrl(code: string): string {
  const url = new URL(window.location.href);
  url.pathname = buildLobbyPath(code);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export type LobbyUrlContext =
  | { kind: "code"; code: string; slug: string }
  | { kind: "slug"; slug: string; code: null }
  | null;

/** Reads `/lobby/:slug` (or legacy `/lobby/:code` / `?join=CODE`). */
export function readLobbyUrlContext(): LobbyUrlContext {
  const pathMatch = window.location.pathname.match(LOBBY_PATH_RE);
  if (pathMatch?.[1]) {
    const classified = classifyLobbyPathSegment(pathMatch[1]);
    if (classified?.kind === "code") {
      return {
        kind: "code",
        code: classified.code,
        slug: lobbyCodeToSlug(classified.code),
      };
    }
    if (classified?.kind === "slug") {
      return { kind: "slug", slug: classified.slug, code: null };
    }
  }

  const params = new URLSearchParams(window.location.search);
  const join = params.get("join")?.trim();
  if (join) {
    const code = normalizeLobbyCode(join);
    if (code) {
      return { kind: "code", code, slug: lobbyCodeToSlug(code) };
    }
  }

  return null;
}

/**
 * Resolve a join code from the URL when possible.
 * Prefer the stored session / pending OAuth code when the path only has a slug.
 */
export function readJoinCodeFromUrl(): string | null {
  const ctx = readLobbyUrlContext();
  if (!ctx) return null;
  if (ctx.kind === "code") return ctx.code;

  const stored = readStoredLobbySession();
  if (stored?.code && lobbyCodeToSlug(stored.code) === ctx.slug) {
    return stored.code;
  }

  const pending = readPendingJoinCode();
  if (pending && lobbyCodeToSlug(pending) === ctx.slug) {
    return pending;
  }

  return null;
}

export function readLobbySlugFromUrl(): string | null {
  return readLobbyUrlContext()?.slug ?? null;
}

export function setPendingJoinCode(code: string): void {
  const normalized = normalizeLobbyCode(code);
  if (!normalized) return;
  try {
    sessionStorage.setItem(PENDING_JOIN_CODE_KEY, normalized);
  } catch {
    // ignore
  }
}

export function readPendingJoinCode(): string | null {
  try {
    const value = sessionStorage.getItem(PENDING_JOIN_CODE_KEY);
    return value ? normalizeLobbyCode(value) : null;
  } catch {
    return null;
  }
}

export function clearPendingJoinCode(): void {
  try {
    sessionStorage.removeItem(PENDING_JOIN_CODE_KEY);
  } catch {
    // ignore
  }
}

function writeHistoryUrl(path: string, mode: "replace" | "push"): void {
  const write =
    mode === "push" ? window.history.pushState : window.history.replaceState;
  write.call(window.history, {}, "", path);
}

/** Keep the address bar on `/lobby/:slug` while in a multiplayer session. */
export function syncLobbyUrl(
  code: string,
  mode: "replace" | "push" = "replace"
): void {
  const normalized = normalizeLobbyCode(code);
  if (!normalized) return;

  const target = buildLobbyPath(normalized);
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const targetPath = target.replace(/\/$/, "");
  const hasJoinQuery = new URLSearchParams(window.location.search).has("join");

  if (path === targetPath && !hasJoinQuery && !window.location.hash) return;
  writeHistoryUrl(target, mode);
}

export function navigateToHome(mode: "replace" | "push" = "push"): void {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const atHome = path === "/" && !window.location.search && !window.location.hash;
  if (atHome) return;
  writeHistoryUrl("/", mode);
}

/** @deprecated Prefer navigateToHome — kept for call sites that clear invite URLs. */
export function clearJoinCodeFromUrl(): void {
  navigateToHome("replace");
}

/**
 * Migrate legacy `?join=CODE` or `/lobby/CODE` to `/lobby/<slug>`.
 * Skips Twitch OAuth callback URLs (`?code=&state=`).
 */
export function canonicalizeLobbyUrl(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.has("code") && params.has("state")) return;

  const ctx = readLobbyUrlContext();
  if (!ctx) return;

  if (ctx.kind === "code") {
    setPendingJoinCode(ctx.code);
    const target = buildLobbyPath(ctx.code);
    const path = window.location.pathname.replace(/\/$/, "") || "/";
    const hasJoinQuery = params.has("join");
    if (path !== target.replace(/\/$/, "") || hasJoinQuery || window.location.hash) {
      writeHistoryUrl(target, "replace");
    }
    return;
  }

  // Already a slug path — drop legacy join query if present.
  if (params.has("join")) {
    writeHistoryUrl(`/lobby/${ctx.slug}`, "replace");
  }
}

const LOBBY_CHECK_TIMEOUT_MS = 10_000;

export function isFatalLobbyJoinError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("lobby not found") ||
    lower.includes("lobby is full") ||
    lower.includes("already started") ||
    lower.includes("slot expired")
  );
}

export function validateLobbyCode(code: string): Promise<void> {
  const normalized = normalizeLobbyCode(code);
  if (normalized.length < 4) {
    return Promise.reject(new Error("Enter a valid join code."));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      ws.close();
      if (error) reject(error);
      else resolve();
    }

    const ws = new WebSocket(getLobbyWsUrl());
    const timeout = setTimeout(() => {
      finish(new Error("Could not connect to lobby server."));
    }, LOBBY_CHECK_TIMEOUT_MS);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "check_lobby", code: normalized }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage;
        if (message.type === "lobby_check") {
          finish();
          return;
        }
        if (message.type === "error") {
          finish(new Error(message.message));
          return;
        }
        finish(new Error("Unexpected server response."));
      } catch {
        finish(new Error("Invalid server response."));
      }
    };

    ws.onerror = () => {
      finish(new Error("Could not connect to lobby server."));
    };
  });
}
