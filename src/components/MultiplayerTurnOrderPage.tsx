import { useCallback, useEffect, useRef, useState } from "react";
import type { GameStartingPayload } from "../../shared/lobbyTypes";
import type { TurnOrderDiceSequence } from "../../shared/turnOrderDiceSystem";
import type { Player } from "../types/Player";
import type { Agent } from "../types/Agent";
import type { PlayerInGame } from "../types/Game";
import {
  LobbyClient,
  persistLobbySession,
  readLobbySession,
  readStoredLobbySession,
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
  onMatchBegin: (order: number[], players: Player[]) => void;
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
      primaryWeapon: null,
      secondaryWeapon: null,
      shield: null,
      nextWeaponDiscount: 0,
      items: [],
      movementBonus: 0,
      movementBonusTurns: 0,
      maxStepsPerTurn: null,
      maxStepsTurns: 0,
    };
  });
}

export default function MultiplayerTurnOrderPage({
  players,
  agents,
  turnOrder,
  yourPlayerId,
  isHost,
  onMatchBegin,
}: MultiplayerTurnOrderPageProps) {
  const clientRef = useRef<LobbyClient | null>(null);
  const resolvedPlayersRef = useRef(players);
  const [resolvedPlayers, setResolvedPlayers] = useState(players);
  const [syncedRoll, setSyncedRoll] = useState<{
    playerIndex: number;
    roll: number;
    nonce: number;
  } | null>(null);
  const [hostBeginPending, setHostBeginPending] = useState(false);
  const rollNonceRef = useRef(0);
  const matchStartedRef = useRef(false);

  const localPlayerIndex = turnOrder.playerIndexById[yourPlayerId] ?? 0;

  useEffect(() => {
    const needsRandom = players.some(
      (player) => player.isRandomizePending && !player.selectedAgentId
    );
    const seed = JSON.stringify(turnOrder.sequence.order);
    const nextPlayers = needsRandom
      ? assignRandomUniqueAgentsSeeded(players, agents, seed)
      : players;
    resolvedPlayersRef.current = nextPlayers;
    setResolvedPlayers(nextPlayers);
  }, [agents, players, turnOrder.sequence.order]);

  const beginMatch = useCallback(
    (order: number[]) => {
      if (matchStartedRef.current) return;
      matchStartedRef.current = true;

      const session = readLobbySession();
      if (session) {
        const stored = readStoredLobbySession();
        persistLobbySession(session.code, session.playerId, {
          phase: "in_game",
          turnOrder: order,
          isHost: stored?.isHost,
          gameStarting: stored?.gameStarting,
          profile: stored?.profile,
        });
      }

      onMatchBegin(order, resolvedPlayersRef.current);
    },
    [onMatchBegin]
  );

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
      onTurnOrderDone: () => {},
      onGameBegin: (payload) => {
        beginMatch(payload.turnOrder);
      },
      onGameState: () => {},
      onGameAction: () => {},
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
  }, [beginMatch]);

  const handleRequestRoll = useCallback((stepIndex: number) => {
    clientRef.current?.requestTurnOrderRoll(stepIndex);
  }, []);

  const handleHostBegin = useCallback(() => {
    setHostBeginPending(true);
    clientRef.current?.finishTurnOrder();
  }, []);

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
      onComplete={() => {}}
    />
  );
}
