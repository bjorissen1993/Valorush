import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerProfile } from "../../shared/lobbyTypes";
import { MAX_LOBBY_PLAYERS } from "../../shared/lobbyTypes";
import { useAgents, useLobbyRoom } from "../hooks/useLobbyRoom";
import { buildJoinUrl } from "../services/lobbyClient";
import type { Agent } from "../types/Agent";
import type { GameStartingPayload, LobbyPlayer } from "../../shared/lobbyTypes";
import AgentRoster from "./lobby/AgentRoster";
import LobbyArenaLayout from "./lobby/LobbyArenaLayout";
import LobbyChatPanel from "./lobby/LobbyChatPanel";
import LobbyHotbar from "./lobby/LobbyHotbar";
import LobbyPlayerCard from "./lobby/LobbyPlayerCard";
import {
  buildFixedPlayerSlots,
  isRandomizePending,
  resolvePlayerAvatarUrl,
} from "./lobby/lobbyPlayerUtils";

type MultiplayerLobbyPageProps = {
  mode: "create" | "join";
  profile: PlayerProfile;
  joinCode?: string;
  onBack: () => void;
  onGameStarting: (payload: GameStartingPayload, isHost: boolean, yourPlayerId: string) => void;
};

export default function MultiplayerLobbyPage({
  mode,
  profile,
  joinCode,
  onBack,
  onGameStarting,
}: MultiplayerLobbyPageProps) {
  const { agents, loading: agentsLoading, error: agentsError } = useAgents();
  const [copied, setCopied] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [codeVisible, setCodeVisible] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPanelMounted, setChatPanelMounted] = useState(false);
  const [lastReadChatCount, setLastReadChatCount] = useState(0);
  const inviteRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const {
    roomState,
    yourPlayer,
    yourPlayerId,
    isHost,
    connectionStatus,
    error,
    gameStartingPayload,
    chatMessages,
    selectAgent,
    toggleRandomize,
    randomizeAll,
    setReady,
    startGame,
    sendChatMessage,
    leaveLobby,
  } = useLobbyRoom({
    mode,
    profile,
    joinCode,
    enabled: true,
  });

  const unreadChatCount = chatOpen
    ? 0
    : Math.max(0, chatMessages.length - lastReadChatCount);

  useEffect(() => {
    if (chatOpen) {
      setChatPanelMounted(true);
      setLastReadChatCount(chatMessages.length);
    }
  }, [chatOpen, chatMessages.length]);

  function handleChatMorphTransitionEnd(
    event: React.TransitionEvent<HTMLDivElement>
  ) {
    if (event.target !== event.currentTarget) return;
    if (event.propertyName !== "width") return;
    if (!chatOpen) {
      setChatPanelMounted(false);
    }
  }

  useEffect(() => {
    if (gameStartingPayload && yourPlayerId) {
      onGameStarting(gameStartingPayload, isHost, yourPlayerId);
    }
  }, [gameStartingPayload, isHost, onGameStarting, yourPlayerId]);

  useEffect(() => {
    if (error) setStartError(error);
  }, [error]);

  useEffect(() => {
    if (!inviteOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (inviteRef.current && !inviteRef.current.contains(event.target as Node)) {
        setInviteOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inviteOpen]);

  useEffect(() => {
    if (!chatOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        setChatOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [chatOpen]);

  const playerSlots = useMemo(
    () => buildFixedPlayerSlots(roomState?.players ?? [], MAX_LOBBY_PLAYERS),
    [roomState?.players]
  );

  const rosterPlayers = useMemo(
    () =>
      (roomState?.players ?? []).map((player) => ({
        id: player.id,
        selectedAgentId: player.selectedAgentId,
      })),
    [roomState?.players]
  );

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const agent of agents) {
      map.set(agent.uuid, agent);
    }
    return map;
  }, [agents]);

  const players = roomState?.players ?? [];
  const allHaveAgentChoice = players.every(
    (player) => !!player.selectedAgentId || player.isRandomizePending
  );
  const allReady = players.length > 0 && players.every((player) => player.isReady);
  const notReadyNames = players.filter((player) => !player.isReady).map((p) => p.name);

  const canStart =
    isHost &&
    players.length === MAX_LOBBY_PLAYERS &&
    allHaveAgentChoice &&
    allReady;

  const connectedCount = players.length;
  const activeYourPlayerId = yourPlayerId ?? yourPlayer?.id ?? null;

  const activePlayerRandomizePending = yourPlayer
    ? isRandomizePending(yourPlayer)
    : false;

  const allRandomizePending =
    players.length > 0 && players.every((player) => isRandomizePending(player));

  const canReady =
    !!yourPlayer &&
    (!!yourPlayer.selectedAgentId || !!yourPlayer.isRandomizePending);

  const slots = useMemo(
    () =>
      playerSlots.map((player, index) => {
        const mirrored = index === 1 || index === 3;

        if (!player) {
          return (
            <LobbyPlayerCard
              key={`empty-${index}`}
              isEmpty
              mirrored={mirrored}
              name=""
              emptyTitle="Waiting for player..."
              emptySubtitle="Share the invite link from the hotbar"
            />
          );
        }

        const selectedAgent = player.selectedAgentId
          ? agentById.get(player.selectedAgentId)
          : undefined;
        const isYou = player.id === activeYourPlayerId;
        const pendingRandom = isRandomizePending(player);

        return (
          <MultiplayerLobbyPlayerSlot
            key={player.id}
            player={player}
            mirrored={mirrored}
            isYou={isYou}
            isRandomizePending={pendingRandom}
            selectedAgent={selectedAgent}
          />
        );
      }),
    [agentById, playerSlots, activeYourPlayerId]
  );

  async function copyJoinLink() {
    if (!roomState?.code) return;
    const url = buildJoinUrl(roomState.code);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setInviteOpen(false);
    } catch {
      setCopied(false);
    }
  }

  function handleCodeVisibilityToggle() {
    if (!roomState?.code) return;
    if (codeVisible) {
      setCodeVisible(false);
      setCopied(false);
      return;
    }
    setCodeVisible(true);
  }

  async function handleCodeCopy() {
    if (!roomState?.code) return;

    try {
      await navigator.clipboard.writeText(roomState.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleLeave() {
    leaveLobby();
    onBack();
  }

  function handleStartGame() {
    setStartError(null);
    startGame();
  }

  function handleToggleReady() {
    if (!yourPlayer) return;
    setReady(!yourPlayer.isReady);
  }

  const startDisabledTitle = canStart
    ? "Everyone is ready"
    : players.length < MAX_LOBBY_PLAYERS
      ? `Need ${MAX_LOBBY_PLAYERS - players.length} more player(s)`
      : !allHaveAgentChoice
        ? "Everyone must pick an agent or choose random"
        : !allReady
          ? `Not ready yet: ${notReadyNames.join(", ")}`
          : "Cannot start yet";

  return (
    <div className="flex h-dvh flex-col bg-[#070b14] text-white">
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col px-3 py-3 sm:px-5 sm:py-4 lg:px-6">
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-visible rounded-2xl border border-white/10 bg-zinc-900/95 shadow-lg lg:rounded-3xl">
          <div className="relative z-20 shrink-0 overflow-visible border-b border-white/10 bg-gradient-to-r from-red-500/10 via-transparent to-cyan-400/10 px-5 py-4 sm:px-6 lg:px-8 lg:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={handleLeave}
                  className="text-sm text-zinc-400 transition hover:text-white"
                >
                  ← Leave lobby
                </button>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.35em] text-red-400 sm:mt-4 sm:text-sm">
                  ValoRush Lobby
                </p>
                <h1 className="mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl lg:text-4xl">
                  Waiting Room
                </h1>
                <p className="mt-1 text-sm text-zinc-400 lg:mt-2">
                  {connectionStatus === "connected"
                    ? "Pick your agent in the center — taken agents are grayed out."
                    : connectionStatus === "connecting"
                      ? "Connecting to lobby server..."
                      : "Reconnecting..."}
                </p>
              </div>

              <div className="relative h-10 w-10 shrink-0" ref={chatRef}>
                <div
                  onTransitionEnd={handleChatMorphTransitionEnd}
                  className={`absolute right-0 top-0 z-50 origin-top-right overflow-hidden rounded-xl border transition-[width,height,background-color,border-color,box-shadow] duration-300 ease-out ${
                    chatOpen
                      ? "h-[20rem] w-[22rem] max-w-[min(calc(100vw-2.5rem),22rem)] border-cyan-400/40 bg-zinc-950/98 shadow-2xl backdrop-blur-md"
                      : "h-10 w-10 border-white/10 bg-white/5"
                  }`}
                >
                  {chatPanelMounted ? (
                    <LobbyChatPanel
                      open={chatOpen}
                      onClose={() => setChatOpen(false)}
                      messages={chatMessages}
                      onSend={sendChatMessage}
                      yourPlayerId={yourPlayerId}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setChatOpen(true)}
                      className="relative flex h-full w-full items-center justify-center text-zinc-300 transition hover:border-white/20 hover:text-white"
                      title="Lobby chat"
                      aria-label="Open lobby chat"
                      aria-expanded={false}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-5 w-5"
                        aria-hidden
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.375c-1.056 0-2.094.038-3.11.114a9.49 9.49 0 00-1.775 1.403 7.053 7.053 0 01-1.133.534A1.378 1.378 0 0112 21.75c-.995 0-1.933-.417-2.607-1.16a8.963 8.963 0 00-1.775-1.403 9.49 9.49 0 00-1.11-.114 48.901 48.901 0 00-3.476-.375c-1.978 0-3.348-1.024-3.348-2.97v-6.02c0-1.946 1.37-3.678 3.348-3.97A49.144 49.144 0 0112 2.25z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {unreadChatCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-zinc-900" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <LobbyHotbar>
            {roomState?.code && (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/70">
                    Code
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCodeCopy()}
                    className="font-mono text-lg font-bold tracking-[0.15em] text-cyan-300 transition hover:text-cyan-200"
                    title="Click to copy lobby code"
                  >
                    {codeVisible ? roomState.code : "••••••"}
                  </button>
                  {copied && (
                    <span className="text-[10px] font-semibold text-emerald-300">
                      Copied!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleCodeVisibilityToggle}
                    className="rounded p-0.5 text-cyan-300 transition hover:bg-cyan-400/10 hover:text-cyan-200"
                    title={codeVisible ? "Hide lobby code" : "Reveal lobby code"}
                    aria-label={codeVisible ? "Hide lobby code" : "Reveal lobby code"}
                  >
                    {codeVisible ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="h-4 w-4"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="h-4 w-4"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="relative" ref={inviteRef}>
                  <button
                    type="button"
                    onClick={() => setInviteOpen((open) => !open)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold transition hover:bg-white/10"
                    aria-expanded={inviteOpen}
                  >
                    + Invite
                  </button>

                  {inviteOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-white/10 bg-zinc-950/98 shadow-2xl backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => void copyJoinLink()}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/5"
                      >
                        {copied ? "Link copied!" : "Copy invite link"}
                      </button>
                      <button
                        type="button"
                        disabled
                        className="flex w-full items-center gap-2 border-t border-white/5 px-4 py-3 text-left text-sm text-zinc-500"
                        title="Coming soon"
                      >
                        Discord invite
                        <span className="ml-auto text-[10px] uppercase tracking-wider">
                          Soon
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="hidden h-6 w-px bg-white/10 sm:block" />
              </>
            )}

            <div className="text-sm text-zinc-400">
              <span className="font-semibold text-white">{connectedCount}</span>
              /{MAX_LOBBY_PLAYERS} connected
            </div>

            <div className="ml-auto flex items-center gap-2">
              {isHost ? (
                <button
                  type="button"
                  onClick={handleStartGame}
                  disabled={!canStart}
                  title={startDisabledTitle}
                  className="rounded-lg bg-gradient-to-r from-red-500 to-orange-400 px-4 py-2 text-sm font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start Game
                </button>
              ) : (
                <span className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400">
                  Waiting for host...
                </span>
              )}
            </div>
          </LobbyHotbar>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5 lg:p-6">
            {(agentsError || startError) && (
              <div className="mb-3 shrink-0 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {startError ?? agentsError}
              </div>
            )}

            <LobbyArenaLayout
              roster={
                <AgentRoster
                  agents={agents}
                  players={rosterPlayers}
                  activePlayerId={activeYourPlayerId}
                  activePlayerRandomizePending={activePlayerRandomizePending}
                  allRandomizePending={allRandomizePending}
                  loading={agentsLoading}
                  disabled={!yourPlayer}
                  onToggleRandomize={toggleRandomize}
                  onRandomizeAll={isHost ? randomizeAll : undefined}
                  onToggleReady={yourPlayer ? handleToggleReady : undefined}
                  isReady={yourPlayer?.isReady ?? false}
                  canReady={canReady}
                  onSelectAgent={selectAgent}
                />
              }
              slots={slots}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type MultiplayerLobbyPlayerSlotProps = {
  player: LobbyPlayer;
  mirrored: boolean;
  isYou: boolean;
  isRandomizePending: boolean;
  selectedAgent?: Agent;
};

const MultiplayerLobbyPlayerSlot = memo(function MultiplayerLobbyPlayerSlot({
  player,
  mirrored,
  isYou,
  isRandomizePending: pendingRandom,
  selectedAgent,
}: MultiplayerLobbyPlayerSlotProps) {
  const avatar = resolvePlayerAvatarUrl(player, selectedAgent);

  return (
    <LobbyPlayerCard
      name={player.name}
      avatar={avatar}
      profileAvatar={player.avatar}
      agentIcon={pendingRandom ? null : selectedAgent?.displayIcon}
      agentPortrait={
        pendingRandom
          ? null
          : selectedAgent?.fullPortrait ?? selectedAgent?.displayIcon ?? null
      }
      agentName={pendingRandom ? undefined : selectedAgent?.displayName}
      isRandomizePending={pendingRandom}
      twitchLogin={player.twitchLogin}
      twitchImportedName={player.twitchImportedName}
      mirrored={mirrored}
      isYou={isYou}
      isHost={player.isHost}
      isReady={player.isReady}
      isActive={isYou}
    />
  );
});
