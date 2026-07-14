import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import type {
  ClientMessage,
  LobbyPlayer,
  LobbyRoomState,
  PlayerProfile,
  ServerMessage,
} from "../shared/lobbyTypes.js";
import { MAX_LOBBY_PLAYERS } from "../shared/lobbyTypes.js";
import type { OnlineGameSnapshot } from "../shared/onlineGameTypes.js";
import {
  buildPlayerIndexById,
  buildTurnOrderDiceSequence,
  getRollForPlayer,
  type TurnOrderDiceSequence,
} from "../shared/turnOrderDiceSystem.js";

const PORT = Number(process.env.PORT ?? process.env.LOBBY_PORT ?? 3001);
const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR =
  process.env.VALORUSH_ROOT?.trim() || join(SERVER_DIR, "..");
const DIST_DIR =
  process.env.VALORUSH_DIST?.trim() || join(ROOT_DIR, "dist");

function loadEnvFiles(): void {
  const envDirs = [ROOT_DIR];
  const userData = process.env.VALORUSH_USER_DATA?.trim();
  if (userData) envDirs.unshift(userData);

  for (const dir of envDirs) {
    for (const name of [".env.local", ".env"]) {
      const path = join(dir, name);
      if (!existsSync(path)) continue;
      for (const line of readFileSync(path, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!(key in process.env)) process.env[key] = value;
      }
    }
  }
}

loadEnvFiles();

const STATIC_MIME: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".js": "application/javascript",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function handleTwitchAppToken(res: ServerResponse): Promise<void> {
  const clientId = process.env.VITE_TWITCH_CLIENT_ID?.trim();
  const clientSecret = process.env.VITE_TWITCH_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    sendJson(res, 400, {
      error:
        process.env.NODE_ENV === "production"
          ? "Twitch credentials are not configured on the server."
          : "Set VITE_TWITCH_CLIENT_ID and VITE_TWITCH_CLIENT_SECRET in .env.local, then restart the server.",
    });
    return;
  }

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    });

    const twitchResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const payload = await twitchResponse.text();
    res.writeHead(twitchResponse.status, { "Content-Type": "application/json" });
    res.end(payload);
  } catch {
    sendJson(res, 502, { error: "Failed to reach Twitch token endpoint." });
  }
}

async function handleTwitchOAuthToken(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const clientId = process.env.VITE_TWITCH_CLIENT_ID?.trim();
  const clientSecret = process.env.VITE_TWITCH_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    sendJson(res, 400, {
      error:
        process.env.NODE_ENV === "production"
          ? "Twitch OAuth credentials are not configured on the server."
          : "Set VITE_TWITCH_CLIENT_ID and VITE_TWITCH_CLIENT_SECRET in .env.local for OAuth sign-in.",
    });
    return;
  }

  try {
    const json = (await readJsonBody(req)) as {
      code?: string;
      redirect_uri?: string;
      code_verifier?: string;
    };

    if (!json.code || !json.redirect_uri || !json.code_verifier) {
      sendJson(res, 400, { error: "Missing OAuth parameters." });
      return;
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: json.code,
      grant_type: "authorization_code",
      redirect_uri: json.redirect_uri,
      code_verifier: json.code_verifier,
    });

    const twitchResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const payload = await twitchResponse.text();
    res.writeHead(twitchResponse.status, { "Content-Type": "application/json" });
    res.end(payload);
  } catch {
    sendJson(res, 502, { error: "Failed to exchange Twitch OAuth code." });
  }
}

function resolveDistFile(pathname: string): string | null {
  const safePath = pathname.replace(/^\/+/, "");
  if (!safePath) return null;

  const filePath = resolve(DIST_DIR, safePath);
  const distRoot = resolve(DIST_DIR);
  if (filePath !== distRoot && !filePath.startsWith(distRoot + sep)) {
    return null;
  }

  return filePath;
}

function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/assets/") ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

function listDistAssets(): string[] {
  const assetsDir = join(DIST_DIR, "assets");
  if (!existsSync(assetsDir)) return [];
  try {
    return readdirSync(assetsDir);
  } catch {
    return [];
  }
}

function readIndexAssetRefs(): string[] {
  const indexPath = join(DIST_DIR, "index.html");
  if (!existsSync(indexPath)) return [];
  const html = readFileSync(indexPath, "utf8");
  return [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
    (match) => match[1]
  );
}

type DistIntegrity = {
  ok: boolean;
  assetRefs: string[];
  missingAssets: string[];
  assetsOnDisk: string[];
};

function checkDistIntegrity(): DistIntegrity {
  const indexPath = join(DIST_DIR, "index.html");
  if (!existsSync(indexPath)) {
    return {
      ok: false,
      assetRefs: [],
      missingAssets: [],
      assetsOnDisk: listDistAssets(),
    };
  }

  const assetRefs = readIndexAssetRefs();
  const missingAssets = assetRefs.filter(
    (ref) => !existsSync(resolveDistFile(ref) ?? "")
  );

  return {
    ok: assetRefs.length > 0 && missingAssets.length === 0,
    assetRefs,
    missingAssets,
    assetsOnDisk: listDistAssets(),
  };
}

function enforceDistIntegrityAtStartup(): void {
  const integrity = checkDistIntegrity();
  if (integrity.ok) return;

  console.error("dist integrity check failed at startup:");
  console.error(`  distDir: ${DIST_DIR}`);
  console.error(`  assetRefs: ${integrity.assetRefs.join(", ") || "(none)"}`);
  console.error(
    `  missingAssets: ${integrity.missingAssets.join(", ") || "(none)"}`
  );
  console.error(
    `  assetsOnDisk: ${integrity.assetsOnDisk.join(", ") || "(none)"}`
  );

  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }

  console.warn(
    "continuing in non-production mode despite dist/index.html bundle mismatch"
  );
}

function serveStaticFile(
  res: ServerResponse,
  filePath: string,
  cacheControl?: string
): boolean {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;

  const ext = extname(filePath).toLowerCase();
  const headers: Record<string, string> = {
    "Content-Type": STATIC_MIME[ext] ?? "application/octet-stream",
  };
  if (cacheControl) headers["Cache-Control"] = cacheControl;

  res.writeHead(200, headers);
  createReadStream(filePath).pipe(res);
  return true;
}

function sendNotFound(res: ServerResponse): void {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
}

function handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const pathname = normalize(url.pathname).replace(/\\/g, "/");

  if (pathname === "/api/twitch/token" && req.method === "POST") {
    void handleTwitchAppToken(res);
    return;
  }

  if (pathname === "/api/twitch/oauth/token" && req.method === "POST") {
    void handleTwitchOAuthToken(req, res);
    return;
  }

  if (pathname === "/api/twitch/token" || pathname === "/api/twitch/oauth/token") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  if (pathname === "/api/health") {
    const indexPath = join(DIST_DIR, "index.html");
    const integrity = checkDistIntegrity();

    sendJson(res, integrity.ok ? 200 : 503, {
      ok: integrity.ok,
      wsPath: "/ws",
      servingApp: existsSync(indexPath),
      distDir: DIST_DIR,
      assetRefs: integrity.assetRefs,
      missingAssets: integrity.missingAssets,
      assetsOnDisk: integrity.assetsOnDisk,
    });
    return;
  }

  if (pathname === "/ws") {
    res.writeHead(426, { "Content-Type": "text/plain" });
    res.end("Upgrade Required");
    return;
  }

  const indexPath = join(DIST_DIR, "index.html");
  if (!existsSync(indexPath)) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ValoRush lobby server\n");
    return;
  }

  const assetPath = resolveDistFile(pathname);
  if (assetPath) {
    const cacheControl =
      pathname.startsWith("/assets/") && pathname !== "/assets/"
        ? "public, max-age=31536000, immutable"
        : undefined;

    if (serveStaticFile(res, assetPath, cacheControl)) return;

    if (isStaticAssetPath(pathname)) {
      sendNotFound(res);
      return;
    }
  }

  serveStaticFile(res, indexPath, "no-cache");
}
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
/** Keep disconnected rooms alive so hosts/guests can rejoin after refresh. */
const REJOIN_GRACE_MS = 10 * 60 * 1000;

type ConnectedClient = {
  ws: WebSocket;
  playerId: string;
  roomCode: string;
};

type TurnOrderRoomState = {
  sequence: TurnOrderDiceSequence;
  rolledInStep: Map<number, Set<string>>;
};

type Room = {
  code: string;
  status: LobbyRoomState["status"];
  players: LobbyPlayer[];
  clients: Map<string, ConnectedClient>;
  turnOrder?: TurnOrderRoomState;
  gameSnapshot?: OnlineGameSnapshot;
  gameBegun?: boolean;
  hostPlayerId?: string;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};

const rooms = new Map<string, Room>();
const playerToRoom = new Map<string, string>();

function generateCode(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "";
    const bytes = randomBytes(CODE_LENGTH);
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error("Could not allocate a unique room code.");
}

function generatePlayerId(): string {
  return randomBytes(12).toString("hex");
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function roomState(room: Room): LobbyRoomState {
  return {
    code: room.code,
    status: room.status,
    players: room.players.map((player) => ({ ...player })),
    maxPlayers: MAX_LOBBY_PLAYERS,
  };
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastRoom(room: Room, message: ServerMessage, exceptPlayerId?: string): void {
  for (const [playerId, client] of room.clients) {
    if (playerId === exceptPlayerId) continue;
    send(client.ws, message);
  }
}

function pushRoomState(room: Room): void {
  for (const [playerId, client] of room.clients) {
    const player = room.players.find((entry) => entry.id === playerId);
    send(client.ws, {
      type: "room_state",
      state: roomState(room),
      yourPlayerId: playerId,
      isHost: !!player?.isHost,
    });
  }
}

function clearRoomCleanupTimer(room: Room): void {
  if (!room.cleanupTimer) return;
  clearTimeout(room.cleanupTimer);
  room.cleanupTimer = undefined;
}

function scheduleRoomCleanup(room: Room): void {
  if (room.clients.size > 0) {
    clearRoomCleanupTimer(room);
    return;
  }

  if (room.cleanupTimer) return;

  room.cleanupTimer = setTimeout(() => {
    room.cleanupTimer = undefined;
    if (room.clients.size === 0) {
      rooms.delete(room.code);
    }
  }, REJOIN_GRACE_MS);
}

/** Accidental disconnect — keep player slot and host status for rejoin. */
function disconnectClient(ws: WebSocket, playerId: string): void {
  const roomCode = playerToRoom.get(playerId);
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) {
    playerToRoom.delete(playerId);
    return;
  }

  const client = room.clients.get(playerId);
  if (!client || client.ws !== ws) return;

  room.clients.delete(playerId);
  playerToRoom.delete(playerId);
  scheduleRoomCleanup(room);
}

/** Earliest-joined remaining player becomes host (explicit leave only). */
function pickNextHost(players: LobbyPlayer[], leavingPlayerId: string): LobbyPlayer | null {
  let nextHost: LobbyPlayer | null = null;

  for (const player of players) {
    if (player.id === leavingPlayerId) continue;
    if (!nextHost || player.joinedAt < nextHost.joinedAt) {
      nextHost = player;
    }
  }

  return nextHost;
}

/** Explicit "Lobby verlaten" — remove player and transfer host when the host leaves. */
function removePlayerOnExplicitLeave(playerId: string): void {
  removePlayerFromRoom(playerId, { transferHostOnLeave: true });
}

function removePlayerByKick(
  targetPlayerId: string,
  hostPlayerId: string
): void {
  const roomCode = playerToRoom.get(hostPlayerId);
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) return;

  const host = room.players.find((player) => player.id === hostPlayerId);
  if (!host?.isHost) return;

  if (room.status !== "waiting") return;

  if (targetPlayerId === hostPlayerId) return;

  const targetClient = room.clients.get(targetPlayerId);
  if (targetClient) {
    send(targetClient.ws, {
      type: "error",
      message: "You were removed from the lobby.",
    });
    targetClient.ws.close();
  }

  removePlayerFromRoom(targetPlayerId, { transferHostOnLeave: false });
}

function transferHostRole(hostPlayerId: string, targetPlayerId: string): void {
  const roomCode = playerToRoom.get(hostPlayerId);
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) return;

  const host = room.players.find((player) => player.id === hostPlayerId);
  if (!host?.isHost) return;

  if (room.status !== "waiting") return;

  if (targetPlayerId === hostPlayerId) return;

  const target = room.players.find((player) => player.id === targetPlayerId);
  if (!target) return;

  for (const player of room.players) {
    player.isHost = player.id === targetPlayerId;
  }

  room.hostPlayerId = targetPlayerId;
  pushRoomState(room);
}

function removePlayerFromRoom(
  playerId: string,
  options: { transferHostOnLeave: boolean }
): void {
  const roomCode = playerToRoom.get(playerId);
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) {
    playerToRoom.delete(playerId);
    return;
  }

  room.clients.delete(playerId);
  playerToRoom.delete(playerId);

  const leaving = room.players.find((player) => player.id === playerId);
  if (options.transferHostOnLeave && leaving?.isHost) {
    const nextHost = pickNextHost(room.players, playerId);
    if (nextHost) {
      for (const player of room.players) {
        player.isHost = player.id === nextHost.id;
      }
      room.hostPlayerId = nextHost.id;
    }
  }

  room.players = room.players.filter((player) => player.id !== playerId);

  if (room.players.length === 0) {
    rooms.delete(roomCode);
    return;
  }

  pushRoomState(room);
}

function getHostPlayerId(room: Room): string | null {
  if (room.hostPlayerId) {
    const stillHost = room.players.some(
      (player) => player.id === room.hostPlayerId && player.isHost
    );
    if (stillHost) return room.hostPlayerId;
  }

  return room.players.find((player) => player.isHost)?.id ?? null;
}

function broadcastGameState(room: Room, snapshot: OnlineGameSnapshot): void {
  room.gameSnapshot = snapshot;
  const message: ServerMessage = { type: "game_state", snapshot };
  for (const client of room.clients.values()) {
    send(client.ws, message);
  }
}

function forwardGameActionToHost(
  room: Room,
  fromPlayerId: string,
  action: ClientMessage & { type: "game_action" }
): void {
  const hostId = getHostPlayerId(room);
  if (!hostId || hostId === fromPlayerId) return;

  const hostClient = room.clients.get(hostId);
  if (!hostClient) return;

  send(hostClient.ws, {
    type: "game_action",
    fromPlayerId,
    action: action.action,
  });
}

function attachClient(room: Room, ws: WebSocket, playerId: string): void {
  room.clients.set(playerId, { ws, playerId, roomCode: room.code });
  playerToRoom.set(playerId, room.code);
  clearRoomCleanupTimer(room);
}

function profileFromMessage(profile: PlayerProfile): PlayerProfile {
  const name = profile.name.trim().slice(0, 32);
  if (!name) throw new Error("Display name is required.");
  const twitchLogin = profile.twitchLogin?.trim().toLowerCase() || undefined;
  return {
    name,
    avatar: profile.avatar?.trim() || undefined,
    twitchLogin,
    twitchId: profile.twitchId?.trim() || undefined,
    twitchImportedName:
      profile.twitchImportedName?.trim() ||
      (twitchLogin ? name : undefined),
  };
}

function playerHasAgentChoice(player: LobbyPlayer): boolean {
  return !!player.selectedAgentId || !!player.isRandomizePending;
}

function getPlayerTurnIndex(room: Room, playerId: string): number | null {
  const map = buildPlayerIndexById(room.players);
  return map[playerId] ?? null;
}

function findFirstEmptyLobbySlot(players: LobbyPlayer[]): number | null {
  const occupied = new Set(players.map((player) => player.slotIndex));

  for (let index = 0; index < MAX_LOBBY_PLAYERS; index += 1) {
    if (!occupied.has(index)) return index;
  }

  return null;
}

function handleCreate(ws: WebSocket, profile: PlayerProfile): void {
  const code = generateCode();
  const playerId = generatePlayerId();
  const normalized = profileFromMessage(profile);

  const host: LobbyPlayer = {
    id: playerId,
    slotIndex: 0,
    joinedAt: Date.now(),
    name: normalized.name,
    avatar: normalized.avatar,
    twitchLogin: normalized.twitchLogin,
    twitchId: normalized.twitchId,
    twitchImportedName: normalized.twitchImportedName,
    isHost: true,
  };

  const room: Room = {
    code,
    status: "waiting",
    players: [host],
    clients: new Map(),
  };

  rooms.set(code, room);
  attachClient(room, ws, playerId);
  room.hostPlayerId = playerId;
  pushRoomState(room);
}

function handleCheckLobby(ws: WebSocket, rawCode: string): void {
  const code = normalizeCode(rawCode);
  const room = rooms.get(code);

  if (!room) {
    send(ws, { type: "error", message: "Lobby not found. Check the join code." });
    return;
  }

  if (room.status !== "waiting") {
    send(ws, { type: "error", message: "This lobby has already started." });
    return;
  }

  if (room.players.length >= MAX_LOBBY_PLAYERS) {
    send(ws, { type: "error", message: "Lobby is full." });
    return;
  }

  send(ws, { type: "lobby_check", code });
}

function handleJoin(ws: WebSocket, rawCode: string, profile: PlayerProfile): void {
  const code = normalizeCode(rawCode);
  const room = rooms.get(code);

  if (!room) {
    send(ws, { type: "error", message: "Lobby not found. Check the join code." });
    return;
  }

  if (room.status !== "waiting") {
    const reconnectable = findReconnectablePlayer(room, profile);
    if (reconnectable) {
      attachClient(room, ws, reconnectable.id);
      sendRejoinState(ws, room, reconnectable.id);
      return;
    }

    send(ws, { type: "error", message: "This lobby has already started." });
    return;
  }

  if (room.players.length >= MAX_LOBBY_PLAYERS) {
    send(ws, { type: "error", message: "Lobby is full." });
    return;
  }

  const normalized = profileFromMessage(profile);

  if (normalized.twitchId) {
    const duplicate = room.players.some(
      (player) => player.twitchId && player.twitchId === normalized.twitchId
    );
    if (duplicate) {
      send(ws, { type: "error", message: "That Twitch account is already in this lobby." });
      return;
    }
  }

  const playerId = generatePlayerId();
  const slotIndex = findFirstEmptyLobbySlot(room.players);
  if (slotIndex == null) {
    send(ws, { type: "error", message: "Lobby is full." });
    return;
  }

  const player: LobbyPlayer = {
    id: playerId,
    slotIndex,
    joinedAt: Date.now(),
    name: normalized.name,
    avatar: normalized.avatar,
    twitchLogin: normalized.twitchLogin,
    twitchId: normalized.twitchId,
    twitchImportedName: normalized.twitchImportedName,
    isHost: false,
  };

  room.players.push(player);
  attachClient(room, ws, playerId);
  pushRoomState(room);
}

function sendRejoinState(ws: WebSocket, room: Room, playerId: string): void {
  const player = room.players.find((entry) => entry.id === playerId);

  send(ws, {
    type: "room_state",
    state: roomState(room),
    yourPlayerId: playerId,
    isHost: !!player?.isHost,
  });

  if (room.status === "in_game" && room.turnOrder) {
    send(ws, {
      type: "game_starting",
      payload: {
        players: roomState(room).players,
        turnOrder: {
          sequence: room.turnOrder.sequence,
          playerIndexById: buildPlayerIndexById(room.players),
        },
      },
    });
  }

  if (room.status === "in_game" && room.gameBegun && room.turnOrder?.sequence.order.length) {
    send(ws, {
      type: "game_begin",
      payload: { turnOrder: room.turnOrder.sequence.order },
    });
  }

  if (room.status === "in_game" && room.gameSnapshot) {
    send(ws, { type: "game_state", snapshot: room.gameSnapshot });
  }
}

function findReconnectablePlayer(
  room: Room,
  profile: PlayerProfile
): LobbyPlayer | undefined {
  const normalized = profileFromMessage(profile);

  return room.players.find((player) => {
    if (room.clients.has(player.id)) return false;
    if (
      normalized.twitchId &&
      player.twitchId &&
      player.twitchId === normalized.twitchId
    ) {
      return true;
    }
    return player.name.toLowerCase() === normalized.name.toLowerCase();
  });
}

function handleRejoin(ws: WebSocket, rawCode: string, rawPlayerId: string): void {
  const code = normalizeCode(rawCode);
  const playerId = rawPlayerId.trim();
  const room = rooms.get(code);

  if (!room) {
    send(ws, { type: "error", message: "Lobby not found." });
    return;
  }

  const player = room.players.find((entry) => entry.id === playerId);
  if (!player) {
    send(ws, { type: "error", message: "Could not rejoin — player slot expired." });
    return;
  }

  attachClient(room, ws, playerId);
  if (player.isHost) {
    room.hostPlayerId = playerId;
  }
  sendRejoinState(ws, room, playerId);
}

function getClientContext(ws: WebSocket): { room: Room; playerId: string } | null {
  for (const room of rooms.values()) {
    for (const [playerId, client] of room.clients) {
      if (client.ws === ws) {
        return { room, playerId };
      }
    }
  }
  return null;
}

function handleMessage(ws: WebSocket, raw: string): void {
  let message: ClientMessage;
  try {
    message = JSON.parse(raw) as ClientMessage;
  } catch {
    send(ws, { type: "error", message: "Invalid message." });
    return;
  }

  switch (message.type) {
    case "create":
      handleCreate(ws, message.profile);
      return;
    case "join":
      handleJoin(ws, message.code, message.profile);
      return;
    case "rejoin":
      handleRejoin(ws, message.code, message.playerId);
      return;
    case "check_lobby":
      handleCheckLobby(ws, message.code);
      return;
    case "ping":
      send(ws, { type: "pong" });
      return;
    case "leave": {
      const ctx = getClientContext(ws);
      if (ctx) removePlayerOnExplicitLeave(ctx.playerId);
      return;
    }
    default:
      break;
  }

  const ctx = getClientContext(ws);
  if (!ctx) {
    send(ws, { type: "error", message: "Not in a lobby." });
    return;
  }

  const { room, playerId } = ctx;
  const player = room.players.find((entry) => entry.id === playerId);
  if (!player) return;

  switch (message.type) {
    case "update_profile": {
      if (message.name !== undefined) {
        const name = message.name.trim().slice(0, 32);
        if (!name) {
          send(ws, { type: "error", message: "Display name cannot be empty." });
          return;
        }
        player.name = name;
      }
      if (message.avatar !== undefined) {
        player.avatar = message.avatar.trim() || undefined;
      }
      pushRoomState(room);
      return;
    }
    case "select_agent": {
      if (room.status !== "waiting") return;
      const agentId = message.agentId.trim();
      if (!agentId) {
        player.selectedAgentId = undefined;
        pushRoomState(room);
        return;
      }
      const takenByOther = room.players.some(
        (entry) => entry.id !== playerId && entry.selectedAgentId === agentId
      );
      if (takenByOther) {
        send(ws, { type: "error", message: "That agent is already taken." });
        return;
      }
      player.selectedAgentId = agentId;
      player.isRandomizePending = false;
      player.isReady = false;
      pushRoomState(room);
      return;
    }
    case "toggle_randomize": {
      if (room.status !== "waiting") return;
      if (player.isRandomizePending) {
        player.isRandomizePending = false;
      } else {
        player.isRandomizePending = true;
        player.selectedAgentId = undefined;
      }
      player.isReady = false;
      pushRoomState(room);
      return;
    }
    case "randomize_all": {
      if (room.status !== "waiting") return;
      if (!player.isHost) {
        send(ws, { type: "error", message: "Only the host can randomize all players." });
        return;
      }
      for (const entry of room.players) {
        entry.isRandomizePending = true;
        entry.selectedAgentId = undefined;
        entry.isReady = false;
      }
      pushRoomState(room);
      return;
    }
    case "set_ready": {
      if (room.status !== "waiting") return;
      if (!playerHasAgentChoice(player)) {
        send(ws, {
          type: "error",
          message: "Pick an agent or choose random before readying up.",
        });
        return;
      }
      player.isReady = message.ready;
      pushRoomState(room);
      return;
    }
    case "start_game": {
      if (!player.isHost) {
        send(ws, { type: "error", message: "Only the host can start the game." });
        return;
      }
      if (room.players.length !== MAX_LOBBY_PLAYERS) {
        send(ws, {
          type: "error",
          message: `Need ${MAX_LOBBY_PLAYERS} players before starting.`,
        });
        return;
      }
      if (!room.players.every((entry) => playerHasAgentChoice(entry))) {
        send(ws, {
          type: "error",
          message: "Every player must pick an agent or choose random first.",
        });
        return;
      }
      if (!room.players.every((entry) => entry.isReady)) {
        const notReady = room.players.filter((entry) => !entry.isReady);
        const names = notReady.map((entry) => entry.name).join(", ");
        send(ws, {
          type: "error",
          message: `Waiting for ready: ${names}`,
        });
        return;
      }
      room.status = "starting";
      room.hostPlayerId = playerId;
      const sequence = buildTurnOrderDiceSequence(room.players.length);
      room.turnOrder = {
        sequence,
        rolledInStep: new Map(),
      };
      const payload = {
        type: "game_starting" as const,
        payload: {
          players: roomState(room).players,
          turnOrder: {
            sequence,
            playerIndexById: buildPlayerIndexById(room.players),
          },
        },
      };
      for (const client of room.clients.values()) {
        send(client.ws, payload);
      }
      room.status = "in_game";
      return;
    }
    case "turn_order_roll": {
      if (room.status !== "in_game" || !room.turnOrder) return;
      const stepIndex = message.stepIndex;
      const step = room.turnOrder.sequence.steps[stepIndex];
      if (!step || step.kind !== "roll-round") {
        send(ws, { type: "error", message: "Invalid turn order roll." });
        return;
      }
      const playerIndex = getPlayerTurnIndex(room, playerId);
      if (playerIndex == null) return;
      const inRound = step.players.some((entry) => entry.playerIndex === playerIndex);
      if (!inRound) {
        send(ws, { type: "error", message: "You cannot roll right now." });
        return;
      }
      const rolled = room.turnOrder.rolledInStep.get(stepIndex) ?? new Set<string>();
      if (rolled.has(playerId)) return;
      const roll = getRollForPlayer(step, playerIndex);
      if (roll == null) return;
      rolled.add(playerId);
      room.turnOrder.rolledInStep.set(stepIndex, rolled);
      const rollMessage: ServerMessage = {
        type: "turn_order_roll",
        stepIndex,
        playerId,
        playerIndex,
        roll,
      };
      for (const client of room.clients.values()) {
        send(client.ws, rollMessage);
      }
      return;
    }
    case "turn_order_done": {
      if (!player.isHost) {
        send(ws, { type: "error", message: "Only the host can begin the match." });
        return;
      }
      room.gameBegun = true;
      const turnOrder = room.turnOrder?.sequence.order ?? [];
      const beginMessage: ServerMessage = {
        type: "game_begin",
        payload: { turnOrder },
      };
      for (const client of room.clients.values()) {
        send(client.ws, beginMessage);
      }
      return;
    }
    case "game_state_publish": {
      if (playerId !== getHostPlayerId(room)) {
        send(ws, { type: "error", message: "Only the host can publish game state." });
        return;
      }
      broadcastGameState(room, message.snapshot);
      return;
    }
    case "game_action": {
      if (room.status !== "in_game") return;
      if (playerId === getHostPlayerId(room)) return;
      forwardGameActionToHost(room, playerId, message);
      return;
    }
    case "chat_message": {
      if (room.status !== "waiting") return;
      const text = message.text.trim().slice(0, 500);
      if (!text) {
        send(ws, { type: "error", message: "Message cannot be empty." });
        return;
      }
      const chatMessage = {
        id: randomBytes(8).toString("hex"),
        playerId,
        playerName: player.name,
        text,
        sentAt: Date.now(),
      };
      const payload: ServerMessage = {
        type: "chat_message",
        message: chatMessage,
      };
      for (const client of room.clients.values()) {
        send(client.ws, payload);
      }
      return;
    }
    case "kick_player": {
      if (!player.isHost) {
        send(ws, { type: "error", message: "Only the host can kick players." });
        return;
      }
      removePlayerByKick(message.targetPlayerId.trim(), playerId);
      return;
    }
    case "transfer_host": {
      if (!player.isHost) {
        send(ws, { type: "error", message: "Only the host can transfer host role." });
        return;
      }
      transferHostRole(playerId, message.targetPlayerId.trim());
      return;
    }
    default:
      send(ws, { type: "error", message: "Unknown message type." });
  }
}

const httpServer = createServer(handleHttpRequest);

const wss = new WebSocketServer({
  server: httpServer,
  path: "/ws",
  perMessageDeflate: false,
});

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    handleMessage(ws, data.toString());
  });

  ws.on("close", () => {
    const ctx = getClientContext(ws);
    if (ctx) disconnectClient(ws, ctx.playerId);
  });
});

enforceDistIntegrityAtStartup();

httpServer.listen(PORT, "0.0.0.0", () => {
  const servingApp = existsSync(join(DIST_DIR, "index.html"));
  console.log(
    servingApp
      ? `ValoRush app + lobby server on http://localhost:${PORT} (WebSocket /ws)`
      : `ValoRush lobby server on http://localhost:${PORT} (WebSocket /ws)`
  );
  console.log(`LAN / tunnel: share http://<your-ip-or-tunnel>:${PORT}`);
});
