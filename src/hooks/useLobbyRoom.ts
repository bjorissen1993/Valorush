import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Agent } from "../types/Agent";
import type {
  GameStartingPayload,
  LobbyChatMessage,
  LobbyRoomState,
  PlayerProfile,
} from "../../shared/lobbyTypes";
import { LobbyClient, persistLobbySession, readLobbySession, readStoredLobbySession, clearLobbySession, type LobbyConnectionStatus } from "../services/lobbyClient";

type UseLobbyRoomOptions = {
  mode: "create" | "join";
  profile: PlayerProfile;
  joinCode?: string;
  enabled: boolean;
  onKicked?: () => void;
};

export function useLobbyRoom({
  mode,
  profile,
  joinCode,
  enabled,
  onKicked,
}: UseLobbyRoomOptions) {
  const clientRef = useRef<LobbyClient | null>(null);
  const bootstrappedRef = useRef(false);
  const rejoinAttemptedRef = useRef(false);
  const roomStateRef = useRef<LobbyRoomState | null>(null);
  const onKickedRef = useRef(onKicked);

  useEffect(() => {
    onKickedRef.current = onKicked;
  }, [onKicked]);

  const [roomState, setRoomState] = useState<LobbyRoomState | null>(null);
  const [yourPlayerId, setYourPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<LobbyConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [gameStartingPayload, setGameStartingPayload] = useState<
    GameStartingPayload | null
  >(null);
  const [chatMessages, setChatMessages] = useState<LobbyChatMessage[]>([]);

  const yourPlayer = useMemo(() => {
    if (!roomState || !yourPlayerId) return null;
    return roomState.players.find((player) => player.id === yourPlayerId) ?? null;
  }, [roomState, yourPlayerId]);

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    if (!enabled) return;

    const client = new LobbyClient({
      onRoomState: (state, playerId, host) => {
        setRoomState(state);
        setYourPlayerId(playerId);
        setIsHost(host);
        setError(null);
        persistLobbySession(state.code, playerId, {
          phase: state.status === "waiting" ? "lobby" : undefined,
          profile,
          isHost: host,
        });
      },
      onGameStarting: (payload) => {
        setGameStartingPayload(payload);
        const session = readLobbySession();
        if (session) {
          const stored = readStoredLobbySession();
          persistLobbySession(session.code, session.playerId, {
            phase: "turn_order",
            gameStarting: payload,
            profile,
            isHost: stored?.isHost,
          });
        }
      },
      onTurnOrderRoll: () => {},
      onTurnOrderDone: () => {},
      onGameBegin: () => {},
      onGameState: () => {},
      onGameAction: () => {},
      onChatMessage: (message) => {
        setChatMessages((prev) => [...prev, message]);
      },
      onError: (message) => {
        const lower = message.toLowerCase();

        if (lower.includes("you were removed from the lobby")) {
          clearLobbySession();
          clientRef.current?.disconnect();
          onKickedRef.current?.();
          setError(message);
          return;
        }

        if (
          lower.includes("not in a lobby") &&
          roomStateRef.current
        ) {
          const session = readLobbySession();
          if (session) {
            clientRef.current?.rejoinLobby(session.code, session.playerId);
          }
          return;
        }

        if (rejoinAttemptedRef.current && mode === "create") {
          if (lower.includes("lobby not found") || lower.includes("slot expired")) {
            rejoinAttemptedRef.current = false;
            bootstrappedRef.current = false;
            clientRef.current?.createLobby(profile);
            return;
          }
        }

        if (
          rejoinAttemptedRef.current &&
          mode === "join" &&
          joinCode &&
          lower.includes("slot expired")
        ) {
          rejoinAttemptedRef.current = false;
          clientRef.current?.joinLobby(joinCode, profile);
          return;
        }

        if (
          rejoinAttemptedRef.current &&
          mode === "join" &&
          joinCode &&
          lower.includes("lobby not found")
        ) {
          rejoinAttemptedRef.current = false;
          clientRef.current?.joinLobby(joinCode, profile);
          return;
        }

        setError(message);
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
        if (status === "connecting") {
          setError(null);
        }
      },
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
      bootstrappedRef.current = false;
      rejoinAttemptedRef.current = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !clientRef.current || bootstrappedRef.current) return;
    if (connectionStatus !== "connected") return;

    bootstrappedRef.current = true;

    if (mode === "create") {
      const session = readLobbySession();
      if (
        session?.code &&
        session.playerId &&
        !rejoinAttemptedRef.current
      ) {
        rejoinAttemptedRef.current = true;
        clientRef.current.scheduleRejoin(session.code, session.playerId);
        clientRef.current.rejoinLobby(session.code, session.playerId);
        return;
      }

      clientRef.current.createLobby(profile);
      return;
    }

    if (mode === "join" && joinCode) {
      const normalizedCode = joinCode.trim().toUpperCase();
      const session = readLobbySession();

      if (
        session?.code === normalizedCode &&
        session.playerId &&
        !rejoinAttemptedRef.current
      ) {
        rejoinAttemptedRef.current = true;
        clientRef.current.scheduleRejoin(session.code, session.playerId);
        clientRef.current.rejoinLobby(session.code, session.playerId);
        return;
      }

      clientRef.current.joinLobby(joinCode, profile);
    }
  }, [connectionStatus, enabled, joinCode, mode, profile]);

  const selectAgent = useCallback((agentId: string) => {
    clientRef.current?.selectAgent(agentId);
  }, []);

  const toggleRandomize = useCallback(() => {
    clientRef.current?.toggleRandomize();
  }, []);

  const randomizeAll = useCallback(() => {
    clientRef.current?.randomizeAll();
  }, []);

  const setReady = useCallback((ready: boolean) => {
    clientRef.current?.setReady(ready);
  }, []);

  const startGame = useCallback(() => {
    clientRef.current?.startGame();
  }, []);

  const sendChatMessage = useCallback((text: string) => {
    clientRef.current?.sendChatMessage(text);
  }, []);

  const kickPlayer = useCallback((targetPlayerId: string) => {
    clientRef.current?.kickPlayer(targetPlayerId);
  }, []);

  const transferHost = useCallback((targetPlayerId: string) => {
    clientRef.current?.transferHost(targetPlayerId);
  }, []);

  const leaveLobby = useCallback(() => {
    clientRef.current?.leave();
  }, []);

  return {
    roomState,
    yourPlayer,
    yourPlayerId,
    isHost,
    connectionStatus,
    error,
    gameStartingPayload,
    selectAgent,
    toggleRandomize,
    randomizeAll,
    setReady,
    startGame,
    sendChatMessage,
    chatMessages,
    kickPlayer,
    transferHost,
    leaveLobby,
  };
}

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAgents() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          "https://valorant-api.com/v1/agents?isPlayableCharacter=true"
        );

        if (!response.ok) throw new Error("Failed to load agents");

        const json = await response.json();
        const mappedAgents: Agent[] = json.data
          .filter((agent: { displayName?: string; displayIcon?: string }) =>
            Boolean(agent.displayName && agent.displayIcon)
          )
          .map(
            (agent: {
              uuid: string;
              displayName: string;
              displayIcon: string;
              fullPortrait?: string;
            }) => ({
              uuid: agent.uuid,
              displayName: agent.displayName,
              displayIcon: agent.displayIcon,
              fullPortrait: agent.fullPortrait,
            })
          )
          .sort((a: Agent, b: Agent) =>
            a.displayName.localeCompare(b.displayName)
          );

        setAgents(mappedAgents);
      } catch (loadError) {
        console.error(loadError);
        setError("Could not load agents.");
      } finally {
        setLoading(false);
      }
    }

    void loadAgents();
  }, []);

  return { agents, loading, error };
}
