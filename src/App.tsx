import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LobbyPage from "./components/LobbyPage";
import LoadingScreen from "./components/LoadingScreen";
import GamePage from "./components/GamePage";
import HomePage from "./components/HomePage";
import LobbyIdentityPage from "./components/LobbyIdentityPage";
import MultiplayerLobbyPage from "./components/MultiplayerLobbyPage";
import MultiplayerTurnOrderPage from "./components/MultiplayerTurnOrderPage";
import { usePerformanceSettings } from "./hooks/usePerformanceSettings";
import { useAgents } from "./hooks/useLobbyRoom";
import { clearJoinCodeFromUrl, clearLobbySession, readJoinCodeFromUrl, readStoredLobbySession, validateLobbyCode } from "./services/lobbyClient";
import {
  completeTwitchOAuthIfPending,
  consumeTwitchOAuthError,
  identityToProfile,
} from "./services/twitchOAuth";
import { lobbyPlayersToLocalIds } from "../shared/lobbyTypes";
import type { Player } from "./types/Player";
import type { Agent } from "./types/Agent";
import type { GameStartingPayload, PlayerProfile } from "../shared/lobbyTypes";

type Screen =
  | "home"
  | "identity_create"
  | "identity_join"
  | "mp_lobby"
  | "mp_turn_order"
  | "local_lobby"
  | "pregame"
  | "game";

type RestoredMultiplayerState = {
  screen: Screen;
  mpMode: "create" | "join";
  joinCode: string;
  lobbyProfile: PlayerProfile;
  mpSession: {
    payload: GameStartingPayload;
    isHost: boolean;
    yourPlayerId: string;
  } | null;
  mpTurnOrder: number[];
  players: ReturnType<typeof lobbyPlayersToLocalIds>;
};

function restoreMultiplayerFromSession(): RestoredMultiplayerState | null {
  const stored = readStoredLobbySession();
  if (!stored?.profile) return null;

  const urlCode = readJoinCodeFromUrl();
  if (urlCode && urlCode !== stored.code) return null;

  const players = stored.gameStarting
    ? lobbyPlayersToLocalIds(stored.gameStarting.players)
    : [];

  const mpSession = stored.gameStarting
    ? {
        payload: stored.gameStarting,
        isHost: stored.isHost ?? false,
        yourPlayerId: stored.playerId,
      }
    : null;

  let screen: Screen = "mp_lobby";
  if (stored.phase === "turn_order") screen = "mp_turn_order";
  if (stored.phase === "in_game") screen = "game";

  return {
    screen,
    mpMode: stored.isHost ? "create" : "join",
    joinCode: stored.code,
    lobbyProfile: stored.profile,
    mpSession,
    mpTurnOrder: stored.turnOrder ?? [],
    players,
  };
}

export default function App() {
  const restored = useMemo(() => restoreMultiplayerFromSession(), []);
  const needsJoinSessionValidation =
    restored?.screen === "mp_lobby" && restored.mpMode === "join";
  const performanceSettings = usePerformanceSettings();
  const [screen, setScreen] = useState<Screen>(
    needsJoinSessionValidation ? "home" : restored?.screen ?? "home"
  );
  const [mpMode, setMpMode] = useState<"create" | "join">(restored?.mpMode ?? "create");
  const [joinCode, setJoinCode] = useState(restored?.joinCode ?? "");
  const [lobbyProfile, setLobbyProfile] = useState<PlayerProfile | null>(
    restored?.lobbyProfile ?? null
  );
  const [homeJoinError, setHomeJoinError] = useState<string | null>(null);
  const [validatingUrlJoin, setValidatingUrlJoin] = useState(false);
  const urlJoinValidatedRef = useRef(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [mpSession, setMpSession] = useState<{
    payload: GameStartingPayload;
    isHost: boolean;
    yourPlayerId: string;
  } | null>(restored?.mpSession ?? null);
  const [mpTurnOrder, setMpTurnOrder] = useState<number[]>(restored?.mpTurnOrder ?? []);

  const [players, setPlayers] = useState<Player[]>(restored?.players ?? []);
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
      setScreen("identity_join");
      return;
    }

    if (returnPath.includes("create=1")) {
      setMpMode("create");
      setScreen("identity_create");
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
    if (!needsJoinSessionValidation || !restored) return;

    let cancelled = false;

    void validateLobbyCode(restored.joinCode)
      .then(() => {
        if (cancelled) return;
        setScreen("mp_lobby");
      })
      .catch((error) => {
        if (cancelled) return;
        clearLobbySession();
        setJoinCode("");
        setLobbyProfile(null);
        setHomeJoinError(
          error instanceof Error
            ? error.message
            : "Lobby not found. Check the join code."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [needsJoinSessionValidation, restored]);

  useEffect(() => {
    if (restored) return;
    const codeFromUrl = readJoinCodeFromUrl();
    if (!codeFromUrl || screen !== "home" || urlJoinValidatedRef.current) return;

    let cancelled = false;
    urlJoinValidatedRef.current = true;
    setValidatingUrlJoin(true);
    setHomeJoinError(null);

    void validateLobbyCode(codeFromUrl)
      .then(() => {
        if (cancelled) return;
        setJoinCode(codeFromUrl);
        setScreen("identity_join");
      })
      .catch((error) => {
        if (cancelled) return;
        clearJoinCodeFromUrl();
        setHomeJoinError(
          error instanceof Error
            ? error.message
            : "Lobby not found. Check the join code."
        );
      })
      .finally(() => {
        if (!cancelled) setValidatingUrlJoin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [restored, screen]);

  function resetToHome() {
    clearJoinCodeFromUrl();
    setLobbyProfile(null);
    setJoinCode("");
    setMpSession(null);
    setMpTurnOrder([]);
    setHomeJoinError(null);
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

  function leaveMultiplayerMatch() {
    clearLobbySession();
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
      setMpSession({ payload, isHost, yourPlayerId });
      setScreen("mp_turn_order");
    },
    []
  );

  const multiplayerGameConfig = useMemo(() => {
    if (!mpSession) return null;

    const effectiveTurnOrder =
      mpTurnOrder.length > 0
        ? mpTurnOrder
        : mpSession.payload.turnOrder.sequence.order;

    if (effectiveTurnOrder.length === 0) return null;

    const sortedPlayers = [...mpSession.payload.players].sort(
      (left, right) => left.slotIndex - right.slotIndex
    );
    const playerIndexByLobbyId: Record<string, number> = {};
    sortedPlayers.forEach((player, index) => {
      playerIndexByLobbyId[player.id] = index;
    });

    return {
      isHost: mpSession.isHost,
      yourPlayerId: mpSession.yourPlayerId,
      yourPlayerIndex: playerIndexByLobbyId[mpSession.yourPlayerId] ?? 0,
      playerIndexByLobbyId,
      initialTurnOrder: effectiveTurnOrder,
    };
  }, [mpSession, mpTurnOrder]);

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
          joinError={homeJoinError}
          validatingJoin={validatingUrlJoin}
          onCreateLobby={() => {
            setOauthError(null);
            setHomeJoinError(null);
            setScreen("identity_create");
          }}
          onJoinLobby={(code) => {
            setOauthError(null);
            setHomeJoinError(null);
            if (code) {
              setJoinCode(code.toUpperCase());
            }
            setScreen("identity_join");
          }}
          onLocalGame={() => {
            setOauthError(null);
            setHomeJoinError(null);
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
        onReady={async (profile) => {
          if (joinCode) {
            try {
              await validateLobbyCode(joinCode);
            } catch (error) {
              setHomeJoinError(
                error instanceof Error
                  ? error.message
                  : "Lobby not found. Check the join code."
              );
              resetToHome();
              return;
            }
          }
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
        onJoinFailed={(message) => {
          setHomeJoinError(message);
          resetToHome();
        }}
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
        onMatchBegin={(order, resolvedPlayers) => {
          setPlayers(resolvedPlayers);
          setMpTurnOrder(order);
          setScreen("game");
        }}
      />
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
        onBackToLobby={multiplayerGameConfig ? undefined : backToLobby}
        onLeaveMatch={multiplayerGameConfig ? leaveMultiplayerMatch : undefined}
        performanceSettings={performanceSettings}
        multiplayer={multiplayerGameConfig ?? undefined}
      />
    );
  }

  return null;
}
