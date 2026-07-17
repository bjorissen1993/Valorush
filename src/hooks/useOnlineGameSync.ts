import { useCallback, useEffect, useRef } from "react";
import type {
  OnlineGameAction,
  OnlineGameSnapshot,
} from "../../shared/onlineGameTypes";
import { LobbyClient, persistLobbySession, readLobbySession, readStoredLobbySession } from "../services/lobbyClient";

type UseOnlineGameSyncOptions = {
  enabled: boolean;
  isHost: boolean;
  /**
   * Host remounted into an in-progress match: apply the server-held snapshot
   * and do not publish until it arrives (avoids wiping mid-match state).
   */
  resumeHostFromServer?: boolean;
  onGameBegin?: () => void;
  onRemoteAction?: (fromPlayerId: string, action: OnlineGameAction) => void;
  onSnapshot?: (snapshot: OnlineGameSnapshot) => void;
};

export function useOnlineGameSync({
  enabled,
  isHost,
  resumeHostFromServer = false,
  onGameBegin,
  onRemoteAction,
  onSnapshot,
}: UseOnlineGameSyncOptions) {
  const clientRef = useRef<LobbyClient | null>(null);
  const onGameBeginRef = useRef(onGameBegin);
  const onRemoteActionRef = useRef(onRemoteAction);
  const onSnapshotRef = useRef(onSnapshot);
  const publishBlockedRef = useRef(Boolean(isHost && resumeHostFromServer));

  onGameBeginRef.current = onGameBegin;
  onRemoteActionRef.current = onRemoteAction;
  onSnapshotRef.current = onSnapshot;

  useEffect(() => {
    publishBlockedRef.current = Boolean(isHost && resumeHostFromServer);
  }, [isHost, resumeHostFromServer]);

  useEffect(() => {
    if (!enabled) return;

    const session = readLobbySession();
    if (!session) return;

    const client = new LobbyClient({
      onRoomState: () => {},
      onGameStarting: () => {},
      onTurnOrderRoll: () => {},
      onTurnOrderDone: () => {},
      onGameBegin: (payload) => {
        const session = readLobbySession();
        if (session) {
          const stored = readStoredLobbySession();
          persistLobbySession(session.code, session.playerId, {
            phase: "in_game",
            turnOrder: payload.turnOrder,
            isHost: stored?.isHost,
            gameStarting: stored?.gameStarting,
            profile: stored?.profile,
          });
        }
        onGameBeginRef.current?.();
      },
      onGameState: (snapshot) => {
        // Guests always apply. Host applies when reconnecting mid-match so
        // currentTurnOrderIndex / phase match the room snapshot.
        if (!isHost || resumeHostFromServer) {
          onSnapshotRef.current?.(snapshot);
        }
        if (resumeHostFromServer) {
          publishBlockedRef.current = false;
        }
      },
      onGameAction: (fromPlayerId, action) => {
        if (isHost) {
          onRemoteActionRef.current?.(fromPlayerId, action);
        }
      },
      onChatMessage: () => {},
      onError: () => {},
      onStatusChange: () => {},
    });

    clientRef.current = client;
    client.connect();
    client.scheduleRejoin(session.code, session.playerId);

    const stored = readStoredLobbySession();
    if (stored?.phase === "in_game") {
      persistLobbySession(session.code, session.playerId, {
        phase: "in_game",
        isHost: stored.isHost,
        gameStarting: stored.gameStarting,
        turnOrder: stored.turnOrder,
        profile: stored.profile,
      });
    }

    // If the room has no snapshot (lost / never published), unblock publish.
    let resumeTimeout: number | undefined;
    if (isHost && resumeHostFromServer) {
      resumeTimeout = window.setTimeout(() => {
        publishBlockedRef.current = false;
      }, 2500);
    }

    return () => {
      if (resumeTimeout !== undefined) {
        window.clearTimeout(resumeTimeout);
      }
      client.disconnect();
      clientRef.current = null;
    };
  }, [enabled, isHost, resumeHostFromServer]);

  const publishSnapshot = useCallback((snapshot: OnlineGameSnapshot) => {
    if (!isHost || publishBlockedRef.current) return;
    clientRef.current?.publishGameState(snapshot);
  }, [isHost]);

  const sendAction = useCallback((action: OnlineGameAction) => {
    if (isHost) return;
    clientRef.current?.sendGameAction(action);
  }, [isHost]);

  const leaveMatch = useCallback(() => {
    clientRef.current?.leave();
  }, []);

  return { publishSnapshot, sendAction, leaveMatch };
}
