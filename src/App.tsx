import { useCallback, useEffect, useMemo, useState } from "react";
import LobbyPage from "./components/LobbyPage";
import LoadingScreen from "./components/LoadingScreen";
import GamePage from "./components/GamePage";
import HomePage from "./components/HomePage";
import LobbyIdentityPage from "./components/LobbyIdentityPage";
import MultiplayerLobbyPage from "./components/MultiplayerLobbyPage";
import MultiplayerTurnOrderPage from "./components/MultiplayerTurnOrderPage";
import SpectatorWaitingPage from "./components/SpectatorWaitingPage";
import { usePerformanceSettings } from "./hooks/usePerformanceSettings";
import { useAgents } from "./hooks/useLobbyRoom";
import { clearJoinCodeFromUrl, readJoinCodeFromUrl } from "./services/lobbyClient";
import {
  completeTwitchOAuthIfPending,
  consumeTwitchOAuthError,
  identityToProfile,
} from "./services/twitchOAuth";
import { lobbyPlayersToLocalIds } from "../shared/lobbyTypes";
import type { Player } from "./types/Player";
import type { Agent } from "./types/Agent";
import type { GameStartingPayload, LobbyPlayer, PlayerProfile } from "../shared/lobbyTypes";

type Screen =
  | "home"
  | "identity_create"
  | "identity_join"
  | "mp_lobby"
  | "mp_turn_order"
  | "local_lobby"
  | "pregame"
  | "game"
  | "spectator";

export default function App() {
  const performanceSettings = usePerformanceSettings();
  const [screen, setScreen] = useState<Screen>("home");
  const [mpMode, setMpMode] = useState<"create" | "join">("create");
  const [joinCode, setJoinCode] = useState("");
  const [lobbyProfile, setLobbyProfile] = useState<PlayerProfile | null>(null);
  const [spectatorPlayers, setSpectatorPlayers] = useState<LobbyPlayer[]>([]);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [mpSession, setMpSession] = useState<{
    payload: GameStartingPayload;
    isHost: boolean;
    yourPlayerId: string;
  } | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [localAgents, setLocalAgents] = useState<Agent[]>([]);
  const { agents: loadedAgents } = useAgents();
  const agents = localAgents.length > 0 ? localAgents : loadedAgents;

  const handleOAuthProfile = useCallback((profile: PlayerProfile, returnPath: string) => {
    setLobbyProfile(profile);

    if (returnPath.includes("join=")) {
      const match = returnPath.match(/join=([A-Z0-9]+)/i);
      const code = match?.[1]?.toUpperCase() ?? readJoinCodeFromUrl() ?? "";
      setJoinCode(code);
      setMpMode("join");
      setScreen("mp_lobby");
      return;
    }

    if (returnPath.includes("create=1")) {
      setMpMode("create");
      setScreen("mp_lobby");
      return;
    }

    setScreen("home");
  }, []);

  useEffect(() => {
    async function handleOAuthCallback() {
      try {
        const result = await completeTwitchOAuthIfPending();
        if (result) {
          handleOAuthProfile(identityToProfile(result.identity), result.returnPath);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : consumeTwitchOAuthError() ?? "Twitch sign-in failed.";
        setOauthError(message);
        console.error(error);
      }
    }

    void handleOAuthCallback();
  }, [handleOAuthProfile]);

  useEffect(() => {
    const codeFromUrl = readJoinCodeFromUrl();
    if (codeFromUrl && screen === "home") {
      setJoinCode(codeFromUrl);
      setScreen("identity_join");
    }
  }, [screen]);

  function resetToHome() {
    clearJoinCodeFromUrl();
    setLobbyProfile(null);
    setJoinCode("");
    setMpSession(null);
    setScreen("home");
  }

  function startGame() {
    setScreen("game");
  }

  function goToPreGame() {
    setScreen("pregame");
  }

  function backToLobby() {
    resetToHome();
    setPlayers([]);
  }

  const stableLobbyProfile = useMemo(() => {
    if (!lobbyProfile) return null;
    return lobbyProfile;
  }, [lobbyProfile]);

  const handleGameStarting = useCallback(
    (payload: GameStartingPayload, isHost: boolean, yourPlayerId: string) => {
      setPlayers(lobbyPlayersToLocalIds(payload.players));
      setSpectatorPlayers(payload.players);
      setMpSession({ payload, isHost, yourPlayerId });
      setScreen("mp_turn_order");
    },
    []
  );

  if (screen === "home") {
    return (
      <>
        {oauthError && (
          <div className="fixed inset-x-0 top-0 z-50 border-b border-red-400/20 bg-red-950/90 px-4 py-3 text-center text-sm text-red-200">
            {oauthError}
            <button
              type="button"
              onClick={() => setOauthError(null)}
              className="ml-3 underline hover:text-white"
            >
              Sluiten
            </button>
          </div>
        )}
        <HomePage
          onCreateLobby={() => {
            setOauthError(null);
            setScreen("identity_create");
          }}
          onJoinLobby={(code) => {
            setOauthError(null);
            if (code) {
              setJoinCode(code.toUpperCase());
            }
            setScreen("identity_join");
          }}
          onLocalGame={() => {
            setOauthError(null);
            setScreen("local_lobby");
          }}
        />
      </>
    );
  }

  if (screen === "identity_create") {
    return (
      <LobbyIdentityPage
        mode="create"
        onBack={resetToHome}
        onReady={(profile) => {
          setLobbyProfile(profile);
          setMpMode("create");
          setScreen("mp_lobby");
        }}
      />
    );
  }

  if (screen === "identity_join") {
    return (
      <LobbyIdentityPage
        mode="join"
        joinCode={joinCode || undefined}
        onBack={resetToHome}
        onReady={(profile) => {
          setLobbyProfile(profile);
          setMpMode("join");
          clearJoinCodeFromUrl();
          setScreen("mp_lobby");
        }}
      />
    );
  }

  if (screen === "mp_lobby" && stableLobbyProfile) {
    return (
      <MultiplayerLobbyPage
        mode={mpMode}
        profile={stableLobbyProfile}
        joinCode={mpMode === "join" ? joinCode : undefined}
        onBack={resetToHome}
        onGameStarting={handleGameStarting}
      />
    );
  }

  if (screen === "mp_turn_order" && mpSession) {
    return (
      <MultiplayerTurnOrderPage
        players={players}
        agents={agents}
        turnOrder={mpSession.payload.turnOrder}
        yourPlayerId={mpSession.yourPlayerId}
        isHost={mpSession.isHost}
        onHostComplete={(_order, resolvedPlayers) => {
          setPlayers(resolvedPlayers);
          setScreen("pregame");
        }}
        onGuestComplete={() => {
          setScreen("spectator");
        }}
      />
    );
  }

  if (screen === "spectator") {
    return (
      <SpectatorWaitingPage players={spectatorPlayers} onBack={resetToHome} />
    );
  }

  if (screen === "local_lobby") {
    return (
      <LobbyPage
        players={players}
        setPlayers={setPlayers}
        agents={agents}
        setAgents={setLocalAgents}
        onContinue={goToPreGame}
        onBack={resetToHome}
      />
    );
  }

  if (screen === "pregame") {
    return (
      <LoadingScreen
        players={players}
        agents={agents}
        onContinue={startGame}
      />
    );
  }

  if (screen === "game") {
    return (
      <GamePage
        players={players}
        agents={agents}
        onBackToLobby={backToLobby}
        performanceSettings={performanceSettings}
      />
    );
  }

  return null;
}
