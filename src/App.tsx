import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LobbyPage from "./components/LobbyPage";
import LoadingScreen from "./components/LoadingScreen";
import GamePage from "./components/GamePage";
import HomePage from "./components/HomePage";
import LobbyIdentityPage from "./components/LobbyIdentityPage";
import LobbyCodeEntryModal from "./components/LobbyCodeEntryModal";
import MultiplayerLobbyPage from "./components/MultiplayerLobbyPage";
import MultiplayerTurnOrderPage from "./components/MultiplayerTurnOrderPage";
import { usePerformanceSettings } from "./hooks/usePerformanceSettings";
import { useAgents } from "./hooks/useLobbyRoom";
import {
  canonicalizeLobbyUrl,
  clearLobbySession,
  clearPendingJoinCode,
  lobbyCodeToSlug,
  navigateToHome,
  readJoinCodeFromUrl,
  readLobbySlugFromUrl,
  readLobbyUrlContext,
  readPendingJoinCode,
  readStoredLobbySession,
  setPendingJoinCode,
  syncLobbyUrl,
  validateLobbyCode,
} from "./services/lobbyClient";
import {
  clearLocalSession,
  persistLocalSession,
  readLocalSession,
  type LocalSession,
} from "./services/localSession";
import { clearLocalChat } from "./services/localChatStore";
import {
  completeTwitchOAuthIfPending,
  consumeTwitchOAuthError,
  identityToProfile,
} from "./services/twitchOAuth";
import { lobbyPlayersToLocalIds } from "../shared/lobbyTypes";
import { LOBBY_SLUG_LENGTH } from "../shared/lobbySlug";
import type { Player } from "./types/Player";
import type { Agent } from "./types/Agent";
import type { GameStartingPayload, PlayerProfile } from "../shared/lobbyTypes";
import type { OnlineGameSnapshot } from "../shared/onlineGameTypes";

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

type RestoredLocalState = {
  screen: Screen;
  players: Player[];
  agents: Agent[];
  gameSnapshot: OnlineGameSnapshot | null;
};

function parseLobbySlugFromReturnPath(returnPath: string): string | null {
  const pathMatch = returnPath.match(/\/lobby\/([A-Za-z0-9]+)/i);
  return pathMatch?.[1]?.toLowerCase() ?? null;
}

/**
 * Restore multiplayer UI from localStorage.
 * Priority #1 fix: do not require a preflight validateLobbyCode (that used to
 * wipe the session on transient WS errors and drop users on the home screen).
 */
function restoreMultiplayerFromSession(): RestoredMultiplayerState | null {
  const stored = readStoredLobbySession();
  if (!stored?.profile || !stored.playerId || !stored.code) return null;

  const urlSlug = readLobbySlugFromUrl();
  const storedSlug = lobbyCodeToSlug(stored.code);
  // Opened a different lobby link than the stored session — let URL join win.
  if (urlSlug && urlSlug !== storedSlug) return null;

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
  if (stored.phase === "turn_order" && mpSession) screen = "mp_turn_order";
  if (stored.phase === "in_game" && mpSession) screen = "game";
  // Missing gameStarting payload → fall back to lobby rather than a broken game screen.

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

function restoreLocalFromSession(): RestoredLocalState | null {
  // Prefer online restore when a multiplayer session is active for this URL.
  if (restoreMultiplayerFromSession()) return null;
  if (readLobbyUrlContext()) return null;

  const stored = readLocalSession();
  if (!stored) return null;

  let screen: Screen = "local_lobby";
  if (stored.phase === "pregame") screen = "pregame";
  if (stored.phase === "game") {
    screen = stored.gameSnapshot ? "game" : "pregame";
  }

  return {
    screen,
    players: stored.players,
    agents: stored.agents ?? [],
    gameSnapshot: stored.gameSnapshot ?? null,
  };
}

export default function App() {
  const restoredMp = useMemo(() => {
    canonicalizeLobbyUrl();
    return restoreMultiplayerFromSession();
  }, []);
  const restoredLocal = useMemo(() => restoreLocalFromSession(), []);

  const performanceSettings = usePerformanceSettings();
  const [screen, setScreen] = useState<Screen>(
    restoredMp?.screen ?? restoredLocal?.screen ?? "home"
  );
  const [mpMode, setMpMode] = useState<"create" | "join">(
    restoredMp?.mpMode ?? "create"
  );
  const [joinCode, setJoinCode] = useState(restoredMp?.joinCode ?? "");
  const [lobbyProfile, setLobbyProfile] = useState<PlayerProfile | null>(
    restoredMp?.lobbyProfile ?? null
  );
  const [homeJoinError, setHomeJoinError] = useState<string | null>(null);
  const [validatingUrlJoin, setValidatingUrlJoin] = useState(false);
  const [codeEntrySlug, setCodeEntrySlug] = useState<string | null>(null);
  const urlJoinHandledRef = useRef(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [mpSession, setMpSession] = useState<{
    payload: GameStartingPayload;
    isHost: boolean;
    yourPlayerId: string;
  } | null>(restoredMp?.mpSession ?? null);
  const [mpTurnOrder, setMpTurnOrder] = useState<number[]>(
    restoredMp?.mpTurnOrder ?? []
  );

  const [players, setPlayers] = useState<Player[]>(
    restoredMp?.players ?? restoredLocal?.players ?? []
  );
  const [localAgents, setLocalAgents] = useState<Agent[]>(
    restoredLocal?.agents ?? []
  );
  const [localGameSnapshot, setLocalGameSnapshot] =
    useState<OnlineGameSnapshot | null>(restoredLocal?.gameSnapshot ?? null);
  const { agents: loadedAgents } = useAgents();
  const agents = localAgents.length > 0 ? localAgents : loadedAgents;

  // Ensure hashed lobby slug is in the URL after a localStorage restore.
  useEffect(() => {
    if (restoredMp?.joinCode) {
      syncLobbyUrl(restoredMp.joinCode);
    }
  }, [restoredMp]);

  const persistLocal = useCallback(
    (next: Partial<LocalSession> & { phase: LocalSession["phase"] }) => {
      const session: LocalSession = {
        phase: next.phase,
        players: next.players ?? players,
        agents: next.agents ?? (localAgents.length > 0 ? localAgents : undefined),
        gameSnapshot:
          next.gameSnapshot !== undefined
            ? next.gameSnapshot
            : next.phase === "game"
              ? localGameSnapshot ?? undefined
              : undefined,
      };
      persistLocalSession(session);
      if (next.gameSnapshot !== undefined) {
        setLocalGameSnapshot(next.gameSnapshot);
      }
    },
    [localAgents, localGameSnapshot, players]
  );

  const handleOAuthProfile = useCallback((profile: PlayerProfile, returnPath: string) => {
    setLobbyProfile(profile);

    const slugFromReturn = parseLobbySlugFromReturnPath(returnPath);
    const pendingCode = readPendingJoinCode();
    const codeFromPending =
      pendingCode &&
      slugFromReturn &&
      lobbyCodeToSlug(pendingCode) ===
        slugFromReturn.toLowerCase().slice(0, LOBBY_SLUG_LENGTH)
        ? pendingCode
        : null;
    const code =
      codeFromPending ||
      readJoinCodeFromUrl() ||
      (returnPath.includes("join=")
        ? new URLSearchParams(returnPath.split("?")[1] ?? "").get("join")
        : null);

    if (slugFromReturn || returnPath.includes("join=") || code) {
      const normalized = code ? code.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
      if (normalized) {
        setJoinCode(normalized);
        setPendingJoinCode(normalized);
        syncLobbyUrl(normalized);
      } else if (slugFromReturn) {
        setCodeEntrySlug(
          slugFromReturn.toLowerCase().slice(0, LOBBY_SLUG_LENGTH)
        );
        setScreen("home");
        return;
      }
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

  // Cold load with /lobby/:slug and no matching session → code entry popup.
  useEffect(() => {
    if (restoredMp || restoredLocal) return;
    if (screen !== "home" || urlJoinHandledRef.current) return;

    const ctx = readLobbyUrlContext();
    if (!ctx) return;

    urlJoinHandledRef.current = true;

    const knownCode =
      ctx.kind === "code"
        ? ctx.code
        : readPendingJoinCode() &&
            lobbyCodeToSlug(readPendingJoinCode()!) === ctx.slug
          ? readPendingJoinCode()!
          : null;

    if (knownCode) {
      setValidatingUrlJoin(true);
      setHomeJoinError(null);
      void validateLobbyCode(knownCode)
        .then(() => {
          setJoinCode(knownCode);
          setPendingJoinCode(knownCode);
          syncLobbyUrl(knownCode);
          setScreen("identity_join");
        })
        .catch((error) => {
          navigateToHome("replace");
          clearPendingJoinCode();
          setHomeJoinError(
            error instanceof Error
              ? error.message
              : "Lobby not found. Check the join code."
          );
        })
        .finally(() => {
          setValidatingUrlJoin(false);
        });
      return;
    }

    // Slug-only link without a stored session — ask for the real code.
    setCodeEntrySlug(ctx.slug);
  }, [restoredLocal, restoredMp, screen]);

  // Browser back/forward: keep screen in sync with the URL.
  useEffect(() => {
    function onPopState() {
      const ctx = readLobbyUrlContext();
      if (!ctx) {
        clearLobbySession();
        clearLocalSession();
        setLobbyProfile(null);
        setJoinCode("");
        setMpSession(null);
        setMpTurnOrder([]);
        setPlayers([]);
        setLocalGameSnapshot(null);
        setHomeJoinError(null);
        setCodeEntrySlug(null);
        setScreen("home");
        return;
      }

      const stored = readStoredLobbySession();
      if (
        stored?.code &&
        lobbyCodeToSlug(stored.code) === ctx.slug &&
        stored.profile
      ) {
        setJoinCode(stored.code);
        setLobbyProfile(stored.profile);
        setMpMode(stored.isHost ? "create" : "join");
        setCodeEntrySlug(null);

        const nextSession = stored.gameStarting
          ? {
              payload: stored.gameStarting,
              isHost: stored.isHost ?? false,
              yourPlayerId: stored.playerId,
            }
          : null;
        setMpSession(nextSession);
        setMpTurnOrder(stored.turnOrder ?? []);
        setPlayers(
          stored.gameStarting
            ? lobbyPlayersToLocalIds(stored.gameStarting.players)
            : []
        );

        if (stored.phase === "in_game" && nextSession) setScreen("game");
        else if (stored.phase === "turn_order" && nextSession)
          setScreen("mp_turn_order");
        else setScreen("mp_lobby");
        return;
      }

      const knownCode =
        ctx.kind === "code"
          ? ctx.code
          : readPendingJoinCode() &&
              lobbyCodeToSlug(readPendingJoinCode()!) === ctx.slug
            ? readPendingJoinCode()!
            : null;

      if (knownCode) {
        setJoinCode(knownCode);
        setMpMode("join");
        setCodeEntrySlug(null);
        setScreen("identity_join");
        return;
      }

      setCodeEntrySlug(ctx.slug);
      setScreen("home");
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Persist local lobby / pregame whenever players change.
  useEffect(() => {
    if (screen !== "local_lobby" && screen !== "pregame") return;
    persistLocal({
      phase: screen,
      players,
      agents: localAgents.length > 0 ? localAgents : undefined,
      gameSnapshot: undefined,
    });
  }, [localAgents, persistLocal, players, screen]);

  function resetToHome() {
    navigateToHome();
    clearPendingJoinCode();
    setLobbyProfile(null);
    setJoinCode("");
    setMpSession(null);
    setMpTurnOrder([]);
    setHomeJoinError(null);
    setCodeEntrySlug(null);
    setScreen("home");
  }

  function startGame() {
    persistLocal({
      phase: "game",
      players,
      agents: localAgents.length > 0 ? localAgents : undefined,
      gameSnapshot: undefined,
    });
    setLocalGameSnapshot(null);
    setScreen("game");
  }

  function goToPreGame() {
    persistLocal({
      phase: "pregame",
      players,
      agents: localAgents.length > 0 ? localAgents : undefined,
      gameSnapshot: undefined,
    });
    setScreen("pregame");
  }

  function leaveLocalSession() {
    clearLocalSession();
    clearLocalChat();
    setLocalGameSnapshot(null);
    resetToHome();
    setPlayers([]);
    setLocalAgents([]);
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
      resumedFromSession: restoredMp?.screen === "game",
    };
  }, [mpSession, mpTurnOrder, restoredMp?.screen]);

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
              Close
            </button>
          </div>
        )}
        <HomePage
          joinError={homeJoinError}
          validatingJoin={validatingUrlJoin}
          onCreateLobby={() => {
            setOauthError(null);
            setHomeJoinError(null);
            clearLocalSession();
            setScreen("identity_create");
          }}
          onJoinLobby={(code) => {
            setOauthError(null);
            setHomeJoinError(null);
            clearLocalSession();
            if (code) {
              const normalized = code.toUpperCase();
              setJoinCode(normalized);
              setPendingJoinCode(normalized);
              syncLobbyUrl(normalized, "push");
            }
            setScreen("identity_join");
          }}
          onLocalGame={() => {
            setOauthError(null);
            setHomeJoinError(null);
            clearLobbySession();
            clearLocalChat();
            navigateToHome("replace");
            setScreen("local_lobby");
          }}
        />
        <LobbyCodeEntryModal
          open={!!codeEntrySlug}
          slug={codeEntrySlug ?? ""}
          onBackHome={() => {
            clearPendingJoinCode();
            setCodeEntrySlug(null);
            navigateToHome("replace");
          }}
          onSuccess={(code) => {
            setCodeEntrySlug(null);
            setJoinCode(code);
            setPendingJoinCode(code);
            syncLobbyUrl(code, "replace");
            setScreen("identity_join");
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
        onBack={() => {
          clearLobbySession();
          resetToHome();
        }}
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
              clearLobbySession();
              resetToHome();
              return;
            }
            setPendingJoinCode(joinCode);
            syncLobbyUrl(joinCode);
          }
          setLobbyProfile(profile);
          setMpMode("join");
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
        onBack={() => {
          clearLobbySession();
          resetToHome();
        }}
        onJoinFailed={(message) => {
          setHomeJoinError(message);
          clearLobbySession();
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
        onBack={leaveLocalSession}
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
        initialSnapshot={
          multiplayerGameConfig ? undefined : localGameSnapshot ?? undefined
        }
        onBackToLobby={multiplayerGameConfig ? undefined : leaveLocalSession}
        onLeaveMatch={multiplayerGameConfig ? leaveMultiplayerMatch : undefined}
        onLocalSnapshotChange={
          multiplayerGameConfig
            ? undefined
            : (snapshot) => {
                setLocalGameSnapshot(snapshot);
                persistLocalSession({
                  phase: "game",
                  players,
                  agents: localAgents.length > 0 ? localAgents : undefined,
                  gameSnapshot: snapshot,
                });
              }
        }
        performanceSettings={performanceSettings}
        multiplayer={multiplayerGameConfig ?? undefined}
      />
    );
  }

  return null;
}
