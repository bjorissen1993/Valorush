import { useCallback, useEffect, useRef, useState } from "react";
import type { Player } from "../types/Player";
import type { Agent } from "../types/Agent";
import type { PlayerInGame, GameEvent } from "../types/Game";
import type {
  OnlineGameAction,
  OnlineGameSnapshot,
} from "../../shared/onlineGameTypes";
import { useOnlineGameSync } from "../hooks/useOnlineGameSync";
import BoardMap from "./BoardMap";
import TurnBanner from "./TurnBanner";
import TurnOrderScreen from "./TurnOrderScreen";
import EventStoryModal from "./EventStoryModal";
import ShopModal, { type ShopOffer } from "./ShopModal";
import DiceRollOverlay, { type DiceOverlayPhase } from "./DiceRollOverlay";
import { DICE_REVEAL_BLINK_MS } from "./DiceFace";
import ValorantCrate from "./valorant/ValorantCrate";
import { StoryArtPanel, StoryDialogueLines } from "./StoryArtPanel";
import { isEffectivePerformanceMode } from "../hooks/usePerformanceSettings";
import type { usePerformanceSettings } from "../hooks/usePerformanceSettings";
import {
  traverseMovement,
  sleep,
  animateJump,
  getNodeCoords,
  MOVE_STEP_DELAY,
} from "../game/systems/movementSystem";
import {
  resolveLandingTile,
  applyEventEffect,
  getNormalTileMessage,
} from "../game/systems/landingSystem";
import { eventPool } from "../game/eventPool";
import {
  personalizeEventStory,
  resolveEventForPlayer,
} from "../game/narrativeSystem";
import { resolveEventOutcome } from "../game/eventResolution";
import type {
  ActiveSpike,
  SpikePlantReveal,
  DefuseEligibility,
} from "../game/systems/spikeSystem";
import {
  createActiveSpike,
  shouldSpikeDetonate,
  markSpikeDetonated,
  shouldRewardPlanter,
  markSpikeRewarded,
  getDefuseEligibility,
  resolveSpikeDefuseRoll,
  applySpikeDefuseOutcome,
  shouldRewardDefuser,
  markFirstPassOpportunityUsed,
} from "../game/systems/spikeSystem";
import {
  SHOP_TILE_DISCOUNT,
  buyWeaponForPlayer,
  getWeaponFinalPrice,
  type WeaponName,
} from "../game/systems/shopSystem";
import {
  getNextPlayerMeta,
  getNextPlayerName,
} from "../game/systems/turnSystem";
import {
  compareDuelRolls,
  applyDuelWinReward,
  DUEL_WIN_CREDS,
  DUEL_WIN_RADIANITE,
  type DuelOutcome,
} from "../game/systems/duelSystem";
import {
  rollForAllPlayers,
  findMinigameWinner,
  applyMinigameWinReward,
  MINIGAME_WIN_CREDS,
  MINIGAME_WIN_RADIANITE,
  type MinigameRollResult,
} from "../game/systems/minigameSystem";
import { rankPlayersByScore } from "../game/systems/gameOverSystem";
import { weaponImageMap, shieldImageMap } from "../game/data/weaponImages";
import { agentBackgroundPath, agentPortraitPath } from "../game/assetPaths";

type MultiplayerGameConfig = {
  isHost: boolean;
  yourPlayerId: string;
  yourPlayerIndex: number;
  playerIndexByLobbyId: Record<string, number>;
  initialTurnOrder: number[];
};

type GamePageProps = {
  players: Player[];
  agents: Agent[];
  onBackToLobby?: () => void;
  onLeaveMatch?: () => void;
  performanceSettings: ReturnType<typeof usePerformanceSettings>;
  multiplayer?: MultiplayerGameConfig;
};

const MAX_ROUNDS = 10;
const DICE_ROLL_DURATION_MS = 1400;
const DICE_RESULT_HOLD_MS = 900;
const AUTO_ADVANCE_DELAY = 1200;
const DEBUG = true;

type TurnPhase = "roll-for-order" | "playing" | "resolving-event" | "game-over";
type DiceFlowPhase = "hidden" | DiceOverlayPhase;

type ShopKeeper = {
  name: string;
  image: string;
};

type PendingPathChoice = {
  playerIndex: number;
  atNodeId: string;
  remainingSteps: number;
  options: string[];
};

export type MovementResult = {
  blockedBySplit: boolean;
  finalNodeId: string;
  remainingSteps?: number;
  splitOptions?: string[];
  stoppedBySpikeDefuse?: boolean;
};

type DefusePromptState = {
  playerIndex: number;
  nodeId: string;
  eligibility: DefuseEligibility;
};

export type AnimatedTokenState = {
  playerIndex: number;
  x: number;
  y: number;
  jumpOffset: number;
} | null;

const defaultColors = ["#22c55e", "#38bdf8", "#a78bfa", "#f97316"];

type DuelPhase =
  | { step: "pick-opponent"; challengerIndex: number }
  | {
      step: "result";
      challengerIndex: number;
      opponentIndex: number;
      challengerRoll: number;
      opponentRoll: number;
      outcome: DuelOutcome;
    };

type MinigamePhase =
  | { step: "intro"; triggeredByIndex: number }
  | {
      step: "result";
      triggeredByIndex: number;
      rolls: MinigameRollResult[];
      winnerIndex: number;
    };

function randomDiceRoll() {
  return Math.floor(Math.random() * 6) + 1;
}

function AnimatedNumber({ value }: { value: number }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const fromRef = useRef(value);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const from = fromRef.current;
    const to = value;

    if (from === to) {
      el.textContent = String(to);
      return;
    }

    if (isEffectivePerformanceMode() || document.hidden) {
      el.textContent = String(to);
      fromRef.current = to;
      return;
    }

    const duration = 400;
    let rafId = 0;
    let startTime: number | null = null;

    function animate(timestamp: number) {
      if (!el) return;

      if (document.hidden) {
        el.textContent = String(to);
        fromRef.current = to;
        return;
      }

      if (!startTime) startTime = timestamp;

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        fromRef.current = to;
      }
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  return <span ref={spanRef}>{value}</span>;
}

export default function GamePage({
  players,
  agents,
  onBackToLobby,
  onLeaveMatch,
  performanceSettings,
  multiplayer,
}: GamePageProps) {
  const isOnlineGuest = !!multiplayer && !multiplayer.isHost;
  const initialTurnOrder = multiplayer?.initialTurnOrder ?? [];
  const hasPresetTurnOrder = initialTurnOrder.length > 0;
  const { effectivePerformanceMode, performanceMode, togglePerformanceMode } =
    performanceSettings;
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [playersInGame, setPlayersInGame] = useState<PlayerInGame[]>(
    players.map((player, index): PlayerInGame => {
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
    })
  );

  const [phase, setPhase] = useState<TurnPhase>(
    hasPresetTurnOrder ? "playing" : "roll-for-order"
  );
  const [round, setRound] = useState(1);

  const [turnOrder, setTurnOrder] = useState<number[]>(initialTurnOrder);
  const [currentTurnOrderIndex, setCurrentTurnOrderIndex] = useState(0);
  const [turnOrderRevealOpen, setTurnOrderRevealOpen] = useState(!hasPresetTurnOrder);
  const [shopKeeper, setShopKeeper] = useState<ShopKeeper | null>(null);
  const [shopOffers, setShopOffers] = useState<ShopOffer[]>([]);
  const [pendingPurchase, setPendingPurchase] = useState<ShopOffer | null>(null);
  const [purchasedShopOfferIds, setPurchasedShopOfferIds] = useState<string[]>([]);

  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [diceDisplayValue, setDiceDisplayValue] = useState<number | null>(null);
  const [diceFlowPhase, setDiceFlowPhase] = useState<DiceFlowPhase>("hidden");
  const [hasRolledThisTurn, setHasRolledThisTurn] = useState(false);

  const [turnBannerPlayerIndex, setTurnBannerPlayerIndex] = useState<number | null>(null);
  const [lastBannerPlayerIndex, setLastBannerPlayerIndex] = useState<number | null>(null);

  const [statusTitle, setStatusTitle] = useState("Determine turn order");
  const [statusSubtitle, setStatusSubtitle] = useState(
    "One random draw decides who goes first."
  );

  const [announcement, setAnnouncement] = useState<{
    title: string;
    subtitle?: string;
  } | null>(null);

  const announcementTimeoutRef = useRef<number | null>(null);
  const snapshotVersionRef = useRef(0);
  const lastAppliedSnapshotVersionRef = useRef(-1);
  const onlineIntroShownRef = useRef(false);
  const remoteActionHandlerRef = useRef<
    (fromPlayerId: string, action: OnlineGameAction) => void
  >(() => {});

  const applySnapshot = useCallback((snapshot: OnlineGameSnapshot) => {
    if (snapshot.version <= lastAppliedSnapshotVersionRef.current) return;
    lastAppliedSnapshotVersionRef.current = snapshot.version;
    setTurnOrder(snapshot.turnOrder);
    setCurrentTurnOrderIndex(snapshot.currentTurnOrderIndex);
    setRound(snapshot.round);
    setPhase(snapshot.phase);
    setPlayersInGame(snapshot.players as PlayerInGame[]);
    setLastRoll(snapshot.lastRoll);
    setDiceDisplayValue(snapshot.diceDisplayValue);
    setDiceFlowPhase(snapshot.diceFlowPhase);
    setHasRolledThisTurn(snapshot.hasRolledThisTurn);
    setTurnBannerPlayerIndex(snapshot.turnBannerPlayerIndex);
    setStatusTitle(snapshot.statusTitle);
    setStatusSubtitle(snapshot.statusSubtitle);
    setIsMoving(snapshot.isMoving);
    setMovingPlayerIndex(snapshot.movingPlayerIndex);
    setAnimatedToken(snapshot.animatedToken);
    setPendingPathChoice(snapshot.pendingPathChoice);
  }, []);

  const { publishSnapshot, sendAction, leaveMatch } = useOnlineGameSync({
    enabled: !!multiplayer,
    isHost: !!multiplayer?.isHost,
    onSnapshot: applySnapshot,
    onRemoteAction: (fromPlayerId, action) => {
      remoteActionHandlerRef.current(fromPlayerId, action);
    },
  });

  const [isMoving, setIsMoving] = useState(false);
  const [movingPlayerIndex, setMovingPlayerIndex] = useState<number | null>(null);

  const [pendingPathChoice, setPendingPathChoice] =
    useState<PendingPathChoice | null>(null);

  const [animatedToken, setAnimatedToken] = useState<AnimatedTokenState>(null);

  const [lastEventTitle, setLastEventTitle] = useState<string | null>(null);
  const [canBuyAfterLanding, setCanBuyAfterLanding] = useState(false);

  const [activeSpike, setActiveSpike] = useState<ActiveSpike | null>(null);
  const [spikePlantAnimation, setSpikePlantAnimation] = useState<{
    fromNodeId: string;
    toNodeId: string;
  } | null>(null);
  const pendingSpikePlantRef = useRef<{
    spike: ActiveSpike;
    reveal: SpikePlantReveal;
  } | null>(null);
  const [spikeReveal, setSpikeReveal] = useState<SpikePlantReveal | null>(null);
  const [defusePrompt, setDefusePrompt] = useState<DefusePromptState | null>(null);
  const [isResolvingDefuse, setIsResolvingDefuse] = useState(false);
  const [pendingAdvanceAfterSpikeReveal, setPendingAdvanceAfterSpikeReveal] =
    useState<{
      title: string;
      subtitle: string;
    } | null>(null);

  const [spikeDetonationReveal, setSpikeDetonationReveal] = useState<{
    planterName: string;
    planterAgentName: string;
    planterAgentImage?: string | null;
    plantedOnNodeId: string;
  } | null>(null);

  const [pendingSpikeDetonationReveal, setPendingSpikeDetonationReveal] = useState<{
    planterName: string;
    planterAgentName: string;
    planterAgentImage?: string | null;
    plantedOnNodeId: string;
  } | null>(null);

  const [radianiteGainFxPlayerIndex, setRadianiteGainFxPlayerIndex] = useState<number | null>(null);

  const handleTurnBannerDone = useCallback(() => {
    setTurnBannerPlayerIndex(null);
  }, []);

  useEffect(() => {
    playersInGame.forEach((player) => {
      const agent = agents.find((a) => a.uuid === player.selectedAgentId);
      const portrait = agent?.fullPortrait ?? agent?.displayIcon;
      if (portrait) {
        const img = new Image();
        img.src = portrait;
      }
    });
  }, [agents, playersInGame]);

  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        window.clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  const gameFinished =
    playersInGame.length === 0 ||
    round > MAX_ROUNDS ||
    phase === "game-over";

  const currentPlayerIndex =
    phase === "roll-for-order"
      ? turnOrder[0] ?? 0
      : turnOrder[currentTurnOrderIndex] ?? 0;

  const currentPlayer = playersInGame[currentPlayerIndex];

  const [debugOverlayOpen, setDebugOverlayOpen] = useState(false);
  const [debugForcedRoll, setDebugForcedRoll] = useState<number | null>(null);
  const [debugSelectedPlayerIndex, setDebugSelectedPlayerIndex] = useState(0);
  const [debugSelectedNodeId, setDebugSelectedNodeId] = useState("top-1");
  const [debugBoardAction, setDebugBoardAction] = useState<
    "plant-spike" | "teleport-player" | null
  >(null);

  const [duelPhase, setDuelPhase] = useState<DuelPhase | null>(null);
  const [minigamePhase, setMinigamePhase] = useState<MinigamePhase | null>(null);
  const [isResolvingDuel, setIsResolvingDuel] = useState(false);
  const [isResolvingMinigame, setIsResolvingMinigame] = useState(false);

  const [activeStoryEvent, setActiveStoryEvent] = useState<{
    event: GameEvent;
    playerIndex: number;
  } | null>(null);

  useEffect(() => {
    if (
      !canBuyAfterLanding ||
      !pendingPurchase ||
      !currentPlayer
    ) {
      return;
    }

    const cantAfford = currentPlayer.creds < pendingPurchase.price;
    const isSoldOut = purchasedShopOfferIds.includes(pendingPurchase.id);

    if (cantAfford || isSoldOut) {
      setPendingPurchase(null);
    }
  }, [
    canBuyAfterLanding,
    currentPlayer?.creds,
    pendingPurchase,
    purchasedShopOfferIds,
  ]);

  function showTurnBannerFor(playerIndex: number | null) {
    if (playerIndex === null) {
      setTurnBannerPlayerIndex(null);
      return;
    }

    if (lastBannerPlayerIndex === playerIndex) return;

    setTurnBannerPlayerIndex(playerIndex);
    setLastBannerPlayerIndex(playerIndex);
  }

  function showAnnouncement(title: string, subtitle?: string, duration = 2200) {
    setAnnouncement({ title, subtitle });

    if (announcementTimeoutRef.current) {
      window.clearTimeout(announcementTimeoutRef.current);
    }

    announcementTimeoutRef.current = window.setTimeout(() => {
      setAnnouncement(null);
    }, duration);
  }

  useEffect(() => {
    if (!hasPresetTurnOrder || onlineIntroShownRef.current) return;
    onlineIntroShownRef.current = true;

    const firstPlayerIndex = initialTurnOrder[0] ?? 0;
    const firstPlayer = playersInGame[firstPlayerIndex];
    showTurnBannerFor(firstPlayerIndex);
    setStatusTitle("Turn order decided");
    setStatusSubtitle(`${firstPlayer?.name ?? "First player"} starts the match.`);
    showAnnouncement(
      "Turn order decided",
      `${firstPlayer?.name ?? "First player"} starts the match.`,
      2400
    );
  }, [hasPresetTurnOrder, initialTurnOrder, playersInGame]);

  function getAgentName(player: Player) {
    const agent = agents.find((a) => a.uuid === player.selectedAgentId);
    return agent?.displayName ?? "No agent";
  }

  function getAgentData(player: Player) {
    if (!player.selectedAgentId) return null;
    return agents.find((agent) => agent.uuid === player.selectedAgentId) ?? null;
  }

  function getActiveAgentIds() {
    return playersInGame
      .map((player) => player.selectedAgentId)
      .filter((id): id is string => !!id);
  }

  function getWeaponImage(weapon: WeaponName): string | undefined {
    return weaponImageMap[weapon] ?? undefined;
  }

  function getShieldImage(label: string): string | undefined {
    switch (label) {
      case "Light Shields":
        return shieldImageMap.light;
      case "Regen Shield":
        return shieldImageMap.regen;
      case "Heavy Shields":
        return shieldImageMap.heavy;
      default:
        return undefined;
    }
  }

  const sidearmWeapons: WeaponName[] = [
    "Shorty",
    "Frenzy",
    "Ghost",
    "Bandit",
    "Sheriff",
  ];

  const primaryWeapons: WeaponName[] = [
    "Stinger",
    "Spectre",
    "Bucky",
    "Judge",
    "Bulldog",
    "Guardian",
    "Phantom",
    "Vandal",
    "Marshal",
    "Outlaw",
    "Operator",
    "Ares",
    "Odin",
  ];

  function getRandomItems<T>(items: T[], count: number): T[] {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  function getCurrentTurnCycle() {
    return round;
  }

  function updatePlayer(
    playerIndex: number,
    updater: (player: PlayerInGame) => PlayerInGame
  ) {
    setPlayersInGame((current) =>
      current.map((player, index) =>
        index === playerIndex ? updater(player) : player
      )
    );
  }

  function updatePlayerPosition(playerIndex: number, newPosition: string) {
    updatePlayer(playerIndex, (player) => ({
      ...player,
      position: newPosition,
    }));
  }

  function teleportPlayerToNode(playerIndex: number, nodeId: string) {
    updatePlayer(playerIndex, (player) => ({
      ...player,
      position: nodeId,
    }));
  }

  function debugPlantSpikeOnNode(nodeId: string) {
    const selectedPlayer = playersInGame[debugSelectedPlayerIndex];
    if (!selectedPlayer) return;

    const nextPlayerMeta = getNextPlayerMeta({
      fromPlayerIndex: debugSelectedPlayerIndex,
      turnOrder,
      currentTurnOrderIndex,
    });

    const selectedAgent = getAgentData(selectedPlayer);

    setActiveSpike({
      plantedByPlayerIndex: debugSelectedPlayerIndex,
      plantedOnNodeId: nodeId,
      plantedRound: round,
      plantedTurnCycle: round,
      planterAgentName: selectedAgent?.displayName ?? "Debug Agent",
      planterAgentImage:
        selectedAgent?.fullPortrait ?? selectedAgent?.displayIcon ?? null,
      planterAgentId: selectedAgent?.uuid ?? null,
      status: "planted",
      defuseProgress: 0,
      rewarded: false,
      firstPassOpportunityPlayerIndex: nextPlayerMeta.nextPlayerIndex,
      firstPassOpportunityUsed: false,
    });

    setLastEventTitle("Debug Spike Planted");
    setStatusTitle("Debug Spike Planted");
    setStatusSubtitle(`Forced spike on ${nodeId}`);
    showAnnouncement("Debug Spike Planted", `Forced spike on ${nodeId}`);
  }

  function debugHalfDefuseSpike() {
    if (!activeSpike) return;

    setActiveSpike({
      ...activeSpike,
      status: "half-defused",
      defuseProgress: 1,
    });

    setLastEventTitle("Debug Half-Defused");
    setStatusTitle("Debug Half-Defused");
    setStatusSubtitle("Spike set to half-defused.");
    showAnnouncement("Debug Half-Defused", "Spike set to half-defused.");
  }

  function debugDetonateSpikeNow() {
    if (!activeSpike) return;

    const detonated = markSpikeDetonated(activeSpike);
    let resolved = detonated;

    if (shouldRewardPlanter(detonated)) {
      grantRadianiteWithFx(detonated.plantedByPlayerIndex, 1);
      resolved = markSpikeRewarded(detonated);
    }

    setActiveSpike(resolved);

    const planterName =
      playersInGame[resolved.plantedByPlayerIndex]?.name ?? "Player";

    setPendingSpikeDetonationReveal({
      planterName,
      planterAgentName: resolved.planterAgentName,
      planterAgentImage: resolved.planterAgentImage,
      plantedOnNodeId: resolved.plantedOnNodeId,
    });
  }

  function debugOpenDefusePromptForSelectedPlayer() {
    if (!activeSpike) return;

    void handleSpikeDefuseAttempt(
      debugSelectedPlayerIndex,
      activeSpike.plantedOnNodeId,
      true
    );
  }

  function debugForceDefuseSpike() {
    if (!activeSpike) return;

    let resolvedSpike: ActiveSpike = {
      ...activeSpike,
      status: "defused",
      defuseProgress: 1,
    };

    if (shouldRewardDefuser(resolvedSpike)) {
      grantRadianiteWithFx(debugSelectedPlayerIndex, 1);
      resolvedSpike = markSpikeRewarded(resolvedSpike);
    }

    setActiveSpike(resolvedSpike);
    setDefusePrompt(null);
    setLastEventTitle("Debug Spike Defused");
    setStatusTitle("Debug Spike Defused");
    setStatusSubtitle(
      `${playersInGame[debugSelectedPlayerIndex]?.name ?? "Player"} force-defused the spike.`
    );
    showAnnouncement(
      "Debug Spike Defused",
      `${playersInGame[debugSelectedPlayerIndex]?.name ?? "Player"} force-defused the spike.`
    );
  }

  function debugAdjustCreds(playerIndex: number, amount: number) {
    updatePlayer(playerIndex, (player) => ({
      ...player,
      creds: Math.max(0, player.creds + amount),
    }));
  }

  function debugAdjustRadianite(playerIndex: number, amount: number) {
    updatePlayer(playerIndex, (player) => ({
      ...player,
      radianitePoints: Math.max(0, player.radianitePoints + amount),
    }));

    if (amount > 0) {
      setRadianiteGainFxPlayerIndex(playerIndex);
      window.setTimeout(() => {
        setRadianiteGainFxPlayerIndex((current) =>
          current === playerIndex ? null : current
        );
      }, 900);
    }
  }


  function handleSpikePlantAnimationComplete() {
    const pending = pendingSpikePlantRef.current;
    if (!pending) return;

    pendingSpikePlantRef.current = null;
    setActiveSpike(pending.spike);
    setSpikeReveal(pending.reveal);
    setSpikePlantAnimation(null);
  }

  function plantSpikeWithAnimation(playerIndex: number, triggerNodeId: string) {
    const player = playersInGame[playerIndex];
    if (!player) return;

    const nextPlayerMeta = getNextPlayerMeta({
      fromPlayerIndex: playerIndex,
      turnOrder,
      currentTurnOrderIndex,
    });

    const created = createActiveSpike({
      plantedByPlayerIndex: playerIndex,
      plantedRound: round,
      plantedTurnCycle: getCurrentTurnCycle(),
      firstPassOpportunityPlayerIndex: nextPlayerMeta.nextPlayerIndex,
      activeAgentIds: getActiveAgentIds(),
      allAgents: agents,
      excludedNodeIds: [triggerNodeId],
      triggerPlayerName: player.name,
      triggerAgentName: getAgentName(player),
      playersInGame,
    });

    pendingSpikePlantRef.current = {
      spike: created.spike,
      reveal: created.reveal,
    };
    setSpikePlantAnimation({
      fromNodeId: triggerNodeId,
      toNodeId: created.reveal.plantedOnNodeId,
    });
    setLastEventTitle("Spike Planted");
    setStatusTitle(created.reveal.headline);
    setStatusSubtitle(
      `${created.reveal.planterAgentName} helped plant on ${created.reveal.plantedOnNodeId}.`
    );
    showAnnouncement(
      created.reveal.headline,
      `${created.reveal.planterAgentName} → ${created.reveal.plantedOnNodeId}`
    );
    setPendingAdvanceAfterSpikeReveal({
      title: `Next player: ${getResolvedNextPlayerName(playerIndex)}`,
      subtitle: `${getResolvedNextPlayerName(playerIndex)} is now up`,
    });
  }

  function beginShopPhaseForPlayer(playerIndex: number) {
    const player = playersInGame[playerIndex];
    if (!player) return;

    const selectedShopKeeper = getRandomShopKeeper();
    setShopKeeper(selectedShopKeeper);
    const randomSidearms = getRandomItems(sidearmWeapons, 3).sort((a, b) => {
      const priceA = getWeaponFinalPrice({
        weapon: a,
        player,
        isOnShopTile: true,
      });
      const priceB = getWeaponFinalPrice({
        weapon: b,
        player,
        isOnShopTile: true,
      });
      return priceA - priceB;
    });

    const randomPrimaries = getRandomItems(primaryWeapons, 3).sort((a, b) => {
      const priceA = getWeaponFinalPrice({
        weapon: a,
        player,
        isOnShopTile: true,
      });
      const priceB = getWeaponFinalPrice({
        weapon: b,
        player,
        isOnShopTile: true,
      });
      return priceA - priceB;
    });

    const sidearmOffers: ShopOffer[] = randomSidearms.map((weapon) => {
      const price = getWeaponFinalPrice({
        weapon,
        player,
        isOnShopTile: true,
      });

      return {
        id: `weapon-${weapon}`,
        type: "weapon",
        label: weapon,
        weaponName: weapon,
        price,
        description: "Sidearm",
        image: getWeaponImage(weapon),
        disabled: player.creds < price,
      };
    });

    const primaryOffers: ShopOffer[] = randomPrimaries.map((weapon) => {
      const price = getWeaponFinalPrice({
        weapon,
        player,
        isOnShopTile: true,
      });

      return {
        id: `weapon-${weapon}`,
        type: "weapon",
        label: weapon,
        weaponName: weapon,
        price,
        description: "Primary",
        image: getWeaponImage(weapon),
        disabled: player.creds < price,
      };
    });

    const shieldOffers: ShopOffer[] = [
      {
        id: "shield-light",
        type: "shield",
        label: "Light Shields",
        price: 400,
        description: "Basic protection",
        image: getShieldImage("Light Shields"),
        disabled: player.creds < 400,
      },
      {
        id: "shield-regen",
        type: "shield",
        label: "Regen Shield",
        price: 650,
        description: "Regenerates over time",
        image: getShieldImage("Regen Shield"),
        disabled: player.creds < 650,
      },
      {
        id: "shield-heavy",
        type: "shield",
        label: "Heavy Shields",
        price: 1000,
        description: "Maximum protection",
        image: getShieldImage("Heavy Shields"),
        disabled: player.creds < 1000,
      },
    ];

    setShopOffers([...sidearmOffers, ...primaryOffers, ...shieldOffers]);
    setPendingPurchase(null);
    setPurchasedShopOfferIds([]);
    setCanBuyAfterLanding(true);
    setStatusTitle(`${player.name} landed on Shop`);
    setStatusSubtitle("Browse the shop offers.");
    showAnnouncement(`${player.name} landed on Shop`, "Browse the shop offers.");
  }

  function debugTriggerStoryEvent(event: GameEvent) {
    const player = playersInGame[debugSelectedPlayerIndex];
    if (!player) return;

    const personalized = personalizeEventStory(event, {
      triggerPlayer: player,
      triggerAgentName: getAgentName(player),
      playersInGame,
      agents,
    });
    const resolved = resolveEventOutcome(personalized);

    setPhase("resolving-event");
    setActiveStoryEvent({
      event: resolved,
      playerIndex: debugSelectedPlayerIndex,
    });
    setLastEventTitle(resolved.title);
    setStatusTitle(`${player.name} triggered ${resolved.title}`);
    setStatusSubtitle(resolved.outcome?.headline ?? resolved.story.headline);
    showAnnouncement(
      `${player.name} triggered ${resolved.title}`,
      resolved.outcome?.headline ?? resolved.story.headline
    );
  }

  function debugTriggerShop() {
    beginShopPhaseForPlayer(debugSelectedPlayerIndex);
  }

  function debugTriggerDuel() {
    setDuelPhase({
      step: "pick-opponent",
      challengerIndex: debugSelectedPlayerIndex,
    });
    const player = playersInGame[debugSelectedPlayerIndex];
    if (!player) return;
    setStatusTitle(`${player.name} landed on Duel`);
    setStatusSubtitle("Pick an opponent to challenge.");
    showAnnouncement(
      `${player.name} landed on Duel`,
      "Pick an opponent , highest roll wins."
    );
  }

  function debugTriggerMinigame() {
    setMinigamePhase({
      step: "intro",
      triggeredByIndex: debugSelectedPlayerIndex,
    });
    const player = playersInGame[debugSelectedPlayerIndex];
    if (!player) return;
    setStatusTitle(`${player.name} landed on Minigame`);
    setStatusSubtitle("All players roll , highest wins rewards.");
    showAnnouncement(
      `${player.name} triggered a Minigame`,
      "All players roll , highest wins!"
    );
  }

  function debugTriggerSpikePlant() {
    const player = playersInGame[debugSelectedPlayerIndex];
    if (!player) return;

    const spikeAlreadyActive =
      activeSpike &&
      (activeSpike.status === "planted" || activeSpike.status === "half-defused");

    if (spikeAlreadyActive) {
      setStatusTitle(`${player.name} landed on Spike`);
      setStatusSubtitle("A spike is already active on the map.");
      showAnnouncement(
        `${player.name} landed on Spike`,
        "A spike is already active on the map."
      );
      return;
    }

    plantSpikeWithAnimation(debugSelectedPlayerIndex, player.position);
  }

  function handleBoardTileClick(nodeId: string) {
    if (pendingPathChoice?.options.includes(nodeId)) {
      void choosePath(nodeId);
      return;
    }

    handleDebugBoardTileClick(nodeId);
  }

  function handleDebugBoardTileClick(nodeId: string) {
    if (!debugBoardAction) return;

    if (debugBoardAction === "plant-spike") {
      debugPlantSpikeOnNode(nodeId);
      setDebugBoardAction(null);
      return;
    }

    if (debugBoardAction === "teleport-player") {
      teleportPlayerToNode(debugSelectedPlayerIndex, nodeId);
      setStatusTitle("Debug Teleport");
      setStatusSubtitle(
        `${playersInGame[debugSelectedPlayerIndex]?.name ?? "Player"} moved to ${nodeId}.`
      );
      showAnnouncement(
        "Debug Teleport",
        `${playersInGame[debugSelectedPlayerIndex]?.name ?? "Player"} moved to ${nodeId}.`
      );
      setDebugBoardAction(null);
    }
  }

  function closeDebugOverlay() {
    setDebugOverlayOpen(false);
    setDebugBoardAction(null);
    setDebugForcedRoll(null);
  }

  function getResolvedNextPlayerName(fromPlayerIndex: number) {
    return getNextPlayerName({
      fromPlayerIndex,
      turnOrder,
      currentTurnOrderIndex,
      playersInGame,
    });
  }

  function grantRadianiteWithFx(playerIndex: number, amount = 1) {
    updatePlayer(playerIndex, (player) => ({
      ...player,
      radianitePoints: player.radianitePoints + amount,
    }));

    setRadianiteGainFxPlayerIndex(playerIndex);

    window.setTimeout(() => {
      setRadianiteGainFxPlayerIndex((current) =>
        current === playerIndex ? null : current
      );
    }, 900);
  }

  /** Pass-over defuse is allowed on planted or half-defused spikes. */
  function isSpikePassOverEligible(spike: ActiveSpike, playerIdx: number) {
    if (spike.status !== "planted" && spike.status !== "half-defused") {
      return false;
    }
    if (spike.firstPassOpportunityPlayerIndex !== playerIdx) return false;
    if (spike.firstPassOpportunityUsed) return false;
    return true;
  }

  async function handlePassOverSpike(
    nodeId: string,
    playerIdx: number
  ): Promise<boolean> {
    if (!activeSpike) return false;
    if (!isSpikePassOverEligible(activeSpike, playerIdx)) return false;
    return handleSpikeDefuseAttempt(playerIdx, nodeId, false);
  }

  async function finishDuelAndAdvance() {
    if (!duelPhase || duelPhase.step !== "result") return;

    const { challengerIndex, opponentIndex, outcome } = duelPhase;

    if (outcome === "challenger") {
      updatePlayer(challengerIndex, (p) => applyDuelWinReward(p));
      setRadianiteGainFxPlayerIndex(challengerIndex);
      window.setTimeout(() => {
        setRadianiteGainFxPlayerIndex((c) =>
          c === challengerIndex ? null : c
        );
      }, 900);
    } else if (outcome === "opponent") {
      updatePlayer(opponentIndex, (p) => applyDuelWinReward(p));
      setRadianiteGainFxPlayerIndex(opponentIndex);
      window.setTimeout(() => {
        setRadianiteGainFxPlayerIndex((c) =>
          c === opponentIndex ? null : c
        );
      }, 900);
    }

    setLastEventTitle("Duel Resolved");
    setDuelPhase(null);
    setIsResolvingDuel(false);

    await sleep(AUTO_ADVANCE_DELAY);
    await advanceToNextPlayer(
      `Next player: ${getResolvedNextPlayerName(challengerIndex)}`,
      `${getResolvedNextPlayerName(challengerIndex)} is now up`
    );
  }

  async function resolveDuelWithOpponent(opponentIndex: number) {
    if (!duelPhase || duelPhase.step !== "pick-opponent") return;
    if (isResolvingDuel) return;

    setIsResolvingDuel(true);
    const challengerIndex = duelPhase.challengerIndex;

    for (let i = 0; i < 8; i += 1) {
      setDiceDisplayValue(randomDiceRoll());
      await sleep(70);
    }

    const challengerRoll = randomDiceRoll();
    const opponentRoll = randomDiceRoll();
    setDiceDisplayValue(opponentRoll);

    const outcome = compareDuelRolls(challengerRoll, opponentRoll);
    const challengerName = playersInGame[challengerIndex]?.name ?? "Player";
    const opponentName = playersInGame[opponentIndex]?.name ?? "Player";

    setDuelPhase({
      step: "result",
      challengerIndex,
      opponentIndex,
      challengerRoll,
      opponentRoll,
      outcome,
    });

    if (outcome === "tie") {
      setStatusTitle("Duel , Draw");
      setStatusSubtitle(
        `${challengerName} (${challengerRoll}) vs ${opponentName} (${opponentRoll}). No rewards.`
      );
    } else {
      const winnerName = outcome === "challenger" ? challengerName : opponentName;
      const winnerRoll =
        outcome === "challenger" ? challengerRoll : opponentRoll;
      setStatusTitle(`${winnerName} wins the duel!`);
      setStatusSubtitle(
        `+${DUEL_WIN_CREDS} Creds & +${DUEL_WIN_RADIANITE} Radianite. Roll: ${winnerRoll}`
      );
    }

    setLastEventTitle("Duel");
    showAnnouncement(
      outcome === "tie" ? "Duel , Draw" : "Duel Won!",
      outcome === "tie"
        ? `${challengerName} (${challengerRoll}) vs ${opponentName} (${opponentRoll})`
        : `${outcome === "challenger" ? challengerName : opponentName} wins!`
    );
  }

  async function playMinigameRolls() {
    if (!minigamePhase || minigamePhase.step !== "intro") return;
    if (isResolvingMinigame) return;

    setIsResolvingMinigame(true);

    for (let i = 0; i < 10; i += 1) {
      setDiceDisplayValue(randomDiceRoll());
      await sleep(60);
    }

    const rolls = rollForAllPlayers(playersInGame.length);
    const winner = findMinigameWinner(rolls);

    setMinigamePhase({
      step: "result",
      triggeredByIndex: minigamePhase.triggeredByIndex,
      rolls,
      winnerIndex: winner.playerIndex,
    });

    setDiceDisplayValue(winner.roll);

    const winnerName =
      playersInGame[winner.playerIndex]?.name ?? "Player";

    setStatusTitle(`${winnerName} wins the minigame!`);
    setStatusSubtitle(
      `Highest roll (${winner.roll}). +${MINIGAME_WIN_CREDS} Creds & +${MINIGAME_WIN_RADIANITE} Radianite.`
    );
    setLastEventTitle("Minigame");
    showAnnouncement("Minigame Won!", `${winnerName} rolled ${winner.roll}.`);
  }

  async function finishMinigameAndAdvance() {
    if (!minigamePhase || minigamePhase.step !== "result") return;

    const { winnerIndex, triggeredByIndex } = minigamePhase;

    updatePlayer(winnerIndex, (p) => applyMinigameWinReward(p));
    setRadianiteGainFxPlayerIndex(winnerIndex);
    window.setTimeout(() => {
      setRadianiteGainFxPlayerIndex((c) => (c === winnerIndex ? null : c));
    }, 900);

    setMinigamePhase(null);
    setIsResolvingMinigame(false);

    await sleep(AUTO_ADVANCE_DELAY);
    await advanceToNextPlayer(
      `Next player: ${getResolvedNextPlayerName(triggeredByIndex)}`,
      `${getResolvedNextPlayerName(triggeredByIndex)} is now up`
    );
  }

  useEffect(() => {
    if (!activeSpike) return;
    if (phase !== "playing") return;
    if (gameFinished) return;
    if (defusePrompt) return;

    const shouldDetonate = shouldSpikeDetonate({
      spike: activeSpike,
      currentRound: round,
      currentPlayerIndex,
    });

    if (!shouldDetonate) return;

    const detonatedSpike = markSpikeDetonated(activeSpike);
    let resolvedSpike = detonatedSpike;

    if (shouldRewardPlanter(detonatedSpike)) {
      grantRadianiteWithFx(detonatedSpike.plantedByPlayerIndex, 1);
      resolvedSpike = markSpikeRewarded(detonatedSpike);
    }

    setActiveSpike(resolvedSpike);

    const planterName =
      playersInGame[resolvedSpike.plantedByPlayerIndex]?.name ?? "Player";

    setLastEventTitle("Spike Detonated");
    setStatusTitle("Spike Detonated");
    setStatusSubtitle(`${planterName} gained 1 Radianite Point.`);

    setPendingSpikeDetonationReveal({
      planterName,
      planterAgentName: resolvedSpike.planterAgentName,
      planterAgentImage: resolvedSpike.planterAgentImage,
      plantedOnNodeId: resolvedSpike.plantedOnNodeId,
    });

  }, [activeSpike, phase, round, currentPlayerIndex, gameFinished, defusePrompt, playersInGame]);

  useEffect(() => {
    if (!pendingSpikeDetonationReveal) return;
    if (turnBannerPlayerIndex !== null) return;

    setSpikeDetonationReveal(pendingSpikeDetonationReveal);
    showAnnouncement(
      "Spike Detonated",
      `${pendingSpikeDetonationReveal.planterName} gained 1 Radianite Point.`
    );
    setPendingSpikeDetonationReveal(null);
  }, [pendingSpikeDetonationReveal, turnBannerPlayerIndex]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (!activeSpike) return;
    if (!currentPlayer) return;
    if (defusePrompt) return;
    if (diceFlowPhase === "rolling" || diceFlowPhase === "revealing" || isMoving) return;
    if (pendingPathChoice) return;
    if (canBuyAfterLanding) return;
    if (spikeReveal || spikeDetonationReveal || spikePlantAnimation) return;
    if (duelPhase || minigamePhase) return;
    if (activeStoryEvent) return;

    if (
      activeSpike.status !== "planted" &&
      activeSpike.status !== "half-defused"
    ) {
      return;
    }

    if (currentPlayer.position !== activeSpike.plantedOnNodeId) {
      return;
    }

    void handleSpikeDefuseAttempt(currentPlayerIndex, currentPlayer.position, true);
  }, [
    phase,
    activeSpike,
    currentPlayer,
    currentPlayerIndex,
    defusePrompt,
    diceFlowPhase,
    isMoving,
    pendingPathChoice,
    canBuyAfterLanding,
    spikeReveal,
    spikeDetonationReveal,
    spikePlantAnimation,
  ]);

  async function advanceToNextPlayer(title?: string, subtitle?: string) {
    if (turnOrder.length === 0) return;

    const meta = getNextPlayerMeta({
      fromPlayerIndex: currentPlayerIndex,
      turnOrder,
      currentTurnOrderIndex,
    });
    const newRound = meta.wrapsRound ? round + 1 : round;

    setIsMoving(false);
    setMovingPlayerIndex(null);
    setAnimatedToken(null);
    setPendingPathChoice(null);
    setCanBuyAfterLanding(false);
    setDefusePrompt(null);
    setDuelPhase(null);
    setMinigamePhase(null);
    setActiveStoryEvent(null);
    setLastRoll(null);
    setDiceDisplayValue(null);
    setDiceFlowPhase("hidden");
    setHasRolledThisTurn(false);
    setCurrentTurnOrderIndex(meta.nextOrderIndex);
    setRound(newRound);

    if (newRound > MAX_ROUNDS) {
      setPhase("game-over");
      setTurnBannerPlayerIndex(null);
      setStatusTitle("Game Over");
      setStatusSubtitle("The match has ended after 10 rounds.");
      showAnnouncement("Game Over", "Check the final standings.");
      return;
    }

    showTurnBannerFor(meta.nextPlayerIndex);

    const resolvedTitle =
      title ?? `Next player: ${playersInGame[meta.nextPlayerIndex]?.name ?? "Player"}`;
    const resolvedSubtitle =
      subtitle ??
      `${playersInGame[meta.nextPlayerIndex]?.name ?? "Player"} is now up`;

    setStatusTitle(resolvedTitle);
    setStatusSubtitle(resolvedSubtitle);
    showAnnouncement(resolvedTitle, resolvedSubtitle);
  }

  async function handleSpikeDefuseAttempt(
    playerIndex: number,
    nodeId: string,
    landedExactly: boolean
  ) {
    if (!activeSpike) return false;
    if (activeSpike.status === "defused" || activeSpike.status === "detonated") {
      return false;
    }
    if (nodeId !== activeSpike.plantedOnNodeId) return false;
    if (defusePrompt) return false;

    const eligibility = getDefuseEligibility({
      spike: activeSpike,
      playerIndex,
      landedExactly,
    });

    if (eligibility === "not-allowed") {
      return false;
    }

    setLastEventTitle("Spike Defuse");
    setStatusTitle(`${playersInGame[playerIndex]?.name ?? "Player"} found the Spike`);
    setStatusSubtitle(
      landedExactly
        ? "Exact landing: defuse attempt available."
        : "Pass-over: emergency defuse attempt available."
    );

    showAnnouncement(
      `${playersInGame[playerIndex]?.name ?? "Player"} can defuse`,
      landedExactly ? "Exact landing defuse." : "Pass-over defuse."
    );

    setDefusePrompt({
      playerIndex,
      nodeId,
      eligibility,
    });

    return true;
  }

  async function resolveDefuseRoll() {
    if (!defusePrompt || !activeSpike) return;

    setIsResolvingDefuse(true);

    for (let i = 0; i < 8; i += 1) {
      setDiceDisplayValue(randomDiceRoll());
      await sleep(70);
    }

    const roll = randomDiceRoll();
    setDiceDisplayValue(roll);

    let spikeToResolve = activeSpike;

    if (
      defusePrompt.eligibility === "pass-over" &&
      !spikeToResolve.firstPassOpportunityUsed
    ) {
      spikeToResolve = markFirstPassOpportunityUsed(spikeToResolve);
    }

    const outcome = resolveSpikeDefuseRoll(roll, spikeToResolve.defuseProgress);
    let resolvedSpike = applySpikeDefuseOutcome(spikeToResolve, outcome);

    if (shouldRewardDefuser(resolvedSpike)) {
      grantRadianiteWithFx(defusePrompt.playerIndex, 1);
      resolvedSpike = markSpikeRewarded(resolvedSpike);
    }

    setActiveSpike(resolvedSpike);

    const playerName = playersInGame[defusePrompt.playerIndex]?.name ?? "Player";

    if (outcome.kind === "fail") {
      setLastEventTitle("Defuse Failed");
      setStatusTitle("Defuse Failed");
      setStatusSubtitle(`${playerName} rolled ${roll}. The spike is still active.`);
      showAnnouncement("Defuse Failed", `${playerName} rolled ${roll}. The spike is still active.`);
    }

    if (outcome.kind === "half") {
      setLastEventTitle("Spike Half-Defused");
      setStatusTitle("Spike Half-Defused");
      setStatusSubtitle(
        `${playerName} rolled ${roll}. One more successful roll is needed.`
      );
      showAnnouncement(
        "Spike Half-Defused",
        `${playerName} rolled ${roll}. One more successful roll is needed.`
      );
    }

    if (outcome.kind === "defused") {
      setLastEventTitle("Spike Defused");
      setStatusTitle("Spike Defused");
      setStatusSubtitle(`${playerName} rolled ${roll} and gained 1 Radianite Point.`);
      showAnnouncement(
        "Spike Defused",
        `${playerName} rolled ${roll} and gained 1 Radianite Point.`
      );
    }

    await sleep(AUTO_ADVANCE_DELAY);

    setDefusePrompt(null);
    setIsResolvingDefuse(false);

    await advanceToNextPlayer(
      `Next player: ${getResolvedNextPlayerName(defusePrompt.playerIndex)}`,
      `${getResolvedNextPlayerName(defusePrompt.playerIndex)} is now up`
    );
  }

  const shopKeeperPool: ShopKeeper[] = [
    { name: "Chamber", image: "/npc/Chamber_NPC.png" },
    { name: "Cypher", image: "/npc/Cypher_NPC.png" },
    { name: "Raze", image: "/npc/Raze_NPC.png" },
    { name: "Killjoy", image: "/npc/Killjoy_NPC.png" },
    { name: "Viper", image: "/npc/Viper_NPC.png" },
    { name: "Brimstone", image: "/npc/Brimstone_NPC.png" },
  ];

  function getRandomShopKeeper(): ShopKeeper | null {
    const chosenAgentNames = playersInGame
      .map((player) => getAgentName(player))
      .filter((name) => name !== "No agent");

    const availableShopKeepers = shopKeeperPool.filter(
      (keeper) => !chosenAgentNames.includes(keeper.name)
    );

    const pool =
      availableShopKeepers.length > 0 ? availableShopKeepers : shopKeeperPool;

    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  }

  async function finishEventStoryAndAdvance() {
    if (!activeStoryEvent) return;

    const { event, playerIndex } = activeStoryEvent;
    const player = playersInGame[playerIndex];

    updatePlayer(playerIndex, (current) => applyEventEffect(current, event));

    const resolvedEffect = event.outcome?.effect;
    if (
      resolvedEffect?.type === "radianite" &&
      resolvedEffect.amount > 0
    ) {
      setRadianiteGainFxPlayerIndex(playerIndex);
      window.setTimeout(() => {
        setRadianiteGainFxPlayerIndex((c) => (c === playerIndex ? null : c));
      }, 900);
    }

    setActiveStoryEvent(null);
    setPhase("playing");
    setLastEventTitle(event.title);
    setStatusTitle(`${player?.name ?? "Player"} , ${event.title}`);
    setStatusSubtitle(event.outcome?.description ?? event.description);
    showAnnouncement(
      event.title,
      event.outcome?.description ?? event.description
    );

    await sleep(600);
    await advanceToNextPlayer(
      `Next player: ${getResolvedNextPlayerName(playerIndex)}`,
      `${getResolvedNextPlayerName(playerIndex)} is now up`
    );
  }

  async function resolveLanding(
    playerIndex: number,
    finalNodeId: string,
    rolledValue: number
  ) {
    const player = playersInGame[playerIndex];

    if (!player) {
      await advanceToNextPlayer("Next player", "Turn finished.");
      return;
    }

    const startedDefuse = await handleSpikeDefuseAttempt(
      playerIndex,
      finalNodeId,
      true
    );

    if (startedDefuse) {
      return;
    }

    const resolution = resolveLandingTile({
      finalNodeId,
      eventPool,
    });

    if (resolution.kind === "event") {
      const gameEvent = resolveEventForPlayer(eventPool, {
        triggerPlayer: player,
        triggerAgentName: getAgentName(player),
        playersInGame,
        agents,
      });

      setPhase("resolving-event");
      setLastEventTitle(gameEvent.title);
      setStatusTitle(`${player.name} triggered ${gameEvent.title}`);
      setStatusSubtitle(gameEvent.outcome?.headline ?? gameEvent.story.headline);
      showAnnouncement(
        `${player.name} triggered ${gameEvent.title}`,
        gameEvent.outcome?.headline ?? gameEvent.story.headline
      );

      setActiveStoryEvent({ event: gameEvent, playerIndex });
      return;
    }

    if (resolution.kind === "shop") {
      beginShopPhaseForPlayer(playerIndex);
      return;
    }

    if (resolution.kind === "spike") {
      const spikeAlreadyActive =
        activeSpike &&
        (activeSpike.status === "planted" || activeSpike.status === "half-defused");

      if (spikeAlreadyActive) {
        setLastEventTitle("Spike Tile Triggered");
        setStatusTitle(`${player.name} landed on Spike`);
        setStatusSubtitle("A spike is already active on the map.");
        showAnnouncement(
          `${player.name} landed on Spike`,
          "A spike is already active on the map."
        );

        await sleep(AUTO_ADVANCE_DELAY);

        await advanceToNextPlayer(
          `Next player: ${getResolvedNextPlayerName(playerIndex)}`,
          `${getResolvedNextPlayerName(playerIndex)} is now up`
        );
        return;
      }

      plantSpikeWithAnimation(playerIndex, finalNodeId);
      return;
    }

    if (resolution.kind === "minigame") {
      setMinigamePhase({ step: "intro", triggeredByIndex: playerIndex });
      setStatusTitle(`${player.name} landed on Minigame`);
      setStatusSubtitle("All players roll , highest wins rewards.");
      showAnnouncement(
        `${player.name} triggered a Minigame`,
        "All players roll , highest wins!"
      );
      return;
    }

    if (resolution.kind === "duel") {
      setDuelPhase({ step: "pick-opponent", challengerIndex: playerIndex });
      setStatusTitle(`${player.name} landed on Duel`);
      setStatusSubtitle("Pick an opponent to challenge.");
      showAnnouncement(
        `${player.name} landed on Duel`,
        "Pick an opponent , highest roll wins."
      );
      return;
    }

    const tileMessage = getNormalTileMessage(resolution.tileType);
    setStatusTitle(`${player.name} rolled ${rolledValue}`);
    setStatusSubtitle(`Landed on ${tileMessage.title}. ${tileMessage.subtitle}`);
    showAnnouncement(
      `${player.name} , ${tileMessage.title}`,
      tileMessage.subtitle
    );
    await sleep(AUTO_ADVANCE_DELAY);
    await advanceToNextPlayer(
      `Next player: ${getResolvedNextPlayerName(playerIndex)}`,
      `${getResolvedNextPlayerName(playerIndex)} is now up`
    );
  }

  function handleTurnOrderDiceComplete(order: number[]) {
    const firstPlayerIndex = order[0] ?? 0;
    const firstPlayer = playersInGame[firstPlayerIndex];

    setTurnOrder(order);
    setCurrentTurnOrderIndex(0);
    setPhase("playing");
    showTurnBannerFor(firstPlayerIndex);
    setTurnOrderRevealOpen(false);

    setStatusTitle("Turn order decided");
    setStatusSubtitle(`${firstPlayer?.name ?? "First player"} starts the match.`);
    showAnnouncement(
      "Turn order decided",
      `${firstPlayer?.name ?? "First player"} starts the match.`,
      2400
    );
  }

  async function beginDiceRoll() {
    if (diceFlowPhase !== "ready" || !canInteractWithDice()) {
      return;
    }

    setDiceFlowPhase("rolling");
    setLastEventTitle(null);
    setDiceDisplayValue(randomDiceRoll());

    await sleep(DICE_ROLL_DURATION_MS);

    const finalRoll = debugForcedRoll ?? randomDiceRoll();
    setDiceDisplayValue(finalRoll);
    setLastRoll(finalRoll);
    setDiceFlowPhase("revealing");
    await sleep(DICE_REVEAL_BLINK_MS);
    setHasRolledThisTurn(true);
    setDiceFlowPhase("result");
    await sleep(DICE_RESULT_HOLD_MS);
  }

  async function beginMovement() {
    if (diceFlowPhase !== "result" || lastRoll == null) {
      return;
    }

    const finalRoll = lastRoll;
    setDiceFlowPhase("hidden");
    setIsMoving(true);
    setMovingPlayerIndex(currentPlayerIndex);

    const startPosition = playersInGame[currentPlayerIndex]?.position ?? "start";

    const result = (await traverseMovement({
      playerIndex: currentPlayerIndex,
      startNodeId: startPosition,
      steps: finalRoll,
      setAnimatedToken,
      updatePlayerPosition,
      onPassOverSpike: (nodeId, playerIdx) =>
        handlePassOverSpike(nodeId, playerIdx),
    })) as MovementResult;

    if (result.blockedBySplit) {
      setPendingPathChoice({
        playerIndex: currentPlayerIndex,
        atNodeId: result.finalNodeId,
        remainingSteps: result.remainingSteps ?? 1,
        options: result.splitOptions ?? [],
      });
      setIsMoving(false);
      setMovingPlayerIndex(null);
      setAnimatedToken(null);
      return;
    }

    setIsMoving(false);
    setMovingPlayerIndex(null);
    setAnimatedToken(null);

    if (result.stoppedBySpikeDefuse) {
      return;
    }

    await resolveLanding(currentPlayerIndex, result.finalNodeId, finalRoll);
  }

  function handleDiceOverlayAction() {
    if (isOnlineGuest) {
      if (multiplayer?.yourPlayerIndex !== currentPlayerIndex) return;
      if (diceFlowPhase === "ready") {
        sendAction({ type: "roll_dice" });
        return;
      }
      if (diceFlowPhase === "result") {
        sendAction({ type: "begin_movement" });
      }
      return;
    }

    if (diceFlowPhase === "ready") {
      void beginDiceRoll();
      return;
    }

    if (diceFlowPhase === "result") {
      void beginMovement();
    }
  }

  async function choosePath(nextNodeId: string) {
    if (!pendingPathChoice) return;
    if (pendingPathChoice.playerIndex !== currentPlayerIndex) return;

    if (isOnlineGuest) {
      if (multiplayer?.yourPlayerIndex !== currentPlayerIndex) return;
      sendAction({ type: "choose_path", nodeId: nextNodeId });
      return;
    }

    const chosenPlayerIndex = pendingPathChoice.playerIndex;
    const rolledValue = lastRoll ?? 0;
    const splitNodeId = pendingPathChoice.atNodeId;
    const remainingAfterChoice = pendingPathChoice.remainingSteps - 1;

    setPendingPathChoice(null);

    const fromCoords = getNodeCoords(splitNodeId);
    const toCoords = getNodeCoords(nextNodeId);

    if (fromCoords && toCoords) {
      await animateJump(
        chosenPlayerIndex,
        fromCoords.x,
        fromCoords.y,
        toCoords.x,
        toCoords.y,
        setAnimatedToken
      );
    }

    updatePlayerPosition(chosenPlayerIndex, nextNodeId);

    const passOverStartedDefuse = await handleSpikeDefuseAttempt(
      chosenPlayerIndex,
      nextNodeId,
      false
    );

    if (passOverStartedDefuse) {
      setAnimatedToken(null);
      setIsMoving(false);
      setMovingPlayerIndex(null);
      return;
    }

    if (remainingAfterChoice <= 0) {
      setAnimatedToken(null);
      setIsMoving(false);
      setMovingPlayerIndex(null);
      await resolveLanding(chosenPlayerIndex, nextNodeId, rolledValue);
      return;
    }

    await sleep(MOVE_STEP_DELAY);

    const result = (await traverseMovement({
      playerIndex: chosenPlayerIndex,
      startNodeId: nextNodeId,
      steps: remainingAfterChoice,
      setAnimatedToken,
      updatePlayerPosition,
      onPassOverSpike: (nodeId, playerIdx) =>
        handlePassOverSpike(nodeId, playerIdx),
    })) as MovementResult;

    if (result.blockedBySplit) {
      setPendingPathChoice({
        playerIndex: chosenPlayerIndex,
        atNodeId: result.finalNodeId,
        remainingSteps: result.remainingSteps ?? 1,
        options: result.splitOptions ?? [],
      });

      setAnimatedToken(null);
      setIsMoving(false);
      setMovingPlayerIndex(null);
      return;
    }

    setAnimatedToken(null);
    setIsMoving(false);
    setMovingPlayerIndex(null);

    if (result.stoppedBySpikeDefuse) {
      return;
    }

    await resolveLanding(chosenPlayerIndex, result.finalNodeId, rolledValue);
  }

  function confirmPurchase(offer: ShopOffer) {
    if (!currentPlayer) return;

    if (offer.type === "weapon" && offer.weaponName) {
      const result = buyWeaponForPlayer({
        weapon: offer.weaponName as WeaponName,
        player: currentPlayer,
        isOnShopTile: true,
      });

      if (!result.success) {
        const title = "Not enough Creds";
        const subtitle = `${currentPlayer.name} needs ${result.finalPrice} Creds for ${offer.label}.`;
        setStatusTitle(title);
        setStatusSubtitle(subtitle);
        showAnnouncement(title, subtitle);
        return;
      }

      updatePlayer(currentPlayerIndex, () => result.updatedPlayer);
      setPurchasedShopOfferIds((current) =>
        current.includes(offer.id) ? current : [...current, offer.id]
      );
      setPendingPurchase(null);

      const title = `${currentPlayer.name} bought ${offer.label}`;
      const subtitle = `Spent ${result.finalPrice} Creds.`;
      setStatusTitle(title);
      setStatusSubtitle(subtitle);
      showAnnouncement(title, subtitle);
      return;
    }

    if (offer.type === "shield") {
      if (currentPlayer.creds < offer.price) {
        const title = "Not enough Creds";
        const subtitle = `${currentPlayer.name} needs ${offer.price} Creds for ${offer.label}.`;
        setStatusTitle(title);
        setStatusSubtitle(subtitle);
        showAnnouncement(title, subtitle);
        return;
      }

      updatePlayer(currentPlayerIndex, (player) => ({
        ...player,
        creds: player.creds - offer.price,
        shield: offer.label as PlayerInGame["shield"],
      }));

      setPurchasedShopOfferIds((current) =>
        current.includes(offer.id) ? current : [...current, offer.id]
      );
      setPendingPurchase(null);

      const title = `${currentPlayer.name} bought ${offer.label}`;
      const subtitle = `Spent ${offer.price} Creds.`;
      setStatusTitle(title);
      setStatusSubtitle(subtitle);
      showAnnouncement(title, subtitle);
    }
  }

  async function finishShopPhase() {
    if (!canBuyAfterLanding) return;
    setShopKeeper(null);
    setShopOffers([]);
    setPendingPurchase(null);
    setPurchasedShopOfferIds([]);
    await advanceToNextPlayer(
      `Next player: ${getResolvedNextPlayerName(currentPlayerIndex)}`,
      `${getResolvedNextPlayerName(currentPlayerIndex)} is now up`
    );
  }

  function canInteractWithDice() {
    return (
      !gameFinished &&
      playersInGame.length > 0 &&
      phase === "playing" &&
      !isMoving &&
      !pendingPathChoice &&
      !canBuyAfterLanding &&
      !defusePrompt &&
      !duelPhase &&
      !minigamePhase &&
      !activeStoryEvent &&
      !spikePlantAnimation &&
      turnBannerPlayerIndex === null &&
      (!multiplayer || multiplayer.yourPlayerIndex === currentPlayerIndex)
    );
  }

  function openDiceOverlay() {
    if (isOnlineGuest) {
      if (
        multiplayer?.yourPlayerIndex !== currentPlayerIndex ||
        !canInteractWithDice() ||
        hasRolledThisTurn ||
        diceFlowPhase !== "hidden"
      ) {
        return;
      }
      sendAction({ type: "open_dice" });
      return;
    }

    if (!canInteractWithDice() || hasRolledThisTurn || diceFlowPhase !== "hidden") {
      return;
    }

    setDiceFlowPhase("ready");
    setDiceDisplayValue(1);
  }

  useEffect(() => {
    if (!multiplayer?.isHost) return;

    snapshotVersionRef.current += 1;
    publishSnapshot({
      version: snapshotVersionRef.current,
      turnOrder,
      currentTurnOrderIndex,
      round,
      phase,
      players: playersInGame,
      lastRoll,
      diceDisplayValue,
      diceFlowPhase,
      hasRolledThisTurn,
      turnBannerPlayerIndex,
      statusTitle,
      statusSubtitle,
      isMoving,
      movingPlayerIndex,
      animatedToken,
      pendingPathChoice,
    });
  }, [
    animatedToken,
    currentTurnOrderIndex,
    diceDisplayValue,
    diceFlowPhase,
    hasRolledThisTurn,
    isMoving,
    lastRoll,
    movingPlayerIndex,
    multiplayer?.isHost,
    pendingPathChoice,
    phase,
    playersInGame,
    publishSnapshot,
    round,
    statusSubtitle,
    statusTitle,
    turnBannerPlayerIndex,
    turnOrder,
  ]);

  useEffect(() => {
    remoteActionHandlerRef.current = (fromPlayerId, action) => {
      if (!multiplayer?.isHost) return;
      const playerIndex = multiplayer.playerIndexByLobbyId[fromPlayerId];
      if (playerIndex == null || playerIndex !== currentPlayerIndex) return;

      switch (action.type) {
        case "open_dice":
          if (
            !canInteractWithDice() ||
            hasRolledThisTurn ||
            diceFlowPhase !== "hidden"
          ) {
            return;
          }
          setDiceFlowPhase("ready");
          setDiceDisplayValue(1);
          break;
        case "roll_dice":
          if (diceFlowPhase === "ready") {
            void beginDiceRoll();
          }
          break;
        case "begin_movement":
          if (diceFlowPhase === "result") {
            void beginMovement();
          }
          break;
        case "choose_path":
          if (pendingPathChoice?.options.includes(action.nodeId)) {
            void choosePath(action.nodeId);
          }
          break;
        default:
          break;
      }
    };
  });

  function renderShopOfferButton(offer: ShopOffer) {
    const isSoldOut = purchasedShopOfferIds.includes(offer.id);
    const canAfford = (currentPlayer?.creds ?? 0) >= offer.price;
    const canSelect = canAfford && !isSoldOut;

    return (
      <ValorantCrate
        key={offer.id}
        selected={canSelect && pendingPurchase?.id === offer.id}
        disabled={!canAfford}
        soldOut={isSoldOut}
        onClick={() => canSelect && setPendingPurchase(offer)}
      >
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-1 overflow-hidden">
          <div className="shrink-0 truncate text-center text-sm font-semibold text-white md:text-base">
            {offer.label}
          </div>

          <div className="flex min-h-0 items-center justify-center px-2 py-1">
            {offer.image ? (
              <img
                src={offer.image}
                alt={offer.label}
                className="max-h-full max-w-full object-contain"
              />
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-center gap-1.5 pb-0.5 text-sm font-semibold text-emerald-300">
            <img
              src="/points/Credits_icon.png"
              alt=""
              className="h-4 w-4 shrink-0 object-contain"
            />
            <span>{offer.price}</span>
          </div>
        </div>
      </ValorantCrate>
    );
  }

  function getAgentBackgroundImage(player: PlayerInGame) {
    const agent = getAgentData(player);
    if (!agent?.displayName) return null;
    return agentBackgroundPath(agent.displayName);
  }

  function getAgentPortraitImage(player: PlayerInGame) {
    const agent = getAgentData(player);
    if (!agent) return null;
    if (agent.fullPortrait) return agent.fullPortrait;
    if (agent.displayName) return agentPortraitPath(agent.displayName);
    return agent.displayIcon ?? null;
  }

  const rankedPlayers = rankPlayersByScore(playersInGame);
  const winner = rankedPlayers[0];
  const showTurnOrder = turnOrderRevealOpen && phase === "roll-for-order";

  function handleLeaveMatch() {
    setGameMenuOpen(false);
    leaveMatch();
    onLeaveMatch?.();
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#070b14] text-white">
      {multiplayer && (
        <div className="pointer-events-none fixed right-4 top-4 z-[70]">
          <div className="pointer-events-auto relative">
            <button
              type="button"
              onClick={() => setGameMenuOpen((open) => !open)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/90 text-zinc-200 shadow-lg backdrop-blur-md transition hover:border-cyan-400/40 hover:bg-zinc-800 hover:text-white"
              aria-label="Game menu"
              aria-expanded={gameMenuOpen}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-6 w-6"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>

            {gameMenuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[-1] cursor-default"
                  aria-label="Close game menu"
                  onClick={() => setGameMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-10 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/98 shadow-2xl backdrop-blur-md">
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Settings
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={togglePerformanceMode}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white transition hover:bg-white/5"
                  >
                    Performance mode
                    <span className="text-xs font-semibold text-cyan-300">
                      {performanceMode ? "On" : "Off"}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex w-full items-center justify-between border-t border-white/5 px-4 py-3 text-left text-sm text-zinc-500"
                    title="Coming soon"
                  >
                    Sound
                    <span className="text-[10px] uppercase tracking-wider">Soon</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveMatch}
                    className="flex w-full border-t border-red-400/20 px-4 py-3 text-left text-sm font-semibold text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
                  >
                    Leave match
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {announcement && (
        <div className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2">
          <div className="min-w-[320px] rounded-2xl border border-cyan-300/20 bg-[#0b1020]/98 px-5 py-4 shadow-2xl">
            <p className="text-base font-bold text-white">{announcement.title}</p>
            {announcement.subtitle && (
              <p className="mt-1 text-sm text-zinc-300">{announcement.subtitle}</p>
            )}
          </div>
        </div>
      )}

      {spikeReveal && (
        <div className="fixed inset-0 z-[60] flex animate-fadeIn items-center justify-center bg-black/55 p-4">
          <div className="relative grid h-[min(640px,90vh)] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] shadow-2xl md:grid-cols-[minmax(260px,300px)_1fr]">
            <StoryArtPanel
              agentName={spikeReveal.planterAgentName}
              imageSrc={spikeReveal.planterAgentImage ?? undefined}
              roleLabel={
                spikeReveal.isSoloPlant
                  ? "Planter"
                  : spikeReveal.allyPlayerName
                    ? "Ally at the table"
                    : "Ally off-site"
              }
              backgroundImage={spikeReveal.backgroundImage}
              glowClass="from-red-500/10"
            />

            <div className="flex flex-col overflow-hidden p-6 md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-red-300">
                Spike Planted
              </p>
              <h2 className="mt-3 text-2xl font-bold text-white md:text-3xl">
                {spikeReveal.headline}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {spikeReveal.triggerPlayerName} ({spikeReveal.triggerAgentName})
                · target{" "}
                <span className="text-white">{spikeReveal.plantedOnNodeId}</span>
              </p>

              <div className="mt-5 flex-1 space-y-4 overflow-y-auto">
                <StoryDialogueLines lines={spikeReveal.dialogues} />

                {spikeReveal.paragraphs.map((paragraph, index) => (
                  <p
                    key={index}
                    className="text-base leading-relaxed text-zinc-200"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={async () => {
                    setSpikeReveal(null);

                    if (pendingAdvanceAfterSpikeReveal) {
                      const next = pendingAdvanceAfterSpikeReveal;
                      setPendingAdvanceAfterSpikeReveal(null);
                      await advanceToNextPlayer(next.title, next.subtitle);
                    }
                  }}
                  className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-black transition hover:brightness-110"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {spikeDetonationReveal && (
        <div className="fixed inset-0 z-[61] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b1020]/95 p-8 text-center shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-orange-300">
              Spike Detonated
            </p>

            <h2 className="mt-4 text-3xl font-bold text-white">
              {spikeDetonationReveal.planterAgentName} says boom.
            </h2>

            <p className="mt-3 text-sm text-zinc-400">
              Spike exploded on {spikeDetonationReveal.plantedOnNodeId}
            </p>

            <p className="mt-2 text-sm text-zinc-400">
              {spikeDetonationReveal.planterName} gained 1 Radianite Point
            </p>

            {spikeDetonationReveal.planterAgentImage && (
              <img
                src={spikeDetonationReveal.planterAgentImage}
                alt={spikeDetonationReveal.planterAgentName}
                className="mx-auto mt-6 max-h-[320px] object-contain"
              />
            )}

            <button
              onClick={() => setSpikeDetonationReveal(null)}
              className="mt-6 rounded-xl bg-orange-400 px-5 py-3 font-bold text-black transition hover:brightness-110"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {defusePrompt &&
        activeSpike &&
        playersInGame[defusePrompt.playerIndex] && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/55">
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1020]/95 p-8 text-center shadow-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
                Spike Found
              </p>

              <h2 className="mt-4 text-3xl font-bold text-white">
                {playersInGame[defusePrompt.playerIndex].name} can defuse
              </h2>

              <p className="mt-3 text-sm text-zinc-400">
                Tile: {defusePrompt.nodeId}
              </p>

              <p className="mt-2 text-sm text-zinc-400">
                Current state:{" "}
                <span className="font-semibold text-white">{activeSpike.status}</span>
              </p>

              <p className="mt-6 text-sm text-zinc-300">
                {activeSpike.defuseProgress === 0
                  ? "First roll: 1-3 fail, 4-6 half-defused."
                  : "Second roll: 4-6 defuses the spike."}
              </p>

              <button
                onClick={resolveDefuseRoll}
                disabled={isResolvingDefuse}
                className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isResolvingDefuse ? "Rolling..." : "Roll to Defuse"}
              </button>
            </div>
          </div>
        )}

      {duelPhase?.step === "pick-opponent" && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/55">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1020]/95 p-8 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-red-300">
              Duel
            </p>
            <h2 className="mt-4 text-3xl font-bold text-white">
              {playersInGame[duelPhase.challengerIndex]?.name} challenges...
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              Pick an opponent. Both roll , highest wins +{DUEL_WIN_CREDS} Creds
              & +{DUEL_WIN_RADIANITE} Radianite.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {playersInGame.map((opponent, index) => {
                if (index === duelPhase.challengerIndex) return null;
                return (
                  <button
                    key={opponent.id}
                    onClick={() => resolveDuelWithOpponent(index)}
                    disabled={isResolvingDuel}
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
                  >
                    vs {opponent.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {duelPhase?.step === "result" && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/55">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1020]/95 p-8 text-center shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-red-300">
              Duel Result
            </p>
            <h2 className="mt-4 text-2xl font-bold text-white">
              {playersInGame[duelPhase.challengerIndex]?.name} rolled{" "}
              {duelPhase.challengerRoll}
            </h2>
            <p className="mt-2 text-2xl font-bold text-white">
              {playersInGame[duelPhase.opponentIndex]?.name} rolled{" "}
              {duelPhase.opponentRoll}
            </p>
            <p className="mt-4 text-lg text-zinc-300">
              {duelPhase.outcome === "tie"
                ? "Draw , no rewards."
                : `${playersInGame[duelPhase.outcome === "challenger" ? duelPhase.challengerIndex : duelPhase.opponentIndex]?.name} wins!`}
            </p>
            <button
              onClick={finishDuelAndAdvance}
              className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-black transition hover:brightness-110"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {minigamePhase?.step === "intro" && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/55">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1020]/95 p-8 text-center shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-purple-300">
              Minigame
            </p>
            <h2 className="mt-4 text-3xl font-bold text-white">
              Quick Roll Challenge
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              All {playersInGame.length} players roll a die. Highest roll wins
              +{MINIGAME_WIN_CREDS} Creds & +{MINIGAME_WIN_RADIANITE} Radianite.
            </p>
            <button
              onClick={playMinigameRolls}
              disabled={isResolvingMinigame}
              className="mt-6 rounded-xl bg-purple-400 px-5 py-3 font-bold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {isResolvingMinigame ? "Rolling..." : "Roll!"}
            </button>
          </div>
        </div>
      )}

      {minigamePhase?.step === "result" && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/55">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1020]/95 p-8 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-purple-300">
              Minigame Result
            </p>
            <div className="mt-4 space-y-2">
              {minigamePhase.rolls.map(({ playerIndex, roll }) => (
                <p
                  key={playerIndex}
                  className={`text-lg ${playerIndex === minigamePhase.winnerIndex ? "font-bold text-purple-300" : "text-zinc-300"}`}
                >
                  {playersInGame[playerIndex]?.name}: {roll}
                  {playerIndex === minigamePhase.winnerIndex ? " ★" : ""}
                </p>
              ))}
            </div>
            <p className="mt-4 text-xl font-bold text-white">
              {playersInGame[minigamePhase.winnerIndex]?.name} wins!
            </p>
            <button
              onClick={finishMinigameAndAdvance}
              className="mt-6 rounded-xl bg-purple-400 px-5 py-3 font-bold text-black transition hover:brightness-110"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {phase === "game-over" && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b1020]/95 p-8 shadow-2xl">
            <p className="text-center text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
              Match Complete
            </p>
            <h2 className="mt-4 text-center text-4xl font-bold text-white">
              {winner ? `${winner.player.name} Wins!` : "Game Over"}
            </h2>
            <p className="mt-2 text-center text-sm text-zinc-400">
              {MAX_ROUNDS} rounds played , ranked by Radianite Points
            </p>

            <div className="mt-8 space-y-3">
              {rankedPlayers.map(({ player, playerIndex, rank }) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-4 rounded-2xl border p-4 ${rank === 1 ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-black/20"}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg font-black">
                    #{rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white">{player.name}</p>
                    <p className="text-sm text-zinc-400">
                      {player.creds} Creds · {player.weapon ?? "No weapon"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <img
                      src="/points/Radianite_Points.png"
                      alt="Radianite"
                      className="h-8 w-8"
                    />
                    <span className="text-2xl font-bold text-cyan-300">
                      {player.radianitePoints}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {onBackToLobby && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={onBackToLobby}
                  className="rounded-2xl bg-cyan-400 px-8 py-4 text-lg font-bold text-black transition hover:brightness-110"
                >
                  Back to Lobby
                </button>
              </div>
            )}

            {multiplayer && onLeaveMatch && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={handleLeaveMatch}
                  className="rounded-2xl border border-red-400/30 bg-red-500/10 px-8 py-4 text-lg font-bold text-red-200 transition hover:bg-red-500/20"
                >
                  Leave match
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeStoryEvent && playersInGame[activeStoryEvent.playerIndex] && (
        <EventStoryModal
          event={activeStoryEvent.event}
          playerAgentName={getAgentName(
            playersInGame[activeStoryEvent.playerIndex]
          )}
          onContinue={() => void finishEventStoryAndAdvance()}
        />
      )}

      {diceFlowPhase !== "hidden" && currentPlayer && diceDisplayValue != null && (
        <DiceRollOverlay
          open
          value={diceDisplayValue}
          playerName={currentPlayer.name}
          phase={diceFlowPhase}
          rollDurationMs={DICE_ROLL_DURATION_MS}
          onAction={handleDiceOverlayAction}
        />
      )}

      {turnBannerPlayerIndex !== null && playersInGame[turnBannerPlayerIndex] && (
        <TurnBanner
          key={turnBannerPlayerIndex}
          open={turnBannerPlayerIndex !== null}
          playerName={playersInGame[turnBannerPlayerIndex].name}
          playerAvatar={playersInGame[turnBannerPlayerIndex].avatar}
          agentName={getAgentName(playersInGame[turnBannerPlayerIndex])}
          agentImage={getAgentPortraitImage(playersInGame[turnBannerPlayerIndex])}
          agentBackgroundImage={getAgentBackgroundImage(
            playersInGame[turnBannerPlayerIndex]
          )}
          onDone={handleTurnBannerDone}
        />
      )}

      {canBuyAfterLanding && currentPlayer && (
        <ShopModal
          player={currentPlayer}
          playerAgentName={getAgentName(currentPlayer)}
          shopKeeper={shopKeeper}
          shopOffers={shopOffers}
          pendingPurchase={pendingPurchase}
          onCancelPurchase={() => setPendingPurchase(null)}
          onConfirmPurchase={confirmPurchase}
          onContinue={() => void finishShopPhase()}
          renderOfferButton={renderShopOfferButton}
          purchasePreview={
            pendingPurchase ? (
              <div className="flex w-full flex-col items-center">
                <h3 className="text-4xl font-bold text-white">
                  {pendingPurchase.label}
                </h3>
                <p className="mt-3 text-xl font-bold text-emerald-300">
                  {pendingPurchase.price} Creds
                </p>
                <div className="mt-8 flex h-44 w-full max-w-xs items-center justify-center sm:h-52 sm:max-w-sm">
                  {pendingPurchase.image ? (
                    <img
                      src={pendingPurchase.image}
                      alt={pendingPurchase.label}
                      className="max-h-full max-w-full object-contain object-center drop-shadow-2xl"
                    />
                  ) : (
                    <div className="text-sm text-zinc-500">No image</div>
                  )}
                </div>
              </div>
            ) : undefined
          }
        />
      )}

      {showTurnOrder && (
        <TurnOrderScreen
          players={playersInGame}
          agents={agents}
          getAgentName={getAgentName}
          rollDurationMs={DICE_ROLL_DURATION_MS}
          resultHoldMs={DICE_RESULT_HOLD_MS}
          onComplete={handleTurnOrderDiceComplete}
        />
      )}

      {!showTurnOrder && (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-[4vw] py-4">
        <div className="mb-3 grid shrink-0 gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-4">
          {playersInGame.map((player, index) => {
            const isCurrent =
              index === currentPlayerIndex &&
              !gameFinished &&
              phase !== "roll-for-order";
            const isMovingPlayer = index === movingPlayerIndex && isMoving;
            const canOpenDice =
              isCurrent &&
              diceFlowPhase === "hidden" &&
              !hasRolledThisTurn &&
              canInteractWithDice();
            const isDiceTurn =
              isCurrent &&
              diceFlowPhase !== "hidden" &&
              index === currentPlayerIndex;

            const cardClassName = `relative flex h-40 flex-col justify-between overflow-hidden rounded-2xl border p-3 text-left transition sm:h-44 ${isCurrent
                ? "border-cyan-400/50 bg-cyan-400/10 shadow-[0_0_28px_rgba(34,211,238,0.12)]"
                : "border-white/10 bg-zinc-900/70"
              } ${isMovingPlayer ? "ring-2 ring-cyan-300/30" : ""} ${
              canOpenDice
                ? "cursor-pointer hover:border-cyan-300/70 hover:brightness-110"
                : ""
            }`;

            const cardBody = (
              <>
                {getAgentBackgroundImage(player) && (
                  <img
                    src={getAgentBackgroundImage(player)!}
                    alt=""
                    className={`pointer-events-none absolute left-0 top-1/2 z-0 -translate-y-1/2 object-contain opacity-15 ${
                      effectivePerformanceMode ? "h-[280%]" : "h-[615%]"
                    }`}
                  />
                )}

                <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-transparent via-zinc-900/40 to-zinc-900/90" />

                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                      {player.avatar ? (
                        <img
                          src={player.avatar}
                          alt={player.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-lg font-bold text-white"
                          style={{ backgroundColor: player.color ?? "#334155" }}
                        >
                          {(player.name.trim().charAt(0) || "?").toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-white">
                        {player.name}
                      </p>
                      {canOpenDice && (
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                          Tap to roll
                        </p>
                      )}
                      {isDiceTurn && diceFlowPhase === "ready" && (
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                          Roll on screen
                        </p>
                      )}
                      {isDiceTurn && diceFlowPhase === "result" && (
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                          Move on screen
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <img
                        src="/points/Credits_icon.png"
                        alt="Credits"
                        className="h-6 w-6 object-contain"
                      />
                      <span className="flex h-7 items-center text-[30px] font-bold leading-none text-white -translate-y-[2px]">
                        <AnimatedNumber value={player.creds} />
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <img
                        src="/points/Radianite_Points.png"
                        alt="Radianite"
                        className="h-8 w-8 object-contain"
                      />
                      <span className="flex h-7 items-center text-[30px] font-bold leading-none text-cyan-300 -translate-y-[2px]">
                        <AnimatedNumber value={player.radianitePoints} />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                      Weapon
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-white">
                      {player.weapon ?? "None"}
                    </p>
                    {player.shield && (
                      <p className="mt-0.5 truncate text-xs text-zinc-400">
                        {player.shield}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex min-h-[32px] items-center gap-2 text-xs">
                  <div
                    className={`rounded-full px-2 py-1 font-medium transition-opacity ${player.nextWeaponDiscount > 0
                      ? "bg-emerald-500/10 text-emerald-300 opacity-100"
                      : "bg-white/5 text-white/30"
                      }`}
                  >
                    {player.nextWeaponDiscount > 0
                      ? `Discount: -${player.nextWeaponDiscount}`
                      : "No discount"}
                  </div>
                </div>
              </>
            );

            return canOpenDice ? (
              <button
                key={player.id}
                type="button"
                onClick={openDiceOverlay}
                className={cardClassName}
              >
                {cardBody}
              </button>
            ) : (
              <div key={player.id} className={cardClassName}>
                {cardBody}
              </div>
            );
          })}
        </div>

        <div className="min-h-0 flex-1">
        <BoardMap
          players={playersInGame}
          currentPlayerIndex={currentPlayerIndex}
          movingPlayerIndex={movingPlayerIndex}
          animatedToken={animatedToken}
          round={round}
          maxRounds={MAX_ROUNDS}
          activeSpikeNodeId={
            activeSpike &&
            (activeSpike.status === "planted" ||
              activeSpike.status === "half-defused")
              ? activeSpike.plantedOnNodeId
              : null
          }
          activeSpikeStatus={
            activeSpike?.status === "planted" ||
            activeSpike?.status === "half-defused"
              ? activeSpike.status
              : null
          }
          onTileClick={handleBoardTileClick}
          debugClickable={debugBoardAction !== null}
          selectableNodeIds={pendingPathChoice?.options ?? []}
          pathChoiceHint={
            pendingPathChoice
              ? `${playersInGame[pendingPathChoice.playerIndex]?.name ?? "Player"} — choose your route, click a highlighted tile`
              : null
          }
          spikePlantAnimation={spikePlantAnimation}
          onSpikePlantAnimationComplete={handleSpikePlantAnimationComplete}
        />
        </div>
      </div>
      )}
      {debugOverlayOpen && (
        <div className="fixed bottom-20 right-4 z-[119] max-h-[85vh] w-[360px] overflow-y-auto rounded-2xl border border-red-400/20 bg-[#0b1020]/98 p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Debug Overlay</p>
            <button
              onClick={closeDebugOverlay}
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300"
            >
              X
            </button>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Selected Player
            </p>

            <div className="flex flex-wrap gap-2">
              {playersInGame.map((player, index) => (
                <button
                  key={player.id}
                  onClick={() => setDebugSelectedPlayerIndex(index)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${debugSelectedPlayerIndex === index
                    ? "border-cyan-300/40 bg-cyan-400/10"
                    : "border-white/10 bg-black/20"
                    }`}
                >
                  <div className="h-8 w-8 overflow-hidden rounded-full border border-white/15 bg-white/5">
                    {player.avatar ? (
                      <img
                        src={player.avatar}
                        alt={player.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: player.color ?? "#334155" }}
                      >
                        {(player.name.trim().charAt(0) || "?").toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-white">{player.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Tile Target
            </p>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => setDebugBoardAction("plant-spike")}
                className={`rounded-xl border px-3 py-2 text-left text-sm text-white ${debugBoardAction === "plant-spike"
                  ? "border-cyan-300/40 bg-cyan-400/10"
                  : "border-white/10 bg-black/20"
                  }`}
              >
                Plant spike on clicked tile
              </button>

              <button
                onClick={() => setDebugBoardAction("teleport-player")}
                className={`rounded-xl border px-3 py-2 text-left text-sm text-white ${debugBoardAction === "teleport-player"
                  ? "border-cyan-300/40 bg-cyan-400/10"
                  : "border-white/10 bg-black/20"
                  }`}
              >
                Teleport player to clicked tile
              </button>
              {debugBoardAction && (
                <p className="mt-2 text-xs text-cyan-300">
                  Click a board tile to {debugBoardAction === "plant-spike" ? "plant the spike" : "teleport the selected player"}.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Spike Controls
            </p>

            <div className="space-y-2">
              <button
                onClick={debugOpenDefusePromptForSelectedPlayer}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-white"
              >
                Force defuse prompt
              </button>

              <button
                onClick={debugHalfDefuseSpike}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-white"
              >
                Set spike half-defused
              </button>

              <button
                onClick={debugForceDefuseSpike}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-white"
              >
                Force spike defused
              </button>

              <button
                onClick={debugDetonateSpikeNow}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-white"
              >
                Detonate spike now
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Selected Player Economy
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => debugAdjustCreds(debugSelectedPlayerIndex, 500)}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
              >
                +500 Creds
              </button>

              <button
                onClick={() => debugAdjustCreds(debugSelectedPlayerIndex, -500)}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
              >
                -500 Creds
              </button>

              <button
                onClick={() => debugAdjustRadianite(debugSelectedPlayerIndex, 1)}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
              >
                +1 Radianite
              </button>

              <button
                onClick={() => debugAdjustRadianite(debugSelectedPlayerIndex, -1)}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
              >
                -1 Radianite
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Forced Dice
            </p>

            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <button
                  key={value}
                  onClick={() => setDebugForcedRoll(value)}
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition ${debugForcedRoll === value
                    ? "bg-cyan-400 text-black"
                    : "border border-white/10 bg-black/20 text-white"
                    }`}
                >
                  {value}
                </button>
              ))}

              <button
                onClick={() => setDebugForcedRoll(null)}
                className="col-span-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
              >
                Reset dice
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Story Events
            </p>

            <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {eventPool.map((event) => (
                <button
                  key={event.id}
                  onClick={() => debugTriggerStoryEvent(event)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:border-violet-400/30 hover:bg-violet-400/10"
                >
                  <p className="text-sm font-semibold text-white">{event.title}</p>
                  <p className="text-[11px] text-zinc-400">{event.id}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Tile Triggers
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={debugTriggerShop}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-white transition hover:border-sky-400/30 hover:bg-sky-400/10"
              >
                Open shop
              </button>

              <button
                onClick={debugTriggerDuel}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-white transition hover:border-rose-400/30 hover:bg-rose-400/10"
              >
                Start duel
              </button>

              <button
                onClick={debugTriggerMinigame}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-white transition hover:border-yellow-400/30 hover:bg-yellow-400/10"
              >
                Start minigame
              </button>

              <button
                onClick={debugTriggerSpikePlant}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-white transition hover:border-orange-400/30 hover:bg-orange-400/10"
              >
                Plant spike
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4 text-xs text-zinc-400">
            <p>Selected player: {playersInGame[debugSelectedPlayerIndex]?.name ?? "-"}</p>
            <p>Selected tile: {debugSelectedNodeId}</p>
            <p>Active spike: {activeSpike?.plantedOnNodeId ?? "None"}</p>
            <p>Spike status: {activeSpike?.status ?? "None"}</p>
            <p>Forced roll: {debugForcedRoll ?? "Random"}</p>
          </div>
        </div>
      )}
      <div className="fixed bottom-4 right-4 z-[120] flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={togglePerformanceMode}
          className={`rounded-full border px-4 py-3 text-xs font-bold shadow-2xl transition hover:brightness-110 ${
            effectivePerformanceMode
              ? "border-emerald-400/40 bg-emerald-950/95 text-emerald-200"
              : "border-white/15 bg-[#111827]/95 text-white"
          }`}
          title="Reduces animations and GPU load for streaming"
        >
          {effectivePerformanceMode ? "Perf mode: ON" : "Perf mode: OFF"}
        </button>
        <button
          onClick={() => {
            if (debugOverlayOpen) {
              closeDebugOverlay();
            } else {
              setDebugOverlayOpen(true);
            }
          }}
          className="rounded-full border border-white/15 bg-[#111827]/95 px-4 py-3 text-xs font-bold text-white shadow-2xl transition hover:brightness-110"
        >
          {debugOverlayOpen ? "Close Debug" : "Debug"}
        </button>
      </div>
    </div >
  );
}