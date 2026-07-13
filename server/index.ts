import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { dirname, extname, join } from "node:path";
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

const PORT = Number(process.env.PORT ?? process.env.LOBBY_PORT ?? 3001);
const ROOT_DIR =
  process.env.VALORUSH_ROOT?.trim() ||
  join(dirname(fileURLToPath(import.meta.url)), "..");
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
        "Set VITE_TWITCH_CLIENT_ID and VITE_TWITCH_CLIENT_SECRET in .env.local, then restart the server.",
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
        "Set VITE_TWITCH_CLIENT_ID and VITE_TWITCH_CLIENT_SECRET in .env.local for OAuth sign-in.",
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

function serveStaticFile(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string
): boolean {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;

  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": STATIC_MIME[ext] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(res);
  return true;
}

function handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const pathname = url.pathname;

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

  const indexPath = join(DIST_DIR, "index.html");
  if (!existsSync(indexPath)) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ValoRush lobby server\n");
    return;
  }

  const safePath = pathname.replace(/^\/+/, "");
  const assetPath = join(DIST_DIR, safePath);
  if (safePath && serveStaticFile(req, res, assetPath)) return;

  serveStaticFile(req, res, indexPath);
}
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

type ConnectedClient = {
  ws: WebSocket;
  playerId: string;
  roomCode: string;
};

type Room = {
  code: string;
  status: LobbyRoomState["status"];
  players: LobbyPlayer[];
  clients: Map<string, ConnectedClient>;
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

function removeClient(playerId: string): void {
  const roomCode = playerToRoom.get(playerId);
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) {
    playerToRoom.delete(playerId);
    return;
  }

  room.clients.delete(playerId);
  playerToRoom.delete(playerId);

  if (room.clients.size === 0) {
    rooms.delete(roomCode);
    return;
  }

  const disconnected = room.players.find((player) => player.id === playerId);
  if (disconnected?.isHost) {
    const nextHost = room.players.find((player) => player.id !== playerId);
    if (nextHost) {
      for (const player of room.players) {
        player.isHost = player.id === nextHost.id;
      }
    }
  }

  room.players = room.players.filter((player) => player.id !== playerId);
  pushRoomState(room);
}

function attachClient(room: Room, ws: WebSocket, playerId: string): void {
  room.clients.set(playerId, { ws, playerId, roomCode: room.code });
  playerToRoom.set(playerId, room.code);
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
  pushRoomState(room);
}

function handleJoin(ws: WebSocket, rawCode: string, profile: PlayerProfile): void {
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

function handleRejoin(ws: WebSocket, rawCode: string, playerId: string): void {
  const code = normalizeCode(rawCode);
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
  pushRoomState(room);
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
    case "ping":
      send(ws, { type: "pong" });
      return;
    case "leave": {
      const ctx = getClientContext(ws);
      if (ctx) removeClient(ctx.playerId);
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
      if (!room.players.every((entry) => !!entry.selectedAgentId)) {
        send(ws, {
          type: "error",
          message: "Every player must pick a starting agent first.",
        });
        return;
      }
      room.status = "starting";
      const payload = { type: "game_starting" as const, players: roomState(room).players };
      for (const client of room.clients.values()) {
        send(client.ws, payload);
      }
      room.status = "in_game";
      return;
    }
    default:
      send(ws, { type: "error", message: "Unknown message type." });
  }
}

const httpServer = createServer(handleHttpRequest);

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    handleMessage(ws, data.toString());
  });

  ws.on("close", () => {
    const ctx = getClientContext(ws);
    if (ctx) removeClient(ctx.playerId);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  const servingApp = existsSync(join(DIST_DIR, "index.html"));
  console.log(
    servingApp
      ? `ValoRush app + lobby server on http://localhost:${PORT} (WebSocket /ws)`
      : `ValoRush lobby server on http://localhost:${PORT} (WebSocket /ws)`
  );
  console.log(`LAN / tunnel: share http://<your-ip-or-tunnel>:${PORT}`);
});
