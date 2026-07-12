import { memo, useEffect, useMemo, useState } from "react";
import type { PlayerProfile } from "../../shared/lobbyTypes";
import { MAX_LOBBY_PLAYERS } from "../../shared/lobbyTypes";
import { useAgents, useLobbyRoom } from "../hooks/useLobbyRoom";
import { buildJoinUrl } from "../services/lobbyClient";
import type { Agent } from "../types/Agent";
import type { LobbyPlayer } from "../../shared/lobbyTypes";
import AgentRoster from "./lobby/AgentRoster";
import LobbyArenaLayout from "./lobby/LobbyArenaLayout";
import LobbyHotbar from "./lobby/LobbyHotbar";
import LobbyPlayerCard from "./lobby/LobbyPlayerCard";
import {
  buildFixedPlayerSlots,
  resolvePlayerAvatarUrl,
} from "./lobby/lobbyPlayerUtils";

type MultiplayerLobbyPageProps = {
  mode: "create" | "join";
  profile: PlayerProfile;
  joinCode?: string;
  onBack: () => void;
  onGameStarting: (players: LobbyPlayer[], isHost: boolean) => void;
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

  const {
    roomState,
    yourPlayer,
    isHost,
    connectionStatus,
    error,
    gameStartingPlayers,
    selectAgent,
    startGame,
    leaveLobby,
  } = useLobbyRoom({
    mode,
    profile,
    joinCode,
    enabled: true,
  });

  useEffect(() => {
    if (gameStartingPlayers) {
      onGameStarting(gameStartingPlayers, isHost);
    }
  }, [gameStartingPlayers, isHost, onGameStarting]);

  useEffect(() => {
    if (error) setStartError(error);
  }, [error]);

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

  const canStart =
    isHost &&
    roomState?.players.length === MAX_LOBBY_PLAYERS &&
    roomState.players.every((player) => !!player.selectedAgentId);

  const connectedCount = roomState?.players.length ?? 0;
  const yourPlayerId = yourPlayer?.id ?? null;

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
              emptySubtitle="Share the join code from the hotbar"
            />
          );
        }

        const selectedAgent = player.selectedAgentId
          ? agentById.get(player.selectedAgentId)
          : undefined;
        const isYou = player.id === yourPlayerId;

        return (
          <MultiplayerLobbyPlayerSlot
            key={player.id}
            player={player}
            mirrored={mirrored}
            isYou={isYou}
            selectedAgent={selectedAgent}
          />
        );
      }),
    [agentById, playerSlots, yourPlayerId]
  );

  async function copyJoinLink() {
    if (!roomState?.code) return;
    const url = buildJoinUrl(roomState.code);
    try {
      await navigator.clipboard.writeText(url);
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

  return (
    <div className="flex h-dvh flex-col bg-[#070b14] text-white">
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col px-3 py-3 sm:px-5 sm:py-4 lg:px-6">
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-lg lg:rounded-3xl">
          <div className="shrink-0 border-b border-white/10 bg-gradient-to-r from-red-500/10 via-transparent to-cyan-400/10 px-5 py-4 sm:px-6 lg:px-8 lg:py-5">
            <div>
              <button
                type="button"
                onClick={handleLeave}
                className="text-sm text-zinc-400 transition hover:text-white"
              >
                ← Leave lobby
              </button>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.35em] text-red-400 sm:mt-4 sm:text-sm">
                Valorush Lobby
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl lg:text-4xl">
                Waiting Room
              </h1>
              <p className="mt-1 text-sm text-zinc-400 lg:mt-2">
                {connectionStatus === "connected"
                  ? "Pick your agent from the center roster — taken agents are grayed out."
                  : connectionStatus === "connecting"
                    ? "Connecting to lobby server..."
                    : "Reconnecting..."}
              </p>
            </div>
          </div>

          <LobbyHotbar>
            {roomState?.code && (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/70">
                    Code
                  </span>
                  <span className="font-mono text-lg font-bold tracking-[0.15em] text-cyan-300">
                    {roomState.code}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void copyJoinLink()}
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/5"
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>

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
                  title={
                    canStart
                      ? "Everyone is ready"
                      : `Need ${MAX_LOBBY_PLAYERS} players with agents selected`
                  }
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

          <div className="flex min-h-0 flex-1 flex-col overflow-visible p-4 sm:p-5 lg:p-6">
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
                  activePlayerId={yourPlayerId}
                  loading={agentsLoading}
                  disabled={!yourPlayer}
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
  selectedAgent?: Agent;
};

const MultiplayerLobbyPlayerSlot = memo(function MultiplayerLobbyPlayerSlot({
  player,
  mirrored,
  isYou,
  selectedAgent,
}: MultiplayerLobbyPlayerSlotProps) {
  const avatar = resolvePlayerAvatarUrl(player, selectedAgent);

  return (
    <LobbyPlayerCard
      name={player.name}
      avatar={avatar}
      profileAvatar={player.avatar}
      agentIcon={selectedAgent?.displayIcon}
      agentPortrait={
        selectedAgent?.fullPortrait ?? selectedAgent?.displayIcon ?? null
      }
      agentName={selectedAgent?.displayName}
      twitchLogin={player.twitchLogin}
      twitchImportedName={player.twitchImportedName}
      mirrored={mirrored}
      isYou={isYou}
      isHost={player.isHost}
      isActive={isYou}
    />
  );
});
