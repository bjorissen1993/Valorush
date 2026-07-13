import { useCallback, useEffect, useRef, useState } from "react";
import type { GameStartingPayload } from "../../shared/lobbyTypes";
import type { TurnOrderDiceSequence } from "../../shared/turnOrderDiceSystem";
import type { Player } from "../types/Player";
import type { Agent } from "../types/Agent";
import type { PlayerInGame } from "../types/Game";
import {
  LobbyClient,
  readLobbySession,
  type TurnOrderRollEvent,
} from "../services/lobbyClient";
import { assignRandomUniqueAgentsSeeded } from "./lobby/lobbyPlayerUtils";
import TurnOrderScreen from "./TurnOrderScreen";

type MultiplayerTurnOrderPageProps = {
  players: Player[];
  agents: Agent[];
  turnOrder: GameStartingPayload["turnOrder"];
  yourPlayerId: string;
  isHost: boolean;
  onHostComplete: (order: number[], players: Player[]) => void;
  onGuestComplete: () => void;
};

function toPlayersInGame(players: Player[], agents: Agent[]): PlayerInGame[] {
  const defaultColors = ["#22c55e", "#38bdf8", "#a78bfa", "#f97316"];

  return players.map((player, index) => {
    const selectedAgent = agents.find(
      (agent) => agent.uuid === player.selectedAgentId
    );

    return {
      ...player,
      avatar: player.avatar ?? selectedAgent?.displayIcon ?? undefined,
      color: player.color ?? defaultColors[index % defaultColors.length],
      position: "start",
      creds: 800,
      radianitePoints: 0,
      weapon: null,
      shield: null,
      nextWeaponDiscount: 0,
    };
  });
}

export default function MultiplayerTurnOrderPage({
  players,
  agents,
  turnOrder,
  yourPlayerId,
  isHost,
  onHostComplete,
  onGuestComplete,
}: MultiplayerTurnOrderPageProps) {
  const clientRef = useRef<LobbyClient | null>(null);
  const [resolvedPlayers, setResolvedPlayers] = useState(players);
  const [syncedRoll, setSyncedRoll] = useState<{
    playerIndex: number;
    roll: number;
    nonce: number;
  } | null>(null);
  const [hostBeginPending, setHostBeginPending] = useState(false);
  const rollNonceRef = useRef(0);

  const localPlayerIndex = turnOrder.playerIndexById[yourPlayerId] ?? 0;

  useEffect(() => {
    const needsRandom = players.some(
      (player) => player.isRandomizePending && !player.selectedAgentId
    );
    const seed = JSON.stringify(turnOrder.sequence.order);
    setResolvedPlayers(
      needsRandom
        ? assignRandomUniqueAgentsSeeded(players, agents, seed)
        : players
    );
  }, [agents, players, turnOrder.sequence.order]);

  useEffect(() => {
    const session = readLobbySession();
    if (!session) return;

    const client = new LobbyClient({
      onRoomState: () => {},
      onGameStarting: () => {},
      onTurnOrderRoll: (event: TurnOrderRollEvent) => {
        rollNonceRef.current += 1;
        setSyncedRoll({
          playerIndex: event.playerIndex,
          roll: event.roll,
          nonce: rollNonceRef.current,
        });
      },
      onTurnOrderDone: () => {
        onGuestComplete();
      },
      onChatMessage: () => {},
      onError: () => {},
      onStatusChange: () => {},
    });

    clientRef.current = client;
    client.connect();
    client.scheduleRejoin(session.code, session.playerId);

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [onGuestComplete]);

  const handleRequestRoll = useCallback((stepIndex: number) => {
    clientRef.current?.requestTurnOrderRoll(stepIndex);
  }, []);

  const handleHostBegin = useCallback(() => {
    setHostBeginPending(true);
    clientRef.current?.finishTurnOrder();
  }, []);

  const handleComplete = useCallback(
    (order: number[]) => {
      if (isHost) {
        onHostComplete(order, resolvedPlayers);
      }
    },
    [isHost, onHostComplete, resolvedPlayers]
  );

  const playersInGame = toPlayersInGame(resolvedPlayers, agents);

  return (
    <TurnOrderScreen
      players={playersInGame}
      agents={agents}
      getAgentName={(player) => player.name}
      sequence={turnOrder.sequence as TurnOrderDiceSequence}
      multiplayer={{
        localPlayerIndex,
        onRequestRoll: handleRequestRoll,
        syncedRoll,
        isHost,
        onHostBegin: handleHostBegin,
        hostBeginPending,
      }}
      onComplete={handleComplete}
    />
  );
}
