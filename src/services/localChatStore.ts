import {
  SYSTEM_CHAT_PLAYER_ID,
  type LobbyChatMessage,
} from "../../shared/lobbyTypes";

export const LOCAL_CHAT_STORAGE_KEY = "valorush_local_chat";
const LOCAL_CHAT_JOIN_SEED_KEY = "valorush_local_chat_joins_seeded";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function readLocalChatMessages(): LobbyChatMessage[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLobbyChatMessage);
  } catch {
    return [];
  }
}

function isLobbyChatMessage(value: unknown): value is LobbyChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.id === "string" &&
    typeof message.playerId === "string" &&
    typeof message.playerName === "string" &&
    typeof message.text === "string" &&
    typeof message.sentAt === "number"
  );
}

export function writeLocalChatMessages(messages: LobbyChatMessage[]): void {
  try {
    localStorage.setItem(LOCAL_CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearLocalChat(): void {
  try {
    localStorage.removeItem(LOCAL_CHAT_STORAGE_KEY);
    localStorage.removeItem(LOCAL_CHAT_JOIN_SEED_KEY);
  } catch {
    /* ignore */
  }
}

export function hasLocalChatJoinSeed(): boolean {
  try {
    return localStorage.getItem(LOCAL_CHAT_JOIN_SEED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLocalChatJoinSeed(): void {
  try {
    localStorage.setItem(LOCAL_CHAT_JOIN_SEED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function createLocalPlayerChatMessage(
  text: string,
  playerId: string,
  playerName: string
): LobbyChatMessage | null {
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return null;
  return {
    id: makeId(),
    playerId,
    playerName: playerName.trim() || "Player",
    text: trimmed,
    sentAt: Date.now(),
    kind: "player",
  };
}

export function createLocalSystemChatMessage(
  text: string
): LobbyChatMessage | null {
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return null;
  return {
    id: makeId(),
    playerId: SYSTEM_CHAT_PLAYER_ID,
    playerName: "System",
    text: trimmed,
    sentAt: Date.now(),
    kind: "system",
  };
}
