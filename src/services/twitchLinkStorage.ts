import type { PlayerProfile } from "../../shared/lobbyTypes";
import { identityToProfile, type TwitchIdentity } from "./twitchOAuth";

export type StoredTwitchLink = {
  twitchId: string;
  twitchLogin: string;
  name: string;
  avatar: string;
  linkedAt: string;
};

const STORAGE_KEY = "valorush_twitch_link";

function isStoredTwitchLink(value: unknown): value is StoredTwitchLink {
  if (!value || typeof value !== "object") return false;
  const link = value as Record<string, unknown>;
  return (
    typeof link.twitchId === "string" &&
    typeof link.twitchLogin === "string" &&
    typeof link.name === "string" &&
    typeof link.avatar === "string" &&
    typeof link.linkedAt === "string"
  );
}

export function getStoredTwitchLink(): StoredTwitchLink | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredTwitchLink(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveTwitchLink(identity: TwitchIdentity): void {
  try {
    const link: StoredTwitchLink = {
      twitchId: identity.id,
      twitchLogin: identity.login,
      name: identity.displayName,
      avatar: identity.avatarUrl,
      linkedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(link));
  } catch {
    // Ignore quota errors or private browsing restrictions.
  }
}

export function clearTwitchLink(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage access errors.
  }
}

export function storedLinkToProfile(link: StoredTwitchLink): PlayerProfile {
  return identityToProfile({
    id: link.twitchId,
    login: link.twitchLogin,
    displayName: link.name,
    avatarUrl: link.avatar,
  });
}
