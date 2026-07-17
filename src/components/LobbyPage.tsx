import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "../types/Player";
import type { Agent } from "../types/Agent";
import { buildTestPlayers } from "../data/testPreset";
import TwitchImportPanel from "./TwitchImportPanel";
import AgentRoster from "./lobby/AgentRoster";
import LobbyArenaLayout from "./lobby/LobbyArenaLayout";
import LobbyHotbar from "./lobby/LobbyHotbar";
import LobbyPlayerCard from "./lobby/LobbyPlayerCard";
import RoomChatWidget from "./lobby/RoomChatWidget";
import { useLocalChat } from "../hooks/useLocalChat";
import {
  assignRandomUniqueAgents,
  buildFixedPlayerSlots,
  findFirstEmptySlotIndex,
  isRandomizePending,
  resolvePlayerAvatarUrl,
} from "./lobby/lobbyPlayerUtils";

type LobbyPageProps = {
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  agents: Agent[];
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  onContinue: () => void;
  onBack?: () => void;
};

const MAX_PLAYERS = 4;

function RemovePlayerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title="Remove player"
      className="absolute right-2 top-2 rounded-lg p-1.5 text-zinc-500 opacity-0 transition-opacity duration-75 ease-out hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 sm:right-3 sm:top-3"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
      </svg>
    </button>
  );
}

export default function LobbyPage({
  players,
  setPlayers,
  agents,
  setAgents,
  onContinue,
  onBack,
}: LobbyPageProps) {
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null);
  const [presetError, setPresetError] = useState<string | null>(null);
  const { messages: chatMessages, sendChatMessage } = useLocalChat(true);

  const chatSpeaker =
    players.find((player) => player.id === activePlayerId) ?? players[0] ?? null;
  const chatPlayerId = chatSpeaker ? String(chatSpeaker.id) : "local";

  function handleSendChatMessage(text: string) {
    sendChatMessage(text, chatPlayerId, chatSpeaker?.name ?? "Player");
  }

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    async function loadAgents() {
      try {
        setAgentsLoading(true);
        setAgentsError(null);

        const response = await fetch(
          "https://valorant-api.com/v1/agents?isPlayableCharacter=true"
        );

        if (!response.ok) {
          throw new Error("Failed to load agents");
        }

        const json = await response.json();

        const mappedAgents: Agent[] = json.data
          .filter((agent: any) => agent.displayName && agent.displayIcon)
          .map((agent: any) => ({
            uuid: agent.uuid,
            displayName: agent.displayName,
            displayIcon: agent.displayIcon,
            fullPortrait: agent.fullPortrait,
          }))
          .sort((a: Agent, b: Agent) =>
            a.displayName.localeCompare(b.displayName)
          );

        setAgents(mappedAgents);
      } catch (error) {
        console.error(error);
        setAgentsError("Could not load agents.");
      } finally {
        setAgentsLoading(false);
      }
    }

    if (agents.length === 0) {
      loadAgents();
    } else {
      setAgentsLoading(false);
    }
  }, [agents.length, setAgents]);

  function addPlayer() {
    const slotIndex = findFirstEmptySlotIndex(players);
    if (slotIndex == null) return;

    const newPlayer: Player = {
      id: Date.now(),
      slotIndex,
      name: `Player ${slotIndex + 1}`,
    };

    setPlayers((current) => [...current, newPlayer]);
  }

  const rosterPlayers = useMemo(
    () =>
      players.map((player) => ({
        id: player.id,
        selectedAgentId: player.selectedAgentId,
      })),
    [players]
  );

  const handleSelectAgent = useCallback(
    (agentId: string) => {
      if (activePlayerId == null) return;
      setPlayers((current) =>
        current.map((player) =>
          player.id === activePlayerId
            ? {
                ...player,
                selectedAgentId: agentId,
                isRandomizePending: false,
              }
            : player
        )
      );
    },
    [activePlayerId, setPlayers]
  );

  const handleToggleRandomize = useCallback(() => {
    if (activePlayerId == null) return;
    setPlayers((current) =>
      current.map((player) => {
        if (player.id !== activePlayerId) return player;

        if (isRandomizePending(player)) {
          return { ...player, isRandomizePending: false };
        }

        return {
          ...player,
          isRandomizePending: true,
          selectedAgentId: undefined,
        };
      })
    );
  }, [activePlayerId, setPlayers]);

  const handleRandomizeAll = useCallback(() => {
    setPlayers((current) =>
      current.map((player) => ({
        ...player,
        isRandomizePending: true,
        selectedAgentId: undefined,
      }))
    );
  }, [setPlayers]);

  const handleSelectPlayer = useCallback((playerId: number) => {
    setActivePlayerId((current) => (current === playerId ? null : playerId));
  }, []);

  const handlePlayerNameChange = useCallback(
    (playerId: number, name: string) => {
      setPlayers((current) =>
        current.map((player) =>
          player.id === playerId ? { ...player, name } : player
        )
      );
    },
    [setPlayers]
  );

  const handleRemovePlayer = useCallback(
    (playerId: number) => {
      setPlayers((current) => current.filter((player) => player.id !== playerId));
      setActivePlayerId((current) => (current === playerId ? null : current));
    },
    [setPlayers]
  );

  const handleAvatarClick = useCallback((playerId: number) => {
    fileInputRefs.current[playerId]?.click();
  }, []);

  const handleAvatarChange = useCallback(
    (playerId: number, event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const imageUrl = URL.createObjectURL(file);

      setPlayers((current) =>
        current.map((player) =>
          player.id === playerId ? { ...player, avatar: imageUrl } : player
        )
      );
    },
    [setPlayers]
  );

  const registerFileInputRef = useCallback(
    (playerId: number, element: HTMLInputElement | null) => {
      fileInputRefs.current[playerId] = element;
    },
    []
  );

  function loadTestPreset() {
    if (agentsLoading) return;

    if (agents.length === 0) {
      setPresetError("Agents are still loading. Try again in a moment.");
      return;
    }

    try {
      setPresetError(null);
      setActivePlayerId(null);
      setPlayers(buildTestPlayers(agents));
    } catch (error) {
      console.error(error);
      setPresetError("Could not load test preset.");
    }
  }

  const canStartGame =
    players.length === MAX_PLAYERS &&
    players.every(
      (player) => !!player.selectedAgentId || player.isRandomizePending
    ) &&
    agents.length >= MAX_PLAYERS;

  const handleStartGame = useCallback(() => {
    setPlayers((current) => {
      const needsRandom = current.some(
        (player) => player.isRandomizePending && !player.selectedAgentId
      );
      return needsRandom ? assignRandomUniqueAgents(current, agents) : current;
    });
    onContinue();
  }, [agents, onContinue, setPlayers]);

  const activePlayerRandomizePending = useMemo(() => {
    if (activePlayerId == null) return false;
    const activePlayer = players.find((player) => player.id === activePlayerId);
    return activePlayer ? isRandomizePending(activePlayer) : false;
  }, [activePlayerId, players]);

  const allRandomizePending = useMemo(
    () => players.length > 0 && players.every((player) => isRandomizePending(player)),
    [players]
  );

  const playerSlots = useMemo(
    () => buildFixedPlayerSlots(players, MAX_PLAYERS),
    [players]
  );

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const agent of agents) {
      map.set(agent.uuid, agent);
    }
    return map;
  }, [agents]);

  const slots = useMemo(
    () =>
      playerSlots.map((player, index) => {
        const mirrored = index === 1 || index === 3;

        if (!player) {
          return (
            <LobbyPlayerCard
              key={`placeholder-${index}`}
              isEmpty
              mirrored={mirrored}
              name=""
              emptyTitle="Empty slot"
              emptySubtitle="Add a player from the hotbar above"
            />
          );
        }

        return (
          <ClassicLobbyPlayerSlot
            key={player.id}
            player={player}
            mirrored={mirrored}
            isActive={activePlayerId === player.id}
            isRandomizePending={isRandomizePending(player)}
            selectedAgent={
              player.selectedAgentId
                ? agentById.get(player.selectedAgentId)
                : undefined
            }
            onSelectPlayer={handleSelectPlayer}
            onNameChange={handlePlayerNameChange}
            onRemove={handleRemovePlayer}
            onAvatarClick={handleAvatarClick}
            onAvatarChange={handleAvatarChange}
            registerFileInputRef={registerFileInputRef}
          />
        );
      }),
    [
      activePlayerId,
      agentById,
      handleAvatarChange,
      handleAvatarClick,
      handlePlayerNameChange,
      handleRemovePlayer,
      handleSelectPlayer,
      playerSlots,
      registerFileInputRef,
    ]
  );

  return (
    <div className="flex h-dvh flex-col bg-[#070b14] text-white">
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col px-3 py-3 sm:px-5 sm:py-4 lg:px-6">
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-visible rounded-2xl border border-white/10 bg-zinc-900/95 shadow-lg lg:rounded-3xl">
          <div className="relative z-20 shrink-0 overflow-visible border-b border-white/10 bg-gradient-to-r from-red-500/10 via-transparent to-cyan-400/10 px-5 py-4 sm:px-6 lg:px-8 lg:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="mb-2 text-sm text-zinc-400 transition hover:text-white"
                  >
                    ← Back to Home
                  </button>
                )}
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-400 sm:text-sm">
                  Valorush
                </p>
                <h1 className="mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl lg:text-4xl">
                  Player Setup
                </h1>
                <p className="mt-1 text-sm text-zinc-400 lg:mt-2">
                  Add players, then select a slot and pick agents from the center roster.
                </p>
              </div>

              <div className="relative h-10 w-10 shrink-0">
                <RoomChatWidget
                  messages={chatMessages}
                  onSend={handleSendChatMessage}
                  yourPlayerId={chatPlayerId}
                  title="Chat"
                />
              </div>
            </div>
          </div>

          <LobbyHotbar>
            <TwitchImportPanel
              players={players}
              setPlayers={setPlayers}
              maxPlayers={MAX_PLAYERS}
              variant="hotbar"
            />

            <div className="hidden h-6 w-px bg-white/10 sm:block" />

            <div className="hidden items-center gap-3 text-sm text-zinc-400 md:flex">
              <span>
                <span className="font-semibold text-white">{players.length}</span>
                /{MAX_PLAYERS} players
              </span>
              <span className="text-zinc-600">·</span>
              <span>Classic</span>
              <span className="text-zinc-600">·</span>
              <span>Free for All</span>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadTestPreset}
                disabled={agentsLoading || agents.length === 0}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {agentsLoading ? "Loading..." : "Test Preset"}
              </button>

              <button
                type="button"
                onClick={addPlayer}
                disabled={players.length >= MAX_PLAYERS}
                className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Add Player
              </button>

              <button
                type="button"
                onClick={handleStartGame}
                disabled={!canStartGame}
                title={
                  canStartGame
                    ? "All players are ready"
                    : "Need 4 players with agents selected or random"
                }
                className="rounded-lg bg-gradient-to-r from-red-500 to-orange-400 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Game
              </button>
            </div>
          </LobbyHotbar>

          <div className="flex min-h-0 flex-1 flex-col overflow-visible p-4 sm:p-5 lg:p-6">
            {(agentsError || presetError) && (
              <div className="mb-3 shrink-0 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {agentsError ?? presetError}
              </div>
            )}

            <LobbyArenaLayout
              roster={
                <AgentRoster
                  agents={agents}
                  players={rosterPlayers}
                  activePlayerId={activePlayerId}
                  activePlayerRandomizePending={activePlayerRandomizePending}
                  allRandomizePending={allRandomizePending}
                  loading={agentsLoading}
                  onToggleRandomize={handleToggleRandomize}
                  onRandomizeAll={handleRandomizeAll}
                  onSelectAgent={handleSelectAgent}
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

type ClassicLobbyPlayerSlotProps = {
  player: Player;
  mirrored: boolean;
  isActive: boolean;
  isRandomizePending?: boolean;
  selectedAgent?: Agent;
  onSelectPlayer: (playerId: number) => void;
  onNameChange: (playerId: number, name: string) => void;
  onRemove: (playerId: number) => void;
  onAvatarClick: (playerId: number) => void;
  onAvatarChange: (
    playerId: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  registerFileInputRef: (
    playerId: number,
    element: HTMLInputElement | null
  ) => void;
};

const ClassicLobbyPlayerSlot = memo(function ClassicLobbyPlayerSlot({
  player,
  mirrored,
  isActive,
  isRandomizePending = false,
  selectedAgent,
  onSelectPlayer,
  onNameChange,
  onRemove,
  onAvatarClick,
  onAvatarChange,
  registerFileInputRef,
}: ClassicLobbyPlayerSlotProps) {
  const handleClick = useCallback(() => {
    onSelectPlayer(player.id);
  }, [onSelectPlayer, player.id]);

  const handleNameChange = useCallback(
    (name: string) => {
      onNameChange(player.id, name);
    },
    [onNameChange, player.id]
  );

  const handleRemove = useCallback(() => {
    onRemove(player.id);
  }, [onRemove, player.id]);

  const handleAvatarClick = useCallback(() => {
    onAvatarClick(player.id);
  }, [onAvatarClick, player.id]);

  const handleAvatarChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onAvatarChange(player.id, event);
    },
    [onAvatarChange, player.id]
  );

  const setFileInputRef = useCallback(
    (element: HTMLInputElement | null) => {
      registerFileInputRef(player.id, element);
    },
    [registerFileInputRef, player.id]
  );

  const avatar = resolvePlayerAvatarUrl(player, selectedAgent);

  return (
    <LobbyPlayerCard
      name={player.name}
      avatar={avatar}
      profileAvatar={player.avatar}
      agentIcon={isRandomizePending ? null : selectedAgent?.displayIcon}
      agentPortrait={
        isRandomizePending
          ? null
          : selectedAgent?.fullPortrait ?? selectedAgent?.displayIcon ?? null
      }
      agentName={isRandomizePending ? undefined : selectedAgent?.displayName}
      isRandomizePending={isRandomizePending}
      twitchLogin={player.twitchLogin}
      twitchImportedName={player.twitchImportedName}
      mirrored={mirrored}
      isActive={isActive}
      editableName
      onNameChange={handleNameChange}
      onClick={handleClick}
      onAvatarClick={handleAvatarClick}
      avatarInput={
        <input
          ref={setFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
      }
      headerAction={<RemovePlayerButton onClick={handleRemove} />}
    />
  );
});
