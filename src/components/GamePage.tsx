import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "../types/Player";
import type { Agent } from "../types/Agent";
import type { PlayerInGame, GameEvent } from "../types/Game";
import type {
  OnlineGameAction,
  OnlineGameSnapshot,
  SyncedActiveStoryEvent,
} from "../../shared/onlineGameTypes";
import type { DirectorPickPayload } from "../../shared/director";
import { useOnlineGameSync } from "../hooks/useOnlineGameSync";
import BoardMap from "./BoardMap";
import TurnBanner from "./TurnBanner";
import TurnOrderScreen from "./TurnOrderScreen";
import EventStoryModal from "./EventStoryModal";
import EventChoiceModal from "./EventChoiceModal";
import MapRevealPresentation from "./MapRevealPresentation";
import SpikeDefuseModal from "./SpikeDefuseModal";
import DirectorPresentation from "./DirectorPresentation";
import DebugPanel from "./DebugPanel";
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
import { eventPool, getRandomBoardEvent, boardEventById } from "../game/eventPool";
import {
  applyEventChoice,
  type PendingEventChoiceState,
} from "../game/eventChoiceHandler";
import { computeEffectiveRoll, tickMovementModifiers } from "../game/boardEventBridge";
import {
  customMatchById,
  customMatchRegistry,
  pickRandomMapForMatch,
} from "../../shared/customMatches";
import { minigameById, minigameRegistry } from "../../shared/minigames";
import { boardEventRegistry } from "../../shared/events";
import { agentDirectorRegistry } from "../../shared/director";
import { itemRegistry } from "../../shared/items";
import { boardLayout, type TileType } from "../game/boardLayout";
import type { MinigameId } from "../../shared/minigames/types";
import type { ActiveCustomMatch } from "../../shared/customMatches/types";
import type { ValorantMapId } from "../../shared/customMatches/types";
import { pickDirectorEvent } from "../game/director";
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
  resolveSpikeDefuseDice,
  rollDefuseDice,
  rollSpikeDifficulty,
  type SpikeDefuseDiceChoice,
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
const DEBUG_ENABLED = import.meta.env.DEV || DEBUG;

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

type MinigamePhase =
  | { step: "intro"; triggeredByIndex: number; minigameId: MinigameId }
  | {
      step: "result";
      triggeredByIndex: number;
      minigameId: MinigameId;
      rolls: MinigameRollResult[];
      winnerIndex: number;
    };

type CustomMatchPhase =
  | { step: "announce"; match: ActiveCustomMatch }
  | { step: "reveal"; match: ActiveCustomMatch }
  | { step: "result"; match: ActiveCustomMatch; winnerIndex: number };

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

function toSyncedActiveStoryEvent(
  state: NonNullable<{
    event: GameEvent;
    playerIndex: number;
    directorPick: DirectorPickPayload;
    introDurationMs: number;
    showDirectorIntro: boolean;
  }>
): SyncedActiveStoryEvent {
  return {
    playerIndex: state.playerIndex,
    event: state.event as unknown as Record<string, unknown>,
    directorPick: state.directorPick,
    introDurationMs: state.introDurationMs,
    showDirectorIntro: state.showDirectorIntro,
  };
}

function fromSyncedActiveStoryEvent(
  synced: SyncedActiveStoryEvent
): {
  event: GameEvent;
  playerIndex: number;
  directorPick: DirectorPickPayload;
  introDurationMs: number;
  showDirectorIntro: boolean;
} {
  return {
    event: synced.event as unknown as GameEvent,
    playerIndex: synced.playerIndex,
    directorPick: synced.directorPick,
    introDurationMs: synced.introDurationMs,
    showDirectorIntro: synced.showDirectorIntro,
  };
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
        items: [],
        movementBonus: 0,
        movementBonusTurns: 0,
        maxStepsPerTurn: null,
        maxStepsTurns: 0,
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
    if (snapshot.activeStoryEvent !== undefined) {
      setActiveStoryEvent(
        snapshot.activeStoryEvent
          ? fromSyncedActiveStoryEvent(snapshot.activeStoryEvent)
          : null
      );
    }
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
  const [defuseDice1, setDefuseDice1] = useState<number | null>(null);
  const [defuseDice2, setDefuseDice2] = useState<number | null>(null);
  const [defusePreviewMode, setDefusePreviewMode] = useState(false);
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
  const [debugBoardAction, setDebugBoardAction] = useState<
    "plant-spike" | "teleport-player" | null
  >(null);

  const boardEventsByCategory = useMemo(() => {
    const grouped = {
      teleport: [] as typeof boardEventRegistry,
      movement: [] as typeof boardEventRegistry,
      economy: [] as typeof boardEventRegistry,
      player_interaction: [] as typeof boardEventRegistry,
      custom_match: [] as typeof boardEventRegistry,
      map_event: [] as typeof boardEventRegistry,
    };
    for (const event of boardEventRegistry) {
      grouped[event.category].push(event);
    }
    return grouped;
  }, []);

  const [minigamePhase, setMinigamePhase] = useState<MinigamePhase | null>(null);
  const [pendingEventChoice, setPendingEventChoice] =
    useState<PendingEventChoiceState | null>(null);
  const [eventEffectsApplied, setEventEffectsApplied] = useState(false);
  const [scheduledCustomMatch, setScheduledCustomMatch] =
    useState<ActiveCustomMatch | null>(null);
  const [customMatchPhase, setCustomMatchPhase] = useState<CustomMatchPhase | null>(null);
  const [pendingRoundWrap, setPendingRoundWrap] = useState<{
    title?: string;
    subtitle?: string;
  } | null>(null);
  const [isResolvingMinigame, setIsResolvingMinigame] = useState(false);

  const [activeStoryEvent, setActiveStoryEvent] = useState<{
    event: GameEvent;
    playerIndex: number;
    directorPick: DirectorPickPayload;
    introDurationMs: number;
    showDirectorIntro: boolean;
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
      defuseDifficulty: rollSpikeDifficulty(),
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

  function completeDirectorIntro() {
    if (!activeStoryEvent) return;
    const def = boardEventById.get(activeStoryEvent.event.id);
    if (def?.playerChoices) {
      setPendingEventChoice({
        eventId: def.id,
        playerIndex: activeStoryEvent.playerIndex,
        choiceSpec: def.playerChoices,
      });
      setEventEffectsApplied(false);
    } else if (def) {
      const result = applyEventChoice({
        eventId: def.id,
        playerIndex: activeStoryEvent.playerIndex,
        players: playersInGame,
        round,
      });
      setPlayersInGame(result.players);
      setEventEffectsApplied(true);
      if (result.scheduleCustomMatch) {
        setScheduledCustomMatch({
          matchId: result.scheduleCustomMatch.matchId as ActiveCustomMatch["matchId"],
          mapId: result.scheduleCustomMatch.mapId as ValorantMapId,
          scheduledRound: round,
        });
      }
      setActiveStoryEvent((current) =>
        current ? { ...current, event: result.gameEvent, showDirectorIntro: false } : null
      );
      return;
    }
    setActiveStoryEvent((current) =>
      current ? { ...current, showDirectorIntro: false } : null
    );
  }

  function debugTriggerStoryEvent(event: GameEvent) {
    const player = playersInGame[debugSelectedPlayerIndex];
    if (!player) return;

    const context = {
      triggerPlayer: player,
      triggerAgentName: getAgentName(player),
      playersInGame,
      agents,
    };
    const directorResult = pickDirectorEvent(eventPool, context, {
      forceAgent: event.story.narrator,
    });

    setPhase("resolving-event");
    setActiveStoryEvent({
      event: directorResult.event,
      playerIndex: debugSelectedPlayerIndex,
      directorPick: directorResult,
      introDurationMs: directorResult.introDurationMs,
      showDirectorIntro: true,
    });
    setLastEventTitle(directorResult.event.title);
    setStatusTitle(`${player.name} triggered ${directorResult.event.title}`);
    setStatusSubtitle(
      directorResult.event.outcome?.headline ?? directorResult.event.story.headline
    );
    showAnnouncement(
      `${player.name} triggered ${directorResult.event.title}`,
      directorResult.event.outcome?.headline ?? directorResult.event.story.headline
    );
  }

  function debugTriggerShop() {
    beginShopPhaseForPlayer(debugSelectedPlayerIndex);
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

  function resetTurnFlowState() {
    setIsMoving(false);
    setMovingPlayerIndex(null);
    setAnimatedToken(null);
    setPendingPathChoice(null);
    setCanBuyAfterLanding(false);
    setDefusePrompt(null);
    setDefuseDice1(null);
    setDefuseDice2(null);
    setPendingEventChoice(null);
    setEventEffectsApplied(false);
    setActiveStoryEvent(null);
    setLastRoll(null);
    setDiceDisplayValue(null);
    setDiceFlowPhase("hidden");
    setHasRolledThisTurn(false);
  }

  function debugForceNextTurn() {
    void advanceToNextPlayer("Debug: Next Turn", "Forced turn advance.");
  }

  function debugSkipToPlayer(playerIndex: number) {
    const orderIndex = turnOrder.findIndex((index) => index === playerIndex);
    if (orderIndex < 0) return;

    resetTurnFlowState();
    setPhase("playing");
    setCurrentTurnOrderIndex(orderIndex);
    showTurnBannerFor(playerIndex);

    const playerName = playersInGame[playerIndex]?.name ?? "Player";
    setStatusTitle(`Debug: Skipped to ${playerName}`);
    setStatusSubtitle(`${playerName} is now up.`);
    showAnnouncement(`Skipped to ${playerName}`, `${playerName} is now up.`);
  }

  function debugEndRound() {
    if (turnOrder.length === 0) return;
    setCurrentTurnOrderIndex(turnOrder.length - 1);
    void advanceToNextPlayer("Debug: Round End", "Forced round wrap.");
  }

  function debugTriggerBoardEventById(eventId: string) {
    const gameEvent = eventPool.find((event) => event.id === eventId);
    if (!gameEvent) return;
    debugTriggerStoryEvent(gameEvent);
  }

  function debugTriggerDirector(agentName?: string) {
    const player = playersInGame[debugSelectedPlayerIndex];
    if (!player) return;

    const context = {
      triggerPlayer: player,
      triggerAgentName: getAgentName(player),
      playersInGame,
      agents,
    };
    const directorResult = pickDirectorEvent(
      eventPool,
      context,
      agentName ? { forceAgent: agentName } : undefined
    );

    setPhase("resolving-event");
    setActiveStoryEvent({
      event: directorResult.event,
      playerIndex: debugSelectedPlayerIndex,
      directorPick: directorResult,
      introDurationMs: directorResult.introDurationMs,
      showDirectorIntro: true,
    });
    setLastEventTitle(directorResult.event.title);
    setStatusTitle(`${player.name} — ${directorResult.event.title}`);
    setStatusSubtitle(
      directorResult.event.outcome?.headline ?? directorResult.event.story.headline
    );
    showAnnouncement(
      `Director: ${directorResult.event.title}`,
      directorResult.event.outcome?.headline ?? directorResult.event.story.headline
    );
  }

  function debugTriggerKingdomProtocol() {
    const player = playersInGame[debugSelectedPlayerIndex];
    if (!player) return;

    const context = {
      triggerPlayer: player,
      triggerAgentName: getAgentName(player),
      playersInGame,
      agents,
    };
    const directorResult = pickDirectorEvent(eventPool, context, {
      forceKingdom: true,
    });

    setPhase("resolving-event");
    setActiveStoryEvent({
      event: directorResult.event,
      playerIndex: debugSelectedPlayerIndex,
      directorPick: directorResult,
      introDurationMs: directorResult.introDurationMs,
      showDirectorIntro: true,
    });
    setLastEventTitle(directorResult.event.title);
    setStatusTitle(`Kingdom Protocol — ${directorResult.event.title}`);
    setStatusSubtitle(
      directorResult.event.outcome?.headline ?? directorResult.event.story.headline
    );
    showAnnouncement(
      "Kingdom Protocol",
      directorResult.event.outcome?.headline ?? directorResult.event.story.headline
    );
  }

  function debugScheduleCustomMatch(matchId: string) {
    const mapId = pickRandomMapForMatch(matchId) as ValorantMapId;
    setScheduledCustomMatch({
      matchId: matchId as ActiveCustomMatch["matchId"],
      mapId,
      scheduledRound: round,
    });
    const matchName = customMatchById.get(matchId)?.name ?? matchId;
    setStatusTitle(`Scheduled: ${matchName}`);
    setStatusSubtitle("Plays at end of round.");
    showAnnouncement(`Scheduled ${matchName}`, "Plays when this round completes.");
  }

  function debugPlayCustomMatch(matchId: string) {
    const mapId = pickRandomMapForMatch(matchId) as ValorantMapId;
    void playCustomMatchStub({
      matchId: matchId as ActiveCustomMatch["matchId"],
      mapId,
      scheduledRound: round,
    });
  }

  function debugTriggerScheduledMatch() {
    if (scheduledCustomMatch) {
      void playCustomMatchStub(scheduledCustomMatch);
      return;
    }
    debugScheduleCustomMatch("spike-rush");
    const mapId = pickRandomMapForMatch("spike-rush") as ValorantMapId;
    void playCustomMatchStub({
      matchId: "spike-rush",
      mapId,
      scheduledRound: round,
    });
  }

  function debugTriggerMapReveal() {
    const match =
      scheduledCustomMatch ??
      ({
        matchId: "spike-rush" as ActiveCustomMatch["matchId"],
        mapId: pickRandomMapForMatch("spike-rush") as ValorantMapId,
        scheduledRound: round,
      } satisfies ActiveCustomMatch);
    setCustomMatchPhase({ step: "reveal", match });
    const matchName = customMatchById.get(match.matchId)?.name ?? "Custom Match";
    setStatusTitle(`Map Reveal: ${matchName}`);
    setStatusSubtitle(`Revealing ${match.mapId}`);
    showAnnouncement(`Map Reveal: ${matchName}`, `Revealing ${match.mapId}`);
  }

  function debugGiveItem(itemId: string) {
    updatePlayer(debugSelectedPlayerIndex, (player) => ({
      ...player,
      items: player.items.includes(itemId)
        ? player.items
        : [...player.items, itemId],
    }));
    const itemName = itemRegistry.find((item) => item.id === itemId)?.name ?? itemId;
    const playerName = playersInGame[debugSelectedPlayerIndex]?.name ?? "Player";
    setStatusTitle(`Debug: Gave ${itemName}`);
    setStatusSubtitle(`Added to ${playerName}'s inventory.`);
    showAnnouncement(`Gave ${itemName}`, `Added to ${playerName}.`);
  }

  function debugTriggerMinigameById(minigameId: MinigameId) {
    setMinigamePhase({
      step: "intro",
      triggeredByIndex: debugSelectedPlayerIndex,
      minigameId,
    });
    const player = playersInGame[debugSelectedPlayerIndex];
    const minigameDef = minigameById.get(minigameId);
    if (!player) return;
    setStatusTitle(`${player.name} — ${minigameDef?.name ?? "Minigame"}`);
    setStatusSubtitle(minigameDef?.rules ?? "All players roll — highest wins.");
    showAnnouncement(
      `Minigame: ${minigameDef?.name ?? minigameId}`,
      minigameDef?.rules ?? "Highest roll wins!"
    );
  }

  function debugLandOnTile(tileType: TileType) {
    const node = boardLayout.find((entry) => entry.type === tileType);
    if (!node) return;

    teleportPlayerToNode(debugSelectedPlayerIndex, node.id);
    void resolveLanding(debugSelectedPlayerIndex, node.id, 1);
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

  function handleEventChoice(args: {
    choiceId?: string;
    targetPlayerIndex?: number;
    betAmount?: number;
  }) {
    if (!pendingEventChoice || !activeStoryEvent) return;

    const result = applyEventChoice({
      eventId: pendingEventChoice.eventId,
      playerIndex: pendingEventChoice.playerIndex,
      players: playersInGame,
      round,
      ...args,
    });

    setPlayersInGame(result.players);
    setEventEffectsApplied(true);

    if (result.scheduleCustomMatch) {
      const matchDef = customMatchById.get(
        result.scheduleCustomMatch.matchId as ActiveCustomMatch["matchId"]
      );
      setScheduledCustomMatch({
        matchId: result.scheduleCustomMatch.matchId as ActiveCustomMatch["matchId"],
        mapId: result.scheduleCustomMatch.mapId as ValorantMapId,
        scheduledRound: round,
      });
      showAnnouncement(
        "Custom Match Scheduled",
        `${matchDef?.name ?? "Custom Match"} at end of round on ${result.scheduleCustomMatch.mapId}.`
      );
    }

    if (result.needsFollowUp) {
      setPendingEventChoice(result.needsFollowUp);
      setActiveStoryEvent((current) =>
        current ? { ...current, event: result.gameEvent } : null
      );
      return;
    }

    setPendingEventChoice(null);
    setActiveStoryEvent((current) =>
      current ? { ...current, event: result.gameEvent } : null
    );
    setStatusSubtitle(result.gameEvent.outcome?.description ?? result.gameEvent.description);
  }

  async function finishCustomMatchAndAdvance(triggeredByIndex: number) {
    if (!customMatchPhase || customMatchPhase.step !== "result") return;
    const { winnerIndex, match } = customMatchPhase;
    const matchDef = customMatchById.get(match.matchId);
    updatePlayer(winnerIndex, (p) => ({
      ...p,
      creds: p.creds + (matchDef?.winCreds ?? 150),
      radianitePoints: p.radianitePoints + (matchDef?.winRadianite ?? 1),
    }));
    setCustomMatchPhase(null);
    setScheduledCustomMatch(null);
    await sleep(AUTO_ADVANCE_DELAY);
    await advanceToNextPlayer(
      `Next player: ${getResolvedNextPlayerName(triggeredByIndex)}`,
      `${getResolvedNextPlayerName(triggeredByIndex)} is now up`
    );
  }

  async function playCustomMatchStub(match: ActiveCustomMatch) {
    setCustomMatchPhase({ step: "reveal", match });
    await sleep(4500);
    const rolls = rollForAllPlayers(playersInGame.length);
    const winner = findMinigameWinner(rolls);
    setCustomMatchPhase({
      step: "result",
      match,
      winnerIndex: winner.playerIndex,
    });
    const winnerName = playersInGame[winner.playerIndex]?.name ?? "Player";
    const matchDef = customMatchById.get(match.matchId);
    setStatusTitle(`${winnerName} wins ${matchDef?.name ?? "Custom Match"}!`);
    setStatusSubtitle(`+${matchDef?.winCreds ?? 150} Creds on ${match.mapId}`);
    showAnnouncement(
      `${matchDef?.name ?? "Custom Match"} Complete`,
      `${winnerName} wins on ${match.mapId}!`
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
      minigameId: minigamePhase.minigameId,
      rolls,
      winnerIndex: winner.playerIndex,
    });

    const minigameDef = minigameById.get(minigamePhase.minigameId);
    setDiceDisplayValue(winner.roll);

    const winnerName =
      playersInGame[winner.playerIndex]?.name ?? "Player";

    setStatusTitle(`${winnerName} wins ${minigameDef?.name ?? "Minigame"}!`);
    setStatusSubtitle(
      `Highest roll (${winner.roll}). +${minigameDef?.rewards.creds ?? MINIGAME_WIN_CREDS} Creds & +${minigameDef?.rewards.radianite ?? MINIGAME_WIN_RADIANITE} Radianite.`
    );
    setLastEventTitle(minigameDef?.name ?? "Minigame");
    showAnnouncement("Minigame Won!", `${winnerName} rolled ${winner.roll}.`);
  }

  async function finishMinigameAndAdvance() {
    if (!minigamePhase || minigamePhase.step !== "result") return;

    const { winnerIndex, triggeredByIndex, minigameId } = minigamePhase;
    const minigameDef = minigameById.get(minigameId);

    updatePlayer(winnerIndex, (p) => ({
      ...p,
      creds: p.creds + (minigameDef?.rewards.creds ?? MINIGAME_WIN_CREDS),
      radianitePoints:
        p.radianitePoints + (minigameDef?.rewards.radianite ?? MINIGAME_WIN_RADIANITE),
    }));
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
    if (minigamePhase || customMatchPhase) return;
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

    if (meta.wrapsRound && scheduledCustomMatch && !customMatchPhase) {
      setPendingRoundWrap({ title, subtitle });
      void playCustomMatchStub(scheduledCustomMatch);
      setIsMoving(false);
      setMovingPlayerIndex(null);
      setAnimatedToken(null);
      setPendingPathChoice(null);
      setCanBuyAfterLanding(false);
      setDefusePrompt(null);
      setActiveStoryEvent(null);
      setPendingEventChoice(null);
      setLastRoll(null);
      setDiceDisplayValue(null);
      setDiceFlowPhase("hidden");
      setHasRolledThisTurn(false);
      setCurrentTurnOrderIndex(meta.nextOrderIndex);
      setRound(newRound);
      return;
    }

    setIsMoving(false);
    setMovingPlayerIndex(null);
    setAnimatedToken(null);
    setPendingPathChoice(null);
    setCanBuyAfterLanding(false);
    setDefusePrompt(null);
    setDefuseDice1(null);
    setDefuseDice2(null);
    setMinigamePhase(null);
    setPendingEventChoice(null);
    setEventEffectsApplied(false);
    setActiveStoryEvent(null);
    setLastRoll(null);
    setDiceDisplayValue(null);
    setDiceFlowPhase("hidden");
    setHasRolledThisTurn(false);
    setCurrentTurnOrderIndex(meta.nextOrderIndex);
    setRound(newRound);

    const nextPlayerIndex = meta.nextPlayerIndex;
    setPlayersInGame((current) =>
      current.map((player, index) =>
        index === nextPlayerIndex ? tickMovementModifiers(player) : player
      )
    );

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

    setDefuseDice1(null);
    setDefuseDice2(null);
    setDefusePreviewMode(false);
    setDefusePrompt({
      playerIndex,
      nodeId,
      eligibility,
    });

    return true;
  }

  async function rollDefusePreview() {
    if (!defusePrompt || !activeSpike) return;
    setIsResolvingDefuse(true);

    for (let i = 0; i < 8; i += 1) {
      setDiceDisplayValue(randomDiceRoll());
      await sleep(70);
    }

    const [d1, d2] = rollDefuseDice();
    const player = playersInGame[defusePrompt.playerIndex];
    const hasOwl = player?.items?.includes("owl-drone");
    setDefuseDice1(d1);
    setDefuseDice2(hasOwl ? d2 : d2);
    setDefusePreviewMode(!!hasOwl);
    setIsResolvingDefuse(false);
  }

  async function resolveDefuseChoice(
    choice: SpikeDefuseDiceChoice,
    itemId?: string
  ) {
    if (!defusePrompt || !activeSpike || defuseDice1 == null || defuseDice2 == null) return;

    setIsResolvingDefuse(true);
    let dice1 = defuseDice1;
    let dice2 = defuseDice2;

    if (itemId === "stim-beacon") {
      [dice1, dice2] = rollDefuseDice();
      setDefuseDice1(dice1);
      setDefuseDice2(dice2);
    }

    let itemBonus = 0;
    if (itemId === "wire-cutter") itemBonus = 1;
    if (itemId === "ultimate-charge") itemBonus = 0;

    let spikeToResolve = activeSpike;
    if (
      defusePrompt.eligibility === "pass-over" &&
      !spikeToResolve.firstPassOpportunityUsed
    ) {
      spikeToResolve = markFirstPassOpportunityUsed(spikeToResolve);
    }

    const difficulty =
      spikeToResolve.defuseProgress === 0
        ? spikeToResolve.defuseDifficulty
        : spikeToResolve.defuseDifficulty + 1;

    const outcome = resolveSpikeDefuseDice({
      dice1,
      dice2,
      choice: itemId === "ultimate-charge" ? "use-ultimate" : choice,
      difficulty,
      currentProgress: spikeToResolve.defuseProgress,
      itemBonus,
    });

    let resolvedSpike = applySpikeDefuseOutcome(spikeToResolve, outcome);

    if (shouldRewardDefuser(resolvedSpike)) {
      grantRadianiteWithFx(defusePrompt.playerIndex, 1);
      resolvedSpike = markSpikeRewarded(resolvedSpike);
    }

    if (itemId && playersInGame[defusePrompt.playerIndex]?.items.includes(itemId)) {
      updatePlayer(defusePrompt.playerIndex, (p) => ({
        ...p,
        items: p.items.filter((id) => id !== itemId),
      }));
    }

    setActiveSpike(resolvedSpike);

    const playerName = playersInGame[defusePrompt.playerIndex]?.name ?? "Player";
    const total = "chosenTotal" in outcome ? outcome.chosenTotal : 0;

    if (outcome.kind === "fail") {
      setLastEventTitle("Defuse Failed");
      setStatusTitle("Defuse Failed");
      setStatusSubtitle(
        `${playerName}: ${dice1}+${dice2} → ${total} vs ${difficulty}. Spike still active.`
      );
      showAnnouncement("Defuse Failed", `${playerName} failed the defuse (${total}/${difficulty}).`);
    } else if (outcome.kind === "half") {
      setLastEventTitle("Spike Half-Defused");
      setStatusTitle("Spike Half-Defused");
      setStatusSubtitle(`${playerName}: ${total} vs ${difficulty}. One more stage.`);
      showAnnouncement("Spike Half-Defused", `${playerName} cleared stage 1.`);
    } else {
      setLastEventTitle("Spike Defused");
      setStatusTitle("Spike Defused");
      setStatusSubtitle(`${playerName} defused with ${total} vs ${difficulty}. +1 Radianite.`);
      showAnnouncement("Spike Defused", `${playerName} saved the site!`);
    }

    await sleep(AUTO_ADVANCE_DELAY);

    setDefusePrompt(null);
    setDefuseDice1(null);
    setDefuseDice2(null);
    setIsResolvingDefuse(false);

    await advanceToNextPlayer(
      `Next player: ${getResolvedNextPlayerName(defusePrompt.playerIndex)}`,
      `${getResolvedNextPlayerName(defusePrompt.playerIndex)} is now up`
    );
  }

  async function resolveDefuseRoll() {
    await rollDefusePreview();
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

    if (!eventEffectsApplied) {
      updatePlayer(playerIndex, (current) => applyEventEffect(current, event));
    }

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
    setPendingEventChoice(null);
    setEventEffectsApplied(false);
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
      const directorResult = pickDirectorEvent(eventPool, {
        triggerPlayer: player,
        triggerAgentName: getAgentName(player),
        playersInGame,
        agents,
      });
      const gameEvent = directorResult.event;

      setPhase("resolving-event");
      setLastEventTitle(gameEvent.title);
      setStatusTitle(`${player.name} triggered ${gameEvent.title}`);
      setStatusSubtitle(gameEvent.outcome?.headline ?? gameEvent.story.headline);
      showAnnouncement(
        `${player.name} triggered ${gameEvent.title}`,
        gameEvent.outcome?.headline ?? gameEvent.story.headline
      );

      setActiveStoryEvent({
        event: gameEvent,
        playerIndex,
        directorPick: directorResult,
        introDurationMs: directorResult.introDurationMs,
        showDirectorIntro: true,
      });
      setEventEffectsApplied(false);
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
      const boardMinigame: MinigameId =
        Math.random() < 0.5 ? "neon-race" : "cypher-seek";
      setMinigamePhase({
        step: "intro",
        triggeredByIndex: playerIndex,
        minigameId: boardMinigame,
      });
      const minigameDef = minigameById.get(boardMinigame);
      setStatusTitle(`${player.name} landed on Minigame`);
      setStatusSubtitle(minigameDef?.description ?? "All players roll — highest wins.");
      showAnnouncement(
        `${player.name} triggered ${minigameDef?.name ?? "Minigame"}`,
        minigameDef?.rules ?? "Highest roll wins!"
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

    const rawRoll = debugForcedRoll ?? randomDiceRoll();
    const player = playersInGame[currentPlayerIndex];
    const finalRoll = player ? computeEffectiveRoll(rawRoll, player) : rawRoll;
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
      !minigamePhase &&
      !customMatchPhase &&
      !pendingEventChoice &&
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
      activeStoryEvent: activeStoryEvent
        ? toSyncedActiveStoryEvent(activeStoryEvent)
        : null,
    });
  }, [
    activeStoryEvent,
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
          <SpikeDefuseModal
            player={playersInGame[defusePrompt.playerIndex]}
            spike={activeSpike}
            nodeId={defusePrompt.nodeId}
            dice1={defuseDice1}
            dice2={defuseDice2}
            previewMode={defusePreviewMode}
            isResolving={isResolvingDefuse}
            onRollPreview={() => void rollDefusePreview()}
            onChoose={(choice, itemId) => void resolveDefuseChoice(choice, itemId)}
          />
        )}

      {customMatchPhase?.step === "reveal" && (
        <MapRevealPresentation
          matchId={customMatchPhase.match.matchId}
          mapId={customMatchPhase.match.mapId}
          onComplete={() => {}}
        />
      )}

      {customMatchPhase?.step === "result" && (
        <div className="fixed inset-0 z-[67] flex items-center justify-center bg-black/55">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1020]/95 p-8 text-center shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-red-300">
              {customMatchById.get(customMatchPhase.match.matchId)?.name ?? "Custom Match"}
            </p>
            <h2 className="mt-4 text-2xl font-bold text-white">
              {playersInGame[customMatchPhase.winnerIndex]?.name} wins on{" "}
              {customMatchPhase.match.mapId}!
            </h2>
            <button
              type="button"
              onClick={() =>
                void finishCustomMatchAndAdvance(currentPlayerIndex)
              }
              className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-black transition hover:brightness-110"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {pendingEventChoice &&
        activeStoryEvent &&
        !activeStoryEvent.showDirectorIntro && (
          <EventChoiceModal
            eventTitle={activeStoryEvent.event.title}
            eventDescription={activeStoryEvent.event.description}
            choiceSpec={pendingEventChoice.choiceSpec}
            players={playersInGame}
            triggerPlayerIndex={pendingEventChoice.playerIndex}
            onFixedChoice={(choiceId) => handleEventChoice({ choiceId })}
            onPickPlayer={(targetPlayerIndex) =>
              handleEventChoice({ targetPlayerIndex })
            }
            onBetAmount={(betAmount) => handleEventChoice({ betAmount })}
          />
        )}

      {minigamePhase?.step === "intro" && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/55">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1020]/95 p-8 text-center shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-purple-300">
              Minigame
            </p>
            <h2 className="mt-4 text-3xl font-bold text-white">
              {minigameById.get(minigamePhase.minigameId)?.name ?? "Minigame"}
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              {minigameById.get(minigamePhase.minigameId)?.rules ??
                `All ${playersInGame.length} players roll. Highest wins.`}
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

      {activeStoryEvent?.showDirectorIntro && (
        <DirectorPresentation
          pick={activeStoryEvent.directorPick}
          introDurationMs={activeStoryEvent.introDurationMs}
          onComplete={completeDirectorIntro}
        />
      )}

      {activeStoryEvent &&
        !activeStoryEvent.showDirectorIntro &&
        !pendingEventChoice &&
        playersInGame[activeStoryEvent.playerIndex] && (
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
      {DEBUG_ENABLED && debugOverlayOpen && (
        <DebugPanel
          onClose={closeDebugOverlay}
          players={playersInGame}
          selectedPlayerIndex={debugSelectedPlayerIndex}
          onSelectPlayer={setDebugSelectedPlayerIndex}
          forcedRoll={debugForcedRoll}
          onSetForcedRoll={setDebugForcedRoll}
          boardAction={debugBoardAction}
          onSetBoardAction={setDebugBoardAction}
          activeSpike={activeSpike}
          boardEventsByCategory={boardEventsByCategory}
          directorAgents={agentDirectorRegistry.map((agent) => ({
            agentId: agent.agentId,
            agentName: agent.agentName,
          }))}
          customMatches={customMatchRegistry.map((match) => ({
            id: match.id,
            name: match.name,
          }))}
          minigames={minigameRegistry.map((minigame) => ({
            id: minigame.id,
            name: minigame.name,
          }))}
          items={itemRegistry.map((item) => ({
            id: item.id,
            name: item.name,
          }))}
          onForceNextTurn={debugForceNextTurn}
          onSkipToPlayer={debugSkipToPlayer}
          onEndRound={debugEndRound}
          onTriggerEvent={debugTriggerBoardEventById}
          onTriggerDirector={debugTriggerDirector}
          onTriggerKingdomProtocol={debugTriggerKingdomProtocol}
          onOpenDefusePrompt={debugOpenDefusePromptForSelectedPlayer}
          onHalfDefuseSpike={debugHalfDefuseSpike}
          onForceDefuseSpike={debugForceDefuseSpike}
          onDetonateSpike={debugDetonateSpikeNow}
          onPlantSpike={debugTriggerSpikePlant}
          onScheduleCustomMatch={debugScheduleCustomMatch}
          onPlayCustomMatch={debugPlayCustomMatch}
          onForceRoundComplete={debugEndRound}
          onTriggerScheduledMatch={debugTriggerScheduledMatch}
          onTriggerMapReveal={debugTriggerMapReveal}
          onAdjustCreds={(amount) => debugAdjustCreds(debugSelectedPlayerIndex, amount)}
          onAdjustRadianite={(amount) =>
            debugAdjustRadianite(debugSelectedPlayerIndex, amount)
          }
          onGiveItem={debugGiveItem}
          onTriggerMinigame={debugTriggerMinigameById}
          onLandOnTile={debugLandOnTile}
          onTriggerShop={debugTriggerShop}
        />
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
        {DEBUG_ENABLED && (
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
        )}
      </div>
    </div >
  );
}