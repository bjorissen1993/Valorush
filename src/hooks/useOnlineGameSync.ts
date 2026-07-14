import { useCallback, useEffect, useRef } from "react";
import type {
  OnlineGameAction,
  OnlineGameSnapshot,
} from "../../shared/onlineGameTypes";
import { LobbyClient, persistLobbySession, readLobbySession, readStoredLobbySession } from "../services/lobbyClient";

type UseOnlineGameSyncOptions = {
  enabled: boolean;
  isHost: boolean;
  onGameBegin?: () => void;
  onRemoteAction?: (fromPlayerId: string, action: OnlineGameAction) => void;
  onSnapshot?: (snapshot: OnlineGameSnapshot) => void;
};

export function useOnlineGameSync({
  enabled,
  isHost,
  onGameBegin,
  onRemoteAction,
  onSnapshot,
}: UseOnlineGameSyncOptions) {
  const clientRef = useRef<LobbyClient | null>(null);
  const onGameBeginRef = useRef(onGameBegin);
  const onRemoteActionRef = useRef(onRemoteAction);
  const onSnapshotRef = useRef(onSnapshot);

  onGameBeginRef.current = onGameBegin;
  onRemoteActionRef.current = onRemoteAction;
  onSnapshotRef.current = onSnapshot;

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
        if (!isHost) {
          onSnapshotRef.current?.(snapshot);
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

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [enabled, isHost]);

  const publishSnapshot = useCallback((snapshot: OnlineGameSnapshot) => {
    if (!isHost) return;
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
