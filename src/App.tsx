import { useCallback, useEffect, useMemo, useState } from "react";
import LobbyPage from "./components/LobbyPage";
import LoadingScreen from "./components/LoadingScreen";
import GamePage from "./components/GamePage";
import HomePage from "./components/HomePage";
import LobbyIdentityPage from "./components/LobbyIdentityPage";
import MultiplayerLobbyPage from "./components/MultiplayerLobbyPage";
import SpectatorWaitingPage from "./components/SpectatorWaitingPage";
import { usePerformanceSettings } from "./hooks/usePerformanceSettings";
import { useAgents } from "./hooks/useLobbyRoom";
import { clearJoinCodeFromUrl, readJoinCodeFromUrl } from "./services/lobbyClient";
import {
  completeTwitchOAuthIfPending,
  identityToProfile,
} from "./services/twitchOAuth";
import { lobbyPlayersToLocalIds } from "../shared/lobbyTypes";
import type { Player } from "./types/Player";
import type { Agent } from "./types/Agent";
import type { LobbyPlayer, PlayerProfile } from "../shared/lobbyTypes";

type Screen =
  | "home"
  | "identity_create"
  | "identity_join"
  | "mp_lobby"
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
    (lobbyPlayers: LobbyPlayer[], isHost: boolean) => {
      if (isHost) {
        setPlayers(lobbyPlayersToLocalIds(lobbyPlayers));
        setScreen("pregame");
        return;
      }
      setSpectatorPlayers(lobbyPlayers);
      setScreen("spectator");
    },
    []
  );

  if (screen === "home") {
    return (
      <HomePage
        onCreateLobby={() => setScreen("identity_create")}
        onJoinLobby={(code) => {
          if (code) {
            setJoinCode(code.toUpperCase());
          }
          setScreen("identity_join");
        }}
        onLocalGame={() => setScreen("local_lobby")}
      />
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
