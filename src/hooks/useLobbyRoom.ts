import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Agent } from "../types/Agent";
import type { LobbyPlayer, LobbyRoomState, PlayerProfile } from "../../shared/lobbyTypes";
import { LobbyClient, type LobbyConnectionStatus } from "../services/lobbyClient";

type UseLobbyRoomOptions = {
  mode: "create" | "join";
  profile: PlayerProfile;
  joinCode?: string;
  enabled: boolean;
};

export function useLobbyRoom({
  mode,
  profile,
  joinCode,
  enabled,
}: UseLobbyRoomOptions) {
  const clientRef = useRef<LobbyClient | null>(null);
  const bootstrappedRef = useRef(false);

  const [roomState, setRoomState] = useState<LobbyRoomState | null>(null);
  const [yourPlayerId, setYourPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<LobbyConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [gameStartingPlayers, setGameStartingPlayers] = useState<
    LobbyPlayer[] | null
  >(null);

  const yourPlayer = useMemo(() => {
    if (!roomState || !yourPlayerId) return null;
    return roomState.players.find((player) => player.id === yourPlayerId) ?? null;
  }, [roomState, yourPlayerId]);

  useEffect(() => {
    if (!enabled) return;

    const client = new LobbyClient({
      onRoomState: (state, playerId, host) => {
        setRoomState(state);
        setYourPlayerId(playerId);
        setIsHost(host);
        setError(null);
      },
      onGameStarting: (players) => {
        setGameStartingPlayers(players);
      },
      onError: (message) => {
        setError(message);
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
      },
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
      bootstrappedRef.current = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !clientRef.current || bootstrappedRef.current) return;
    if (connectionStatus !== "connected") return;

    bootstrappedRef.current = true;

    if (mode === "create") {
      clientRef.current.createLobby(profile);
      return;
    }

    if (mode === "join" && joinCode) {
      clientRef.current.joinLobby(joinCode, profile);
    }
  }, [connectionStatus, enabled, joinCode, mode, profile]);

  const selectAgent = useCallback((agentId: string) => {
    clientRef.current?.selectAgent(agentId);
  }, []);

  const startGame = useCallback(() => {
    clientRef.current?.startGame();
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
    gameStartingPlayers,
    selectAgent,
    startGame,
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
