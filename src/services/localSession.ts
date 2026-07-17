import type { OnlineGameSnapshot } from "../../shared/onlineGameTypes";
import type { Agent } from "../types/Agent";
import type { Player } from "../types/Player";

const LOCAL_SESSION_KEY = "valorush_local_session";

export type LocalSessionPhase = "local_lobby" | "pregame" | "game";

export type LocalSession = {
  phase: LocalSessionPhase;
  players: Player[];
  agents?: Agent[];
  /** Serializable board/turn state for in-game restore. */
  gameSnapshot?: OnlineGameSnapshot;
};

export function readLocalSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalSession;
    if (
      parsed.phase !== "local_lobby" &&
      parsed.phase !== "pregame" &&
      parsed.phase !== "game"
    ) {
      return null;
    }
    if (!Array.isArray(parsed.players)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistLocalSession(session: LocalSession): void {
  try {
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearLocalSession(): void {
  try {
    localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch {
    // ignore
  }
}
