import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "../types/Player";
import type { Agent } from "../types/Agent";
import type { PlayerInGame, GameEvent } from "../types/Game";
import type {
  OnlineGameAction,
  OnlineGameSnapshot,
  SyncedActiveStoryEvent,
  SyncedCustomMatchPhase,
  SyncedPendingEventChoice,
  SyncedScheduledCustomMatch,
} from "../../shared/onlineGameTypes";
import type { EventChoiceSpec } from "../../shared/events";
import type { DirectorPickPayload } from "../../shared/director";
import { useOnlineGameSync } from "../hooks/useOnlineGameSync";
import { useChatGameEvents } from "../hooks/useChatGameEvents";
import { useLocalChat } from "../hooks/useLocalChat";
import BoardMap from "./BoardMap";
import TurnBanner from "./TurnBanner";
import TurnOrderScreen from "./TurnOrderScreen";
import EventStoryModal from "./EventStoryModal";
import EventChoiceModal from "./EventChoiceModal";
import MapRevealPresentation from "./MapRevealPresentation";
import MatchFormatPresentation from "./MatchFormatPresentation";
import UltimateCastPresentation from "./UltimateCastPresentation";
import CustomMatchLobby from "./CustomMatchLobby";
import SpikeDefuseModal from "./SpikeDefuseModal";
import DirectorPresentation from "./DirectorPresentation";
import DebugPanel from "./DebugPanel";
import ShopModal, { type ShopOffer } from "./ShopModal";
import DiceRollOverlay, { type DiceOverlayPhase } from "./DiceRollOverlay";
import { DICE_REVEAL_BLINK_MS } from "./DiceFace";
import ValorantCrate from "./valorant/ValorantCrate";
import { StoryArtPanel, StoryDialogueLines } from "./StoryArtPanel";
import RoomChatWidget from "./lobby/RoomChatWidget";
import { isEffectivePerformanceMode } from "../hooks/usePerformanceSettings";
import type { usePerformanceSettings } from "../hooks/usePerformanceSettings";
import { useDebugMode } from "../hooks/useDebugMode";
import {
  traverseMovement,
  sleep,
  animateJump,
  animateTeleport,
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
import { computeEffectiveRoll, tickMovementModifiers, consumeOneShotMovementBonus, normalizePlayerLoadout, getBoardNodeIds } from "../game/boardEventBridge";
import {
  customMatchRegistry,
  getCustomMatchDefinition,
  pickRandomMapForMatch,
  assignTeamsForCategory,
} from "../../shared/customMatches";
import { minigameById, minigameRegistry } from "../../shared/minigames";
import { boardEventRegistry } from "../../shared/events";
import { agentDirectorRegistry } from "../../shared/director";
import { itemById, itemRegistry } from "../../shared/items";
import {
  ULTIMATE_BOARD_PATHS,
  createEmptyPlayerUltimateStatus,
  getUltimateForAgent,
  type BoardUltimateState,
  type UltimateCastCue,
} from "../../shared/ultimates";
import {
  applyUltimate,
  applyJettPassToll,
  buildBoardAdjacency,
  buildUltimateCastCue,
  canActivateUltimate,
  clampOrbs,
  emptyBoardUltimateState,
  findPathContainingNode,
  gainOrb,
  getArmedTrapAt,
  getSelectableEdgesForUltimate,
  getSelectableTileIdsForUltimate,
  getUltimateTargetingPrompt,
  getUltimateTargetingSubtitle,
  isEdgeBlockedByWall,
  isInPoisonCloud,
  mergeUltimatePlayers,
  tickBoardUltimateState,
  tickPlayerUltimateStatus,
  toUltimatePlayerState,
  usesBoardTargeting,
  withDefaultUltimateFields,
  type UltimateBoardTargeting,
} from "../game/ultimates";
import UltimateMeter from "./UltimateMeter";
import UltimateTargetModal, {
  type UltimateTargetSelection,
} from "./UltimateTargetModal";
import PlayerInventorySidebar, {
  rotatePlayersToActive,
  type InventoryItemAction,
} from "./PlayerInventorySidebar";
import { boardLayout, type TileType } from "../game/boardLayout";
import type { MinigameId } from "../../shared/minigames/types";
import type {
  ScheduledCustomMatch,
  CustomMatchId,
} from "../../shared/customMatches/types";
import type { ValorantMapId } from "../../shared/customMatches/types";
import { pickDirectorEvent, buildDirectorPickForEventId } from "../game/director";
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
  /** True when GamePage remounted after refresh into an in-progress match. */
  resumedFromSession?: boolean;
};

type GamePageProps = {
  players: Player[];
  agents: Agent[];
  /** Restore a local (pass-and-play) match after refresh. */
  initialSnapshot?: OnlineGameSnapshot;
  onBackToLobby?: () => void;
  onLeaveMatch?: () => void;
  /** Persist local game state for refresh restore (online uses WS sync instead). */
  onLocalSnapshotChange?: (snapshot: OnlineGameSnapshot) => void;
  performanceSettings: ReturnType<typeof usePerformanceSettings>;
  multiplayer?: MultiplayerGameConfig;
};

const MAX_ROUNDS = 10;
const DICE_ROLL_DURATION_MS = 1400;
const DICE_RESULT_HOLD_MS = 900;
const AUTO_ADVANCE_DELAY = 1200;

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
  | { step: "format"; match: ScheduledCustomMatch }
  | { step: "reveal"; match: ScheduledCustomMatch }
  | { step: "lobby"; match: ScheduledCustomMatch; selectingWinner?: boolean };

function buildScheduledCustomMatch(
  matchId: CustomMatchId,
  mapId: ValorantMapId,
  scheduledAtRound: number,
  players: Pick<PlayerInGame, "name">[],
): ScheduledCustomMatch {
  const definition = getCustomMatchDefinition(matchId);
  const teamLayout = definition
    ? assignTeamsForCategory(definition.category, players.length)
    : {};

  return {
    matchId,
    mapId,
    scheduledAtRound,
    status: "scheduled",
    participants: players.map((player) => player.name),
    ...teamLayout,
  };
}

function toSyncedScheduledCustomMatch(
  match: ScheduledCustomMatch | null,
): SyncedScheduledCustomMatch | null {
  if (!match) return null;
  return {
    matchId: match.matchId,
    mapId: match.mapId,
    scheduledAtRound: match.scheduledAtRound,
    status: match.status,
    participants: match.participants,
    teamAlpha: match.teamAlpha,
    teamBravo: match.teamBravo,
    attackerIndex: match.attackerIndex,
    defenderIndices: match.defenderIndices,
    winnerPlayerIndex: match.winnerPlayerIndex,
    winnerTeam: match.winnerTeam,
    winnerSide: match.winnerSide,
  };
}

function fromSyncedScheduledCustomMatch(
  synced: SyncedScheduledCustomMatch,
): ScheduledCustomMatch {
  return {
    matchId: synced.matchId as CustomMatchId,
    mapId: synced.mapId as ValorantMapId,
    scheduledAtRound: synced.scheduledAtRound,
    status: synced.status,
    participants: synced.participants,
    teamAlpha: synced.teamAlpha,
    teamBravo: synced.teamBravo,
    attackerIndex: synced.attackerIndex,
    defenderIndices: synced.defenderIndices,
    winnerPlayerIndex: synced.winnerPlayerIndex,
    winnerTeam: synced.winnerTeam,
    winnerSide: synced.winnerSide,
  };
}

function toSyncedCustomMatchPhase(
  phase: CustomMatchPhase | null,
): SyncedCustomMatchPhase {
  if (!phase) return null;
  if (phase.step === "format") return { step: "format" };
  if (phase.step === "reveal") return { step: "reveal" };
  return { step: "lobby", selectingWinner: phase.selectingWinner };
}

function mergeCustomMatchPhase(
  syncedPhase: SyncedCustomMatchPhase | undefined,
  match: ScheduledCustomMatch | null,
): CustomMatchPhase | null {
  if (!syncedPhase || !match) return null;
  if (syncedPhase.step === "format") {
    return { step: "format", match };
  }
  if (syncedPhase.step === "reveal") {
    return { step: "reveal", match };
  }
  return {
    step: "lobby",
    match,
    selectingWinner: syncedPhase.selectingWinner,
  };
}

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

function toSyncedPendingEventChoice(
  pending: PendingEventChoiceState | null
): SyncedPendingEventChoice {
  if (!pending) return null;
  return {
    eventId: pending.eventId,
    playerIndex: pending.playerIndex,
    choiceKind: pending.choiceSpec.kind,
    followUpEventId: pending.followUpEventId,
    choiceSpec: pending.choiceSpec as unknown as Record<string, unknown>,
  };
}

function fromSyncedPendingEventChoice(
  synced: NonNullable<SyncedPendingEventChoice>
): PendingEventChoiceState | null {
  if (!synced.choiceSpec) {
    const def = boardEventById.get(synced.eventId);
    if (!def?.playerChoices) return null;
    return {
      eventId: synced.eventId,
      playerIndex: synced.playerIndex,
      choiceSpec: def.playerChoices,
      followUpEventId: synced.followUpEventId,
    };
  }
  return {
    eventId: synced.eventId,
    playerIndex: synced.playerIndex,
    choiceSpec: synced.choiceSpec as unknown as EventChoiceSpec,
    followUpEventId: synced.followUpEventId,
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
  initialSnapshot,
  onBackToLobby,
  onLeaveMatch,
  onLocalSnapshotChange,
  performanceSettings,
  multiplayer,
}: GamePageProps) {
  const isOnlineGuest = !!multiplayer && !multiplayer.isHost;
  const restoredLocal = !multiplayer && !!initialSnapshot;
  const initialTurnOrder =
    multiplayer?.initialTurnOrder ?? initialSnapshot?.turnOrder ?? [];
  const hasPresetTurnOrder = initialTurnOrder.length > 0;
  const { effectivePerformanceMode, performanceMode, togglePerformanceMode } =
    performanceSettings;
  const { debugMode, setDebugMode } = useDebugMode();
  const { chatGameEvents, toggleChatGameEvents } = useChatGameEvents();
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const canLeaveGame = Boolean(multiplayer || onBackToLobby || onLeaveMatch);
  /** Settings (perf / debug) are always available; leave actions need handlers. */
  const canOpenGameMenu = true;
  const [playersInGame, setPlayersInGame] = useState<PlayerInGame[]>(() => {
    if (initialSnapshot?.players?.length) {
      return initialSnapshot.players.map((player) =>
        withDefaultUltimateFields(normalizePlayerLoadout(player as PlayerInGame))
      );
    }
    return players.map((player, index): PlayerInGame => {
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
        primaryWeapon: null,
        secondaryWeapon: null,
        weapon: null,
        shield: null,
        nextWeaponDiscount: 0,
        items: [],
        movementBonus: 0,
        movementBonusTurns: 0,
        maxStepsPerTurn: null,
        maxStepsTurns: 0,
        ultimateOrbs: 0,
        ultimateStatus: createEmptyPlayerUltimateStatus(),
      };
    });
  });

  const [boardUltimateState, setBoardUltimateState] = useState<BoardUltimateState>(
    () => initialSnapshot?.boardUltimateState ?? emptyBoardUltimateState()
  );
  const [ultimateCast, setUltimateCast] = useState<UltimateCastCue | null>(
    () => initialSnapshot?.ultimateCast ?? null
  );
  const lastPlayedCastIdRef = useRef<string | null>(
    initialSnapshot?.ultimateCast?.id ?? null
  );
  const [ultimateModalOpen, setUltimateModalOpen] = useState(false);
  const [ultimateTargeting, setUltimateTargeting] =
    useState<UltimateBoardTargeting | null>(null);
  /** Showstopper: player picked on board; modal asks creds vs spaces. */
  const [razeTargetPlayerIndex, setRazeTargetPlayerIndex] = useState<number | null>(
    null
  );
  const [phoenixChoiceOpen, setPhoenixChoiceOpen] = useState(false);
  const [pendingOmenMiniMove, setPendingOmenMiniMove] = useState<{
    steps: number;
    fromNodeId: string;
  } | null>(null);
  const boardUltimateStateRef = useRef(boardUltimateState);
  boardUltimateStateRef.current = boardUltimateState;

  const [phase, setPhase] = useState<TurnPhase>(
    initialSnapshot?.phase ??
      (hasPresetTurnOrder ? "playing" : "roll-for-order")
  );
  const [round, setRound] = useState(initialSnapshot?.round ?? 1);

  const [turnOrder, setTurnOrder] = useState<number[]>(initialTurnOrder);
  const [currentTurnOrderIndex, setCurrentTurnOrderIndex] = useState(
    initialSnapshot?.currentTurnOrderIndex ?? 0
  );
  const [turnOrderRevealOpen, setTurnOrderRevealOpen] = useState(
    restoredLocal
      ? initialSnapshot?.phase === "roll-for-order"
      : !hasPresetTurnOrder
  );
  const [shopKeeper, setShopKeeper] = useState<ShopKeeper | null>(null);
  const [shopOffers, setShopOffers] = useState<ShopOffer[]>([]);
  const [pendingPurchase, setPendingPurchase] = useState<ShopOffer | null>(null);
  const [purchasedShopOfferIds, setPurchasedShopOfferIds] = useState<string[]>([]);

  const [lastRoll, setLastRoll] = useState<number | null>(
    initialSnapshot?.lastRoll ?? null
  );
  const [diceDisplayValue, setDiceDisplayValue] = useState<number | null>(
    initialSnapshot?.diceDisplayValue ?? null
  );
  const [diceFlowPhase, setDiceFlowPhase] = useState<DiceFlowPhase>(
    initialSnapshot?.diceFlowPhase ?? "hidden"
  );
  const [hasRolledThisTurn, setHasRolledThisTurn] = useState(
    initialSnapshot?.hasRolledThisTurn ?? false
  );

  // Mid-match restore: skip transient turn intro and resume into playing.
  const [turnBannerPlayerIndex, setTurnBannerPlayerIndex] = useState<number | null>(
    restoredLocal ? null : (initialSnapshot?.turnBannerPlayerIndex ?? null)
  );
  const [lastBannerPlayerIndex, setLastBannerPlayerIndex] = useState<number | null>(
    restoredLocal
      ? (initialSnapshot?.turnOrder[initialSnapshot.currentTurnOrderIndex] ?? null)
      : null
  );

  const [statusTitle, setStatusTitle] = useState(
    initialSnapshot?.statusTitle ?? "Determine turn order"
  );
  const [statusSubtitle, setStatusSubtitle] = useState(
    initialSnapshot?.statusSubtitle ??
      "One random draw decides who goes first."
  );

  const [announcement, setAnnouncement] = useState<{
    title: string;
    subtitle?: string;
  } | null>(null);

  const announcementTimeoutRef = useRef<number | null>(null);
  const snapshotVersionRef = useRef(initialSnapshot?.version ?? 0);
  const lastAppliedSnapshotVersionRef = useRef(initialSnapshot?.version ?? -1);
  const localSnapshotReadyRef = useRef(false);
  const onlineIntroShownRef = useRef(false);
  const playersInGameRef = useRef(playersInGame);
  playersInGameRef.current = playersInGame;
  const remoteActionHandlerRef = useRef<
    (fromPlayerId: string, action: OnlineGameAction) => void
  >(() => {});

  const applySnapshot = useCallback((snapshot: OnlineGameSnapshot) => {
    if (snapshot.version <= lastAppliedSnapshotVersionRef.current) return;
    lastAppliedSnapshotVersionRef.current = snapshot.version;
    snapshotVersionRef.current = Math.max(snapshotVersionRef.current, snapshot.version);
    setTurnOrder(snapshot.turnOrder);
    setCurrentTurnOrderIndex(snapshot.currentTurnOrderIndex);
    setRound(snapshot.round);
    setPhase(snapshot.phase);
    setPlayersInGame(
      snapshot.players.map((player) =>
        withDefaultUltimateFields(normalizePlayerLoadout(player as PlayerInGame))
      )
    );
    if (snapshot.boardUltimateState) {
      setBoardUltimateState(snapshot.boardUltimateState);
    }
    if (snapshot.ultimateCast) {
      const cue = snapshot.ultimateCast;
      if (cue.id !== lastPlayedCastIdRef.current) {
        lastPlayedCastIdRef.current = cue.id;
        setUltimateCast(cue);
      }
    }
    setLastRoll(snapshot.lastRoll);
    setDiceDisplayValue(snapshot.diceDisplayValue);
    setDiceFlowPhase(snapshot.diceFlowPhase);
    setHasRolledThisTurn(snapshot.hasRolledThisTurn);
    // Drop stale banners that don't match the snapshot's actual current seat
    // (e.g. host remount replayed the first-player intro).
    {
      const activePlayerIndex =
        snapshot.turnOrder[snapshot.currentTurnOrderIndex] ?? 0;
      const banner = snapshot.turnBannerPlayerIndex;
      setTurnBannerPlayerIndex(
        banner !== null && banner === activePlayerIndex ? banner : null
      );
    }
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
    if (snapshot.pendingEventChoice !== undefined) {
      setPendingEventChoice(
        snapshot.pendingEventChoice
          ? fromSyncedPendingEventChoice(snapshot.pendingEventChoice)
          : null
      );
    }
    if (snapshot.scheduledCustomMatch !== undefined) {
      setScheduledCustomMatch(
        snapshot.scheduledCustomMatch
          ? fromSyncedScheduledCustomMatch(snapshot.scheduledCustomMatch)
          : null
      );
    }
    if (snapshot.customMatchPhase !== undefined) {
      const syncedMatch = snapshot.scheduledCustomMatch
        ? fromSyncedScheduledCustomMatch(snapshot.scheduledCustomMatch)
        : null;
      setCustomMatchPhase(
        mergeCustomMatchPhase(snapshot.customMatchPhase, syncedMatch)
      );
    }
  }, []);

  const {
    publishSnapshot,
    sendAction,
    leaveMatch,
    chatMessages: onlineChatMessages,
    sendChatMessage: sendOnlineChatMessage,
    sendSystemChat: sendOnlineSystemChat,
    yourPlayerId: onlineChatPlayerId,
  } = useOnlineGameSync({
    enabled: !!multiplayer,
    isHost: !!multiplayer?.isHost,
    resumeHostFromServer: !!multiplayer?.isHost && !!multiplayer?.resumedFromSession,
    onSnapshot: applySnapshot,
    onRemoteAction: (fromPlayerId, action) => {
      remoteActionHandlerRef.current(fromPlayerId, action);
    },
  });

  const isLocalPlay = !multiplayer;
  const {
    messages: localChatMessages,
    sendChatMessage: sendLocalChatMessage,
    sendSystemChat: sendLocalSystemChat,
    seedJoinMessages,
  } = useLocalChat(isLocalPlay);

  const chatMessages = multiplayer ? onlineChatMessages : localChatMessages;
  const chatGameEventsRef = useRef(chatGameEvents);
  chatGameEventsRef.current = chatGameEvents;
  const sendSystemChatRef = useRef(sendOnlineSystemChat);
  sendSystemChatRef.current = multiplayer
    ? sendOnlineSystemChat
    : sendLocalSystemChat;

  function publishGameEventChat(text: string) {
    if (multiplayer && !multiplayer.isHost) return;
    if (!chatGameEventsRef.current) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    sendSystemChatRef.current(trimmed);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (ultimateTargeting || razeTargetPlayerIndex != null || ultimateModalOpen) {
        event.preventDefault();
        setUltimateTargeting(null);
        setRazeTargetPlayerIndex(null);
        setUltimateModalOpen(false);
        return;
      }

      if (!canOpenGameMenu) return;

      if (leaveConfirmOpen) {
        event.preventDefault();
        setLeaveConfirmOpen(false);
        return;
      }
      event.preventDefault();
      setGameMenuOpen((open) => !open);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canOpenGameMenu,
    leaveConfirmOpen,
    ultimateTargeting,
    razeTargetPlayerIndex,
    ultimateModalOpen,
  ]);

  const [isMoving, setIsMoving] = useState(initialSnapshot?.isMoving ?? false);
  const [movingPlayerIndex, setMovingPlayerIndex] = useState<number | null>(
    initialSnapshot?.movingPlayerIndex ?? null
  );

  const [pendingPathChoice, setPendingPathChoice] =
    useState<PendingPathChoice | null>(initialSnapshot?.pendingPathChoice ?? null);

  const [animatedToken, setAnimatedToken] = useState<AnimatedTokenState>(
    initialSnapshot?.animatedToken ?? null
  );

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
  const localChatPlayerId = currentPlayer ? String(currentPlayer.id) : null;

  function handleSendChatMessage(text: string) {
    if (multiplayer) {
      sendOnlineChatMessage(text);
      return;
    }
    const speaker = currentPlayer ?? playersInGame[0] ?? null;
    sendLocalChatMessage(
      text,
      speaker ? String(speaker.id) : "local",
      speaker?.name ?? "Player"
    );
  }

  const chatYourPlayerId = multiplayer
    ? onlineChatPlayerId ?? multiplayer.yourPlayerId
    : localChatPlayerId;

  function renderGameChatWidget(className = "") {
    return (
      <RoomChatWidget
        variant="embedded"
        messages={chatMessages}
        onSend={handleSendChatMessage}
        yourPlayerId={chatYourPlayerId}
        title="Chat"
        open={chatOpen}
        onOpenChange={setChatOpen}
        lastReadCount={chatLastReadCount}
        onLastReadCountChange={setChatLastReadCount}
        className={className}
      />
    );
  }

  useEffect(() => {
    if (!isLocalPlay || restoredLocal) return;
    seedJoinMessages(playersInGame.map((player) => player.name));
    // Seed once when entering a fresh local game; join flag blocks repeats.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only seed
  }, [isLocalPlay, restoredLocal, seedJoinMessages]);

  const orderedPlayerIndices = useMemo(() => {
    if (turnOrder.length > 0) {
      return rotatePlayersToActive(turnOrder, currentPlayerIndex);
    }
    // Fallback before turn order is resolved: seat order from active.
    const seats = playersInGame.map((_, index) => index);
    return rotatePlayersToActive(seats, currentPlayerIndex);
  }, [turnOrder, currentPlayerIndex, playersInGame]);

  const inventoryOtherPlayers = useMemo(
    () =>
      playersInGame
        .map((player, index) => ({ index, name: player.name }))
        .filter((entry) => entry.index !== currentPlayerIndex),
    [playersInGame, currentPlayerIndex]
  );

  const [debugOverlayOpen, setDebugOverlayOpen] = useState(false);
  const [debugForcedRoll, setDebugForcedRoll] = useState<number | null>(null);
  const [debugSelectedPlayerIndex, setDebugSelectedPlayerIndex] = useState(0);
  const [debugBoardAction, setDebugBoardAction] = useState<
    "plant-spike" | "teleport-player" | null
  >(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const directorIntroLockRef = useRef(false);

  // Keep debug "Selected player" synced to the active turn seat.
  useEffect(() => {
    setDebugSelectedPlayerIndex(currentPlayerIndex);
  }, [currentPlayerIndex]);

  function pushDebugLog(message: string) {
    const stamp = new Date().toLocaleTimeString("en-GB", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setDebugLogs((current) => [`[${stamp}] ${message}`, ...current].slice(0, 80));
  }
  const [mobileInventoryOpen, setMobileInventoryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLastReadCount, setChatLastReadCount] = useState(0);
  const [isDesktopInventory, setIsDesktopInventory] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : true
  );
  const [pendingInventoryItemId, setPendingInventoryItemId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktopInventory(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

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
    useState<PendingEventChoiceState | null>(() =>
      initialSnapshot?.pendingEventChoice
        ? fromSyncedPendingEventChoice(initialSnapshot.pendingEventChoice)
        : null
    );
  const [eventEffectsApplied, setEventEffectsApplied] = useState(false);
  const [scheduledCustomMatch, setScheduledCustomMatch] =
    useState<ScheduledCustomMatch | null>(() =>
      initialSnapshot?.scheduledCustomMatch
        ? fromSyncedScheduledCustomMatch(initialSnapshot.scheduledCustomMatch)
        : null
    );
  const [customMatchPhase, setCustomMatchPhase] = useState<CustomMatchPhase | null>(
    () => {
      if (!initialSnapshot?.customMatchPhase) return null;
      const syncedMatch = initialSnapshot.scheduledCustomMatch
        ? fromSyncedScheduledCustomMatch(initialSnapshot.scheduledCustomMatch)
        : null;
      return mergeCustomMatchPhase(initialSnapshot.customMatchPhase, syncedMatch);
    }
  );
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
  } | null>(() =>
    initialSnapshot?.activeStoryEvent
      ? fromSyncedActiveStoryEvent(initialSnapshot.activeStoryEvent)
      : null
  );

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
    // Local refresh restore already has the real current seat — do not replay
    // the "first in turn order" banner (that was the Lux/Vyse-vs-Fade bug).
    if (restoredLocal) {
      onlineIntroShownRef.current = true;
      return;
    }
    // Online refresh / guest remount: never invent seat 0. Guests get the banner
    // from host snapshots; hosts resumed mid-match should not flash turn order[0].
    if (isOnlineGuest || multiplayer?.resumedFromSession) {
      onlineIntroShownRef.current = true;
      return;
    }

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
  }, [
    hasPresetTurnOrder,
    initialTurnOrder,
    playersInGame,
    restoredLocal,
    isOnlineGuest,
    multiplayer?.resumedFromSession,
  ]);

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

  /**
   * Apply event roster updates immediately. Position swaps/teleports animate right away
   * (e.g. Omen's Shadows) instead of waiting for Continue.
   */
  function applyEventPlayersWithImmediateMoves(
    previousPlayers: PlayerInGame[],
    nextPlayers: PlayerInGame[]
  ) {
    const moves = nextPlayers
      .map((player, index) => ({
        playerIndex: index,
        fromNodeId: previousPlayers[index]?.position ?? player.position,
        toNodeId: player.position,
      }))
      .filter((move) => move.fromNodeId !== move.toNodeId);

    if (moves.length === 0) {
      setPlayersInGame(nextPlayers);
      return;
    }

    // Hold tokens on old tiles briefly so teleport animation has a from→to path.
    setPlayersInGame(
      nextPlayers.map((player, index) => {
        const previous = previousPlayers[index];
        if (!previous || previous.position === player.position) return player;
        return { ...player, position: previous.position };
      })
    );

    void animatePlayersToPositions(moves);
  }

  async function animatePlayersToPositions(
    moves: { playerIndex: number; fromNodeId: string; toNodeId: string }[]
  ) {
    if (moves.length === 0) return;
    setIsMoving(true);
    for (const move of moves) {
      setMovingPlayerIndex(move.playerIndex);
      const animated = await animateTeleport(
        move.playerIndex,
        move.fromNodeId,
        move.toNodeId,
        setAnimatedToken
      );
      updatePlayerPosition(move.playerIndex, move.toNodeId);
      if (animated) {
        await sleep(90);
      }
    }
    setAnimatedToken(null);
    setIsMoving(false);
    setMovingPlayerIndex(null);
  }

  async function teleportPlayerToNode(playerIndex: number, nodeId: string) {
    const fromNodeId = playersInGameRef.current[playerIndex]?.position;
    if (!fromNodeId || fromNodeId === nodeId) {
      updatePlayer(playerIndex, (player) => ({
        ...player,
        position: nodeId,
      }));
      return;
    }

    await animatePlayersToPositions([
      { playerIndex, fromNodeId, toNodeId: nodeId },
    ]);
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

  function debugAdjustUltimateOrbs(playerIndex: number, amount: number) {
    updatePlayer(playerIndex, (player) => ({
      ...player,
      ultimateOrbs: gainOrb(player.ultimateOrbs ?? 0, amount),
    }));
  }

  function debugSetUltimateOrbs(playerIndex: number, orbs: number) {
    updatePlayer(playerIndex, (player) => ({
      ...player,
      ultimateOrbs: clampOrbs(orbs),
    }));
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
        weaponSlot: "secondary",
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
        weaponSlot: "primary",
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
    if (!activeStoryEvent?.showDirectorIntro) return;
    if (isOnlineGuest) return;
    if (directorIntroLockRef.current) return;
    directorIntroLockRef.current = true;

    const eventId = activeStoryEvent.event.id;
    const def = boardEventById.get(eventId);

    try {
      if (def?.playerChoices) {
        setPendingEventChoice({
          eventId: def.id,
          playerIndex: activeStoryEvent.playerIndex,
          choiceSpec: def.playerChoices,
        });
        setEventEffectsApplied(false);
        pushDebugLog(`Event choice ready: ${def.name} (${def.id})`);
      } else if (def) {
        const previousPlayers = playersInGameRef.current;
        const result = applyEventChoice({
          eventId: def.id,
          playerIndex: activeStoryEvent.playerIndex,
          players: previousPlayers,
          round,
        });
        applyEventPlayersWithImmediateMoves(previousPlayers, result.players);
        setEventEffectsApplied(true);
        if (result.scheduleCustomMatch) {
          setScheduledCustomMatch(
            buildScheduledCustomMatch(
              result.scheduleCustomMatch.matchId as CustomMatchId,
              result.scheduleCustomMatch.mapId as ValorantMapId,
              round,
              playersInGameRef.current,
            )
          );
        }
        setActiveStoryEvent((current) =>
          current
            ? { ...current, event: result.gameEvent, showDirectorIntro: false }
            : null
        );
        pushDebugLog(`Event effects applied: ${def.name} (${def.id})`);
        return;
      } else {
        pushDebugLog(`Director intro done without registry def: ${eventId}`);
      }
      setActiveStoryEvent((current) =>
        current ? { ...current, showDirectorIntro: false } : null
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      pushDebugLog(`Event intro failed: ${eventId} — ${detail}`);
      setPendingEventChoice(null);
      setEventEffectsApplied(false);
      setActiveStoryEvent(null);
      setPhase("playing");
      showAnnouncement("Event failed", detail);
    }
  }

  function isEventPipelineBusy() {
    return (
      phase === "resolving-event" ||
      !!activeStoryEvent ||
      !!pendingEventChoice
    );
  }

  function beginBoardEventFlow(playerIndex: number, eventId: string): boolean {
    if (isEventPipelineBusy()) {
      pushDebugLog(`Event blocked (pipeline busy): ${eventId}`);
      showAnnouncement("Event in progress", "Finish the current event before triggering another.");
      return false;
    }

    const definition = boardEventById.get(eventId);
    if (!definition) {
      pushDebugLog(`Event failed: unknown id ${eventId}`);
      return false;
    }

    const player = playersInGame[playerIndex];
    if (!player) {
      pushDebugLog(`Event failed: missing player index ${playerIndex}`);
      return false;
    }

    setPendingEventChoice(null);
    setEventEffectsApplied(false);
    directorIntroLockRef.current = false;

    const context = {
      triggerPlayer: player,
      triggerAgentName: getAgentName(player),
      playersInGame,
      agents,
    };

    let directorResult;
    try {
      directorResult = buildDirectorPickForEventId(eventPool, eventId, context);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      pushDebugLog(`Event start failed: ${eventId} — ${detail}`);
      showAnnouncement("Event failed", detail);
      return false;
    }

    setPhase("resolving-event");
    setActiveStoryEvent({
      event: directorResult.event,
      playerIndex,
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
    pushDebugLog(
      `Event started: ${directorResult.event.title} (${eventId}) for ${player.name}`
    );
    return true;
  }

  function beginDirectorEventFlow(
    playerIndex: number,
    options?: { forceKingdom?: boolean; forceAgent?: string }
  ): boolean {
    if (isEventPipelineBusy()) {
      pushDebugLog("Director blocked (pipeline busy)");
      showAnnouncement("Event in progress", "Finish the current event before triggering another.");
      return false;
    }

    const player = playersInGame[playerIndex];
    if (!player) return false;

    setPendingEventChoice(null);
    setEventEffectsApplied(false);
    directorIntroLockRef.current = false;

    const context = {
      triggerPlayer: player,
      triggerAgentName: getAgentName(player),
      playersInGame,
      agents,
    };
    const directorResult = pickDirectorEvent(eventPool, context, options);

    setPhase("resolving-event");
    setActiveStoryEvent({
      event: directorResult.event,
      playerIndex,
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
      options?.forceKingdom
        ? "Kingdom Protocol"
        : `Director: ${directorResult.event.title}`,
      directorResult.event.outcome?.headline ?? directorResult.event.story.headline
    );
    pushDebugLog(
      `Director started: ${directorResult.event.title} (${directorResult.event.id}) for ${player.name}`
    );
    return true;
  }

  function debugTriggerStoryEvent(event: GameEvent) {
    beginBoardEventFlow(debugSelectedPlayerIndex, event.id);
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

    if (ultimateTargeting) {
      handleUltimateBoardTileClick(nodeId);
      return;
    }

    handleDebugBoardTileClick(nodeId);
  }

  function cancelUltimateTargeting() {
    setUltimateTargeting(null);
    setRazeTargetPlayerIndex(null);
    setUltimateModalOpen(false);
  }

  function handleUltimateBoardTileClick(nodeId: string) {
    if (!ultimateTargeting) return;
    const kind = ultimateTargeting.targetKind;

    if (kind === "tile" || kind === "tile_and_move") {
      void confirmUltimateFromBoard({ targetNodeId: nodeId });
      return;
    }

    if (kind === "path") {
      const path = findPathContainingNode(nodeId);
      if (!path) return;
      void confirmUltimateFromBoard({
        choiceId: path.id,
        targetNodeId: path.id,
      });
      return;
    }

    if (kind === "player" || kind === "player_or_choice") {
      const opponentsOnTile = playersInGame
        .map((player, index) => ({ player, index }))
        .filter(
          ({ player, index }) =>
            index !== currentPlayerIndex && player.position === nodeId
        );
      if (opponentsOnTile.length === 0) return;
      handleUltimatePlayerTarget(opponentsOnTile[0]!.index);
    }
  }

  function handleUltimateEdgeClick(from: string, to: string) {
    if (!ultimateTargeting || ultimateTargeting.targetKind !== "edge") return;
    void confirmUltimateFromBoard({
      targetNodeId: from,
      targetNodeId2: to,
    });
  }

  function handleUltimatePlayerTarget(playerIndex: number) {
    if (!ultimateTargeting) return;
    if (playerIndex === currentPlayerIndex) return;

    const kind = ultimateTargeting.targetKind;
    if (kind === "player_or_choice") {
      setUltimateTargeting(null);
      setRazeTargetPlayerIndex(playerIndex);
      setUltimateModalOpen(true);
      return;
    }

    if (kind === "player") {
      const isCypher = ultimateTargeting.ultimateId === "neural-theft";
      void confirmUltimateFromBoard({
        targetPlayerIndex: playerIndex,
        stealFromPlayerIndex: isCypher ? playerIndex : undefined,
      });
    }
  }

  function confirmUltimateFromBoard(selection: UltimateTargetSelection) {
    void resolveUltimateUse(selection);
  }

  function handleDebugBoardTileClick(nodeId: string) {
    if (!debugBoardAction) return;

    if (debugBoardAction === "plant-spike") {
      debugPlantSpikeOnNode(nodeId);
      setDebugBoardAction(null);
      return;
    }

    if (debugBoardAction === "teleport-player") {
      void teleportPlayerToNode(debugSelectedPlayerIndex, nodeId);
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

  function handleToggleDebugMode() {
    const next = !debugMode;
    setDebugMode(next);
    if (!next) {
      closeDebugOverlay();
    }
  }

  function toggleDebugOverlay() {
    if (debugOverlayOpen) {
      closeDebugOverlay();
    } else {
      setDebugOverlayOpen(true);
    }
  }

  function openGameMenu() {
    setGameMenuOpen((open) => {
      if (open) setLeaveConfirmOpen(false);
      return !open;
    });
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
    directorIntroLockRef.current = false;
    setLastRoll(null);
    setDiceDisplayValue(null);
    setDiceFlowPhase("hidden");
    setHasRolledThisTurn(false);
    setUltimateTargeting(null);
    setRazeTargetPlayerIndex(null);
    setUltimateModalOpen(false);
  }

  function debugForceNextTurn() {
    resetTurnFlowState();
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
    resetTurnFlowState();
    void advanceToNextPlayer("Debug: Round End", "Forced round wrap.", {
      forceRoundWrap: true,
    });
  }

  function debugTriggerBoardEventById(eventId: string) {
    beginBoardEventFlow(debugSelectedPlayerIndex, eventId);
  }

  function debugTriggerDirector(agentName?: string) {
    beginDirectorEventFlow(debugSelectedPlayerIndex, agentName ? { forceAgent: agentName } : undefined);
  }

  function debugTriggerKingdomProtocol() {
    beginDirectorEventFlow(debugSelectedPlayerIndex, { forceKingdom: true });
  }

  function debugScheduleCustomMatch(matchId: string) {
    const mapId = pickRandomMapForMatch(matchId) as ValorantMapId;
    setScheduledCustomMatch(
      buildScheduledCustomMatch(
        matchId as CustomMatchId,
        mapId,
        round,
        playersInGame,
      )
    );
    const matchName = getCustomMatchDefinition(matchId)?.name ?? matchId;
    setStatusTitle(`Scheduled: ${matchName}`);
    setStatusSubtitle("Plays at end of round.");
    showAnnouncement(`Scheduled ${matchName}`, "Plays when this round completes.");
  }

  function debugPlayCustomMatch(matchId: string) {
    const mapId = pickRandomMapForMatch(matchId) as ValorantMapId;
    beginCustomMatchFlow(
      buildScheduledCustomMatch(
        matchId as CustomMatchId,
        mapId,
        round,
        playersInGame,
      )
    );
  }

  function debugTriggerScheduledMatch() {
    if (scheduledCustomMatch) {
      beginCustomMatchFlow(scheduledCustomMatch);
      return;
    }
    debugScheduleCustomMatch("spike-rush");
    const mapId = pickRandomMapForMatch("spike-rush") as ValorantMapId;
    beginCustomMatchFlow(
      buildScheduledCustomMatch("spike-rush", mapId, round, playersInGame)
    );
  }

  function debugTriggerMapReveal() {
    const match =
      scheduledCustomMatch ??
      buildScheduledCustomMatch(
        "spike-rush",
        pickRandomMapForMatch("spike-rush") as ValorantMapId,
        round,
        playersInGame,
      );
    setCustomMatchPhase({ step: "format", match });
    const matchName = getCustomMatchDefinition(match.matchId)?.name ?? "Custom Match";
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

  async function debugLandOnTile(tileType: TileType) {
    if (isEventPipelineBusy()) {
      showAnnouncement("Event in progress", "Finish the current event before landing on a tile.");
      return;
    }

    const node = boardLayout.find((entry) => entry.type === tileType);
    if (!node) return;

    await teleportPlayerToNode(debugSelectedPlayerIndex, node.id);
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

    if (isOnlineGuest) {
      sendAction({
        type: "event_choice",
        choiceId: args.choiceId,
        targetPlayerIndex: args.targetPlayerIndex,
        betAmount: args.betAmount,
      });
      return;
    }

    const previousPlayers = playersInGameRef.current;
    const result = applyEventChoice({
      eventId: pendingEventChoice.eventId,
      playerIndex: pendingEventChoice.playerIndex,
      players: previousPlayers,
      round,
      ...args,
    });

    applyEventPlayersWithImmediateMoves(previousPlayers, result.players);
    setEventEffectsApplied(true);

    if (result.scheduleCustomMatch) {
      const matchDef = getCustomMatchDefinition(
        result.scheduleCustomMatch.matchId
      );
      setScheduledCustomMatch(
        buildScheduledCustomMatch(
          result.scheduleCustomMatch.matchId as CustomMatchId,
          result.scheduleCustomMatch.mapId as ValorantMapId,
          round,
          playersInGameRef.current,
        )
      );
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
    pushDebugLog(
      `Event choice resolved: ${result.gameEvent.title} (${pendingEventChoice.eventId})`
    );
  }

  function beginCustomMatchFlow(match: ScheduledCustomMatch) {
    const definition = getCustomMatchDefinition(match.matchId);
    const withTeams: ScheduledCustomMatch = {
      ...match,
      ...assignTeamsForCategory(definition?.category ?? "free_for_all", playersInGame.length),
    };
    setScheduledCustomMatch(withTeams);
    setCustomMatchPhase({ step: "format", match: withTeams });
    const matchDef = getCustomMatchDefinition(withTeams.matchId);
    setStatusTitle(`${matchDef?.name ?? "Custom Match"} — Format Reveal`);
    setStatusSubtitle("Deploying engagement parameters");
    showAnnouncement(
      "Custom Match",
      `${matchDef?.name ?? "Custom Match"} on ${withTeams.mapId}`
    );
  }

  function handleFormatRevealComplete() {
    setCustomMatchPhase((current) => {
      if (!current || current.step !== "format") return current;
      return { step: "reveal", match: current.match };
    });
  }

  function handleMapRevealComplete() {
    setCustomMatchPhase((current) => {
      if (!current || current.step !== "reveal") return current;
      const revealedMatch: ScheduledCustomMatch = {
        ...current.match,
        status: "revealed",
      };
      setScheduledCustomMatch(revealedMatch);
      const matchDef = getCustomMatchDefinition(revealedMatch.matchId);
      setStatusTitle(`${matchDef?.name ?? "Custom Match"} Lobby`);
      setStatusSubtitle("Play the match in Valorant when ready.");
      return { step: "lobby", match: revealedMatch };
    });
  }

  function handleStartCustomMatch() {
    if (multiplayer && !multiplayer.isHost) return;
    setCustomMatchPhase((current) => {
      if (!current || current.step !== "lobby") return current;
      const inProgressMatch: ScheduledCustomMatch = {
        ...current.match,
        status: "in_progress",
      };
      setScheduledCustomMatch(inProgressMatch);
      const matchDef = getCustomMatchDefinition(inProgressMatch.matchId);
      setStatusTitle(`${matchDef?.name ?? "Custom Match"} — In Progress`);
      setStatusSubtitle("Play in Valorant, then mark complete.");
      showAnnouncement("Custom Match Started", "Head to Valorant and play the scheduled mode.");
      return { step: "lobby", match: inProgressMatch };
    });
  }

  function handleMarkCustomMatchComplete() {
    if (multiplayer && !multiplayer.isHost) return;
    setCustomMatchPhase((current) => {
      if (!current || current.step !== "lobby") return current;
      return {
        step: "lobby",
        match: current.match,
        selectingWinner: true,
      };
    });
  }

  function handleCancelWinnerSelection() {
    if (multiplayer && !multiplayer.isHost) return;
    setCustomMatchPhase((current) => {
      if (!current || current.step !== "lobby") return current;
      return {
        step: "lobby",
        match: current.match,
        selectingWinner: false,
      };
    });
  }

  async function finishCustomMatchAndResume(
    headline: string,
    subtitle: string,
    rewardIndices: number[]
  ) {
    const activePhase = customMatchPhase;
    if (!activePhase || activePhase.step !== "lobby") return;

    const { match } = activePhase;
    const matchDef = getCustomMatchDefinition(match.matchId);
    const uniqueIndices = [...new Set(rewardIndices)].filter(
      (index) => index >= 0 && index < playersInGame.length
    );

    for (const winnerIndex of uniqueIndices) {
      updatePlayer(winnerIndex, (player) => ({
        ...player,
        creds: player.creds + (matchDef?.winCreds ?? 150),
        radianitePoints: player.radianitePoints + (matchDef?.winRadianite ?? 1),
      }));
    }

    setStatusTitle(headline);
    setStatusSubtitle(subtitle);
    showAnnouncement(`${matchDef?.name ?? "Custom Match"} Complete`, subtitle);
    const winCreds = matchDef?.winCreds ?? 150;
    const winRad = matchDef?.winRadianite ?? 1;
    const winnerNames = uniqueIndices
      .map((index) => playersInGame[index]?.name)
      .filter(Boolean)
      .join(", ");
    if (winnerNames) {
      publishGameEventChat(
        `${matchDef?.name ?? "Custom Match"} won by ${winnerNames} (+${winCreds} creds, +${winRad} radianite)`
      );
    }

    setCustomMatchPhase(null);
    setScheduledCustomMatch(null);

    const nextPlayerIndex = turnOrder[currentTurnOrderIndex] ?? 0;
    setPlayersInGame((current) =>
      current.map((player, index) =>
        index === nextPlayerIndex ? tickMovementModifiers(player) : player
      )
    );

    const wrap = pendingRoundWrap;
    setPendingRoundWrap(null);
    await sleep(AUTO_ADVANCE_DELAY);

    if (round > MAX_ROUNDS) {
      setPhase("game-over");
      setTurnBannerPlayerIndex(null);
      setStatusTitle("Game Over");
      setStatusSubtitle("The match has ended after 10 rounds.");
      showAnnouncement("Game Over", "Check the final standings.");
      publishGameEventChat("Game over — check the final standings");
      return;
    }

    if (wrap) {
      showTurnBannerFor(nextPlayerIndex);
      const nextName = playersInGame[nextPlayerIndex]?.name ?? "Player";
      setStatusTitle(wrap.title ?? `Next player: ${nextName}`);
      setStatusSubtitle(wrap.subtitle ?? `${nextName} is now up`);
      showAnnouncement(
        wrap.title ?? `Next player: ${nextName}`,
        wrap.subtitle ?? `${nextName} is now up`
      );
    }
  }

  async function handleSelectCustomMatchWinner(winnerIndex: number) {
    if (multiplayer && !multiplayer.isHost) return;
    const winnerName = playersInGame[winnerIndex]?.name ?? "Player";
    const matchDef = getCustomMatchDefinition(customMatchPhase?.match.matchId ?? "");
    await finishCustomMatchAndResume(
      `${winnerName} wins ${matchDef?.name ?? "Custom Match"}!`,
      `+${matchDef?.winCreds ?? 150} Creds on ${customMatchPhase?.match.mapId ?? "map"}`,
      [winnerIndex]
    );
  }

  async function handleSelectCustomMatchWinnerTeam(team: "alpha" | "bravo") {
    if (multiplayer && !multiplayer.isHost) return;
    const activePhase = customMatchPhase;
    if (!activePhase || activePhase.step !== "lobby") return;

    const { match } = activePhase;
    const indices = team === "alpha" ? match.teamAlpha ?? [] : match.teamBravo ?? [];
    const teamLabel = team === "alpha" ? "Team Alpha" : "Team Bravo";
    const matchDef = getCustomMatchDefinition(match.matchId);
    await finishCustomMatchAndResume(
      `${teamLabel} wins ${matchDef?.name ?? "Custom Match"}!`,
      `${teamLabel} takes the bonus on ${match.mapId}`,
      indices
    );
  }

  async function handleSelectCustomMatchWinnerSide(side: "attackers" | "defenders") {
    if (multiplayer && !multiplayer.isHost) return;
    const activePhase = customMatchPhase;
    if (!activePhase || activePhase.step !== "lobby") return;

    const { match } = activePhase;
    const indices =
      side === "attackers"
        ? match.attackerIndex != null
          ? [match.attackerIndex]
          : []
        : match.defenderIndices ?? [];
    const sideLabel = side === "attackers" ? "Attackers" : "Defenders";
    const matchDef = getCustomMatchDefinition(match.matchId);
    await finishCustomMatchAndResume(
      `${sideLabel} win ${matchDef?.name ?? "Custom Match"}!`,
      `${sideLabel} take the bonus on ${match.mapId}`,
      indices
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
    publishGameEventChat(
      `${winnerName} won ${minigameDef?.name ?? "Minigame"} (+${minigameDef?.rewards.creds ?? MINIGAME_WIN_CREDS} creds, +${minigameDef?.rewards.radianite ?? MINIGAME_WIN_RADIANITE} radianite)`
    );
  }

  async function finishMinigameAndAdvance() {
    if (!minigamePhase || minigamePhase.step !== "result") return;

    const { winnerIndex, triggeredByIndex, minigameId } = minigamePhase;
    const minigameDef = minigameById.get(minigameId);

    updatePlayer(winnerIndex, (p) => {
      const baseCreds = minigameDef?.rewards.creds ?? MINIGAME_WIN_CREDS;
      const baseRad = minigameDef?.rewards.radianite ?? MINIGAME_WIN_RADIANITE;
      const mult = (p.ultimateStatus?.reynaBuffRounds ?? 0) > 0 ? 2 : 1;
      return {
        ...p,
        creds: p.creds + baseCreds * mult,
        radianitePoints: p.radianitePoints + baseRad * mult,
      };
    });
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
    publishGameEventChat(
      `Spike detonated — ${pendingSpikeDetonationReveal.planterName} earned +1 radianite`
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

  async function advanceToNextPlayer(
    title?: string,
    subtitle?: string,
    options?: { forceRoundWrap?: boolean }
  ) {
    if (turnOrder.length === 0) return;
    if (isOnlineGuest) return;

    const fromOrderIndex = options?.forceRoundWrap
      ? turnOrder.length - 1
      : currentTurnOrderIndex;
    const fromPlayerIndex = options?.forceRoundWrap
      ? (turnOrder[fromOrderIndex] ?? currentPlayerIndex)
      : currentPlayerIndex;

    const finishingPlayer = playersInGameRef.current[fromPlayerIndex];

    // Phoenix Run It Back — resolve before leaving the turn.
    if (
      finishingPlayer?.ultimateStatus?.phoenixRunItBack &&
      !options?.forceRoundWrap
    ) {
      setPhoenixChoiceOpen(true);
      return;
    }

    // Sage extra turn — stay on the same seat (still earns +1 orb).
    if (
      finishingPlayer?.ultimateStatus?.extraTurnPending &&
      !options?.forceRoundWrap
    ) {
      setPlayersInGame((current) =>
        current.map((player, index) => {
          if (index !== fromPlayerIndex) return player;
          return {
            ...player,
            ultimateOrbs: gainOrb(player.ultimateOrbs ?? 0, 1),
            ultimateStatus: {
              ...createEmptyPlayerUltimateStatus(),
              ...player.ultimateStatus,
              extraTurnPending: false,
              turnStartPosition: player.position,
              inViperPit: isInPoisonCloud(
                boardUltimateStateRef.current,
                player.position
              ),
            },
          };
        })
      );
      setIsMoving(false);
      setMovingPlayerIndex(null);
      setAnimatedToken(null);
      setPendingPathChoice(null);
      setCanBuyAfterLanding(false);
      setDefusePrompt(null);
      setLastRoll(null);
      setDiceDisplayValue(null);
      setDiceFlowPhase("hidden");
      setHasRolledThisTurn(false);
      setPhase("playing");
      showTurnBannerFor(fromPlayerIndex);
      const name = finishingPlayer.name;
      setStatusTitle(`${name} — Extra Turn`);
      setStatusSubtitle("Resurrection grants another turn.");
      showAnnouncement(`${name} — Extra Turn`, "Resurrection grants another turn.");
      return;
    }

    const meta = getNextPlayerMeta({
      fromPlayerIndex,
      turnOrder,
      currentTurnOrderIndex: fromOrderIndex,
    });
    let newRound = meta.wrapsRound ? round + 1 : round;
    let nextOrderIndex = meta.nextOrderIndex;
    let nextPlayerIndex = meta.nextPlayerIndex;
    let wrapsRound = meta.wrapsRound;

    // Grant +1 orb to the finishing player; skip seats with skipNextTurn.
    const latestPlayers = playersInGameRef.current.map((p, i) =>
      i === fromPlayerIndex
        ? { ...p, ultimateOrbs: gainOrb(p.ultimateOrbs ?? 0, 1) }
        : { ...p }
    );
    {
      let guard = 0;
      while (guard < turnOrder.length) {
        const candidate = latestPlayers[nextPlayerIndex];
        if (!candidate?.ultimateStatus?.skipNextTurn) break;
        latestPlayers[nextPlayerIndex] = {
          ...candidate,
          ultimateStatus: {
            ...createEmptyPlayerUltimateStatus(),
            ...candidate.ultimateStatus,
            skipNextTurn: false,
          },
        };
        const skipMeta = getNextPlayerMeta({
          fromPlayerIndex: nextPlayerIndex,
          turnOrder,
          currentTurnOrderIndex: nextOrderIndex,
        });
        nextOrderIndex = skipMeta.nextOrderIndex;
        nextPlayerIndex = skipMeta.nextPlayerIndex;
        if (skipMeta.wrapsRound) {
          wrapsRound = true;
          newRound = round + 1;
        }
        guard += 1;
      }
    }

    if (wrapsRound) {
      setBoardUltimateState((board) => tickBoardUltimateState(board));
    }

    if (wrapsRound && scheduledCustomMatch && !customMatchPhase) {
      setPlayersInGame(latestPlayers);
      setPendingRoundWrap({ title, subtitle });
      beginCustomMatchFlow(scheduledCustomMatch);
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
      setCurrentTurnOrderIndex(nextOrderIndex);
      setRound(newRound);
      setPhase("playing");
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
    setCurrentTurnOrderIndex(nextOrderIndex);
    setRound(newRound);
    setPhase("playing");

    {
      const nextPlayer = latestPlayers[nextPlayerIndex];
      if (nextPlayer) {
        const afterMoveTick = tickMovementModifiers(nextPlayer);
        latestPlayers[nextPlayerIndex] = {
          ...afterMoveTick,
          ultimateStatus: tickPlayerUltimateStatus(
            afterMoveTick.ultimateStatus ?? createEmptyPlayerUltimateStatus(),
            afterMoveTick.position,
            wrapsRound
              ? tickBoardUltimateState(boardUltimateStateRef.current)
              : boardUltimateStateRef.current
          ),
        };
      }
      setPlayersInGame(latestPlayers);
    }

    if (newRound > MAX_ROUNDS) {
      setPhase("game-over");
      setTurnBannerPlayerIndex(null);
      setStatusTitle("Game Over");
      setStatusSubtitle("The match has ended after 10 rounds.");
      showAnnouncement("Game Over", "Check the final standings.");
      publishGameEventChat("Game over — check the final standings");
      return;
    }

    showTurnBannerFor(nextPlayerIndex);

    const resolvedTitle =
      title ?? `Next player: ${playersInGame[nextPlayerIndex]?.name ?? "Player"}`;
    const resolvedSubtitle =
      subtitle ??
      `${playersInGame[nextPlayerIndex]?.name ?? "Player"} is now up`;

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
      publishGameEventChat(`${playerName} defused the spike (+1 radianite)`);
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

    if (isOnlineGuest) {
      sendAction({ type: "finish_event" });
      return;
    }

    const { event, playerIndex } = activeStoryEvent;
    const player = playersInGameRef.current[playerIndex];
    pushDebugLog(`Event completing: ${event.title} (${event.id})`);

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
    directorIntroLockRef.current = false;
    setPhase("playing");
    setLastEventTitle(event.title);
    setStatusTitle(`${player?.name ?? "Player"} , ${event.title}`);
    setStatusSubtitle(event.outcome?.description ?? event.description);
    showAnnouncement(
      event.title,
      event.outcome?.description ?? event.description
    );

    const effect = event.outcome?.effect ?? resolvedEffect;
    if (effect?.type === "creds" && effect.amount !== 0) {
      const sign = effect.amount > 0 ? "+" : "";
      publishGameEventChat(
        `${player?.name ?? "Player"} ${effect.amount > 0 ? "earned" : "lost"} ${sign}${effect.amount} creds (${event.title})`
      );
    } else if (effect?.type === "radianite" && effect.amount !== 0) {
      const sign = effect.amount > 0 ? "+" : "";
      publishGameEventChat(
        `${player?.name ?? "Player"} ${effect.amount > 0 ? "earned" : "lost"} ${sign}${effect.amount} radianite (${event.title})`
      );
    }

    await sleep(600);
    pushDebugLog(`Event complete — advancing turn after ${event.title}`);
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
      if (isEventPipelineBusy()) {
        pushDebugLog(
          `Tile event skipped (pipeline busy) for ${player.name} on ${finalNodeId}`
        );
        await advanceToNextPlayer(
          `Next player: ${getResolvedNextPlayerName(playerIndex)}`,
          `${getResolvedNextPlayerName(playerIndex)} is now up`
        );
        return;
      }

      const directorResult = pickDirectorEvent(eventPool, {
        triggerPlayer: player,
        triggerAgentName: getAgentName(player),
        playersInGame,
        agents,
      });
      const gameEvent = directorResult.event;

      setPendingEventChoice(null);
      setEventEffectsApplied(false);
      directorIntroLockRef.current = false;
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
      pushDebugLog(
        `Tile event started: ${gameEvent.title} (${gameEvent.id}) for ${player.name}`
      );
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

  async function beginDiceRoll(fromRemote = false) {
    const seatOk = fromRemote || isCurrentSeatActor();
    if (diceFlowPhase !== "ready" || !isTurnInteractionClear() || !seatOk) {
      return;
    }

    setDiceFlowPhase("rolling");
    setLastEventTitle(null);
    setDiceDisplayValue(randomDiceRoll());

    await sleep(DICE_ROLL_DURATION_MS);

    const rawRoll = debugForcedRoll ?? randomDiceRoll();
    const player = playersInGameRef.current[currentPlayerIndex];
    // Sync Viper pit flag from board before computing roll.
    if (player) {
      const inPit = isInPoisonCloud(
        boardUltimateStateRef.current,
        player.position
      );
      if ((player.ultimateStatus?.inViperPit ?? false) !== inPit) {
        updatePlayer(currentPlayerIndex, (p) => ({
          ...p,
          ultimateStatus: {
            ...createEmptyPlayerUltimateStatus(),
            ...p.ultimateStatus,
            inViperPit: inPit,
          },
        }));
      }
    }
    const syncedPlayer = playersInGameRef.current[currentPlayerIndex];
    const bonus = syncedPlayer?.movementBonus ?? 0;
    const finalRoll = syncedPlayer
      ? computeEffectiveRoll(rawRoll, {
          ...syncedPlayer,
          ultimateStatus: {
            ...createEmptyPlayerUltimateStatus(),
            ...syncedPlayer.ultimateStatus,
            inViperPit: isInPoisonCloud(
              boardUltimateStateRef.current,
              syncedPlayer.position
            ),
          },
        })
      : rawRoll;
    setDiceDisplayValue(finalRoll);
    setLastRoll(finalRoll);

    if (syncedPlayer && bonus > 0) {
      updatePlayer(currentPlayerIndex, (current) =>
        consumeOneShotMovementBonus(current)
      );
      if ((syncedPlayer.movementBonusTurns ?? 0) === 0) {
        setStatusSubtitle(
          `Rolled ${rawRoll} + ${bonus} bonus = ${finalRoll}`
        );
      }
    }

    // Consume Neon Overdrive after it has been applied to this roll.
    if (syncedPlayer?.ultimateStatus?.neonOverdrive) {
      updatePlayer(currentPlayerIndex, (current) => ({
        ...current,
        ultimateStatus: {
          ...createEmptyPlayerUltimateStatus(),
          ...current.ultimateStatus,
          neonOverdrive: false,
        },
      }));
    }

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
    const yoruIgnore =
      (playersInGame[currentPlayerIndex]?.ultimateStatus?.yoruDriftRounds ?? 0) >
      0;

    const result = (await traverseMovement({
      playerIndex: currentPlayerIndex,
      startNodeId: startPosition,
      steps: finalRoll,
      setAnimatedToken,
      updatePlayerPosition,
      onPassOverSpike: (nodeId, playerIdx) =>
        handlePassOverSpike(nodeId, playerIdx),
      isEdgeBlocked: (from, to) =>
        !yoruIgnore &&
        isEdgeBlockedByWall(boardUltimateStateRef.current, from, to),
      onEnterNode: (nodeId, playerIdx) => {
        const trap = getArmedTrapAt(boardUltimateStateRef.current, nodeId);
        if (!trap || trap.ownerPlayerIndex === playerIdx) return false;
        if (
          (playersInGameRef.current[playerIdx]?.ultimateStatus?.yoruDriftRounds ??
            0) > 0
        ) {
          return false;
        }
        setBoardUltimateState((board) => ({
          ...board,
          traps: board.traps.map((t) =>
            t.nodeId === nodeId ? { ...t, armed: false } : t
          ),
        }));
        showAnnouncement("Steel Garden", "Trap sprung — movement ended.");
        return true;
      },
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
      const slot =
        offer.weaponSlot ??
        (sidearmWeapons.includes(offer.weaponName as WeaponName)
          ? "secondary"
          : "primary");
      const result = buyWeaponForPlayer({
        weapon: offer.weaponName as WeaponName,
        player: currentPlayer,
        isOnShopTile: true,
        slot,
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

  function isTurnInteractionClear() {
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
      turnBannerPlayerIndex === null
    );
  }

  function isCurrentSeatActor() {
    return !multiplayer || multiplayer.yourPlayerIndex === currentPlayerIndex;
  }

  function canInteractWithDice() {
    return isTurnInteractionClear() && isCurrentSeatActor();
  }

  function canUseInventoryActions() {
    return (
      isTurnInteractionClear() &&
      isCurrentSeatActor() &&
      diceFlowPhase === "hidden" &&
      !hasRolledThisTurn
    );
  }

  function canHostApplyCurrentTurnInventory() {
    return (
      isTurnInteractionClear() &&
      diceFlowPhase === "hidden" &&
      !hasRolledThisTurn
    );
  }

  function applyInventoryItemUse(
    itemId: string,
    targetPlayerIndex?: number,
    options?: { fromRemote?: boolean }
  ): boolean {
    const allowed = options?.fromRemote
      ? canHostApplyCurrentTurnInventory()
      : canUseInventoryActions();
    if (!allowed) return false;
    const player = playersInGameRef.current[currentPlayerIndex];
    if (!player?.items.includes(itemId)) return false;
    if ((player.ultimateStatus?.itemsLockedTurns ?? 0) > 0) {
      setStatusTitle("Items locked");
      setStatusSubtitle("NULL/CMD prevents item use this turn.");
      return false;
    }

    const item = itemById.get(itemId);
    const effect = item?.boardEffect;
    if (!effect) return false;

    if (effect.kind === "dice_bonus") {
      updatePlayer(currentPlayerIndex, (current) => ({
        ...current,
        items: current.items.filter((id) => id !== itemId),
        // One-shot: turns === 0 means consume on the next movement roll.
        movementBonus: (current.movementBonus ?? 0) + effect.amount,
        movementBonusTurns: 0,
      }));
      setPendingInventoryItemId(null);
      setStatusTitle(`${player.name} used ${item.name}`);
      setStatusSubtitle(`+${effect.amount} on next movement roll.`);
      showAnnouncement(
        `${player.name} used ${item.name}`,
        `+${effect.amount} on next movement roll.`
      );
      return true;
    }

    if (effect.kind === "steal_creds") {
      const roster = playersInGameRef.current;
      if (
        targetPlayerIndex == null ||
        targetPlayerIndex === currentPlayerIndex ||
        !roster[targetPlayerIndex]
      ) {
        setPendingInventoryItemId(itemId);
        return false;
      }
      const stolen = Math.min(
        effect.amount,
        roster[targetPlayerIndex].creds
      );
      const targetName = roster[targetPlayerIndex].name;
      setPlayersInGame((current) =>
        current.map((entry, index) => {
          if (index === targetPlayerIndex) {
            return {
              ...entry,
              creds: Math.max(0, entry.creds - stolen),
            };
          }
          if (index === currentPlayerIndex) {
            return {
              ...entry,
              items: entry.items.filter((id) => id !== itemId),
              creds: entry.creds + stolen,
            };
          }
          return entry;
        })
      );
      setPendingInventoryItemId(null);
      setStatusTitle(`${player.name} used ${item.name}`);
      setStatusSubtitle(`Stole ${stolen} creds from ${targetName}.`);
      showAnnouncement(
        `${player.name} used ${item.name}`,
        `Stole ${stolen} creds from ${targetName}.`
      );
      return true;
    }

    if (effect.kind === "swap_position") {
      const roster = playersInGameRef.current;
      if (
        targetPlayerIndex == null ||
        targetPlayerIndex === currentPlayerIndex ||
        !roster[targetPlayerIndex]
      ) {
        setPendingInventoryItemId(itemId);
        return false;
      }
      const selfPos = roster[currentPlayerIndex].position;
      const targetPos = roster[targetPlayerIndex].position;
      const targetName = roster[targetPlayerIndex].name;
      setPlayersInGame((current) =>
        current.map((entry, index) => {
          if (index === currentPlayerIndex) {
            return {
              ...entry,
              items: entry.items.filter((id) => id !== itemId),
            };
          }
          return entry;
        })
      );
      setPendingInventoryItemId(null);
      setStatusTitle(`${player.name} used ${item.name}`);
      setStatusSubtitle(`Swapped positions with ${targetName}.`);
      showAnnouncement(
        `${player.name} used ${item.name}`,
        `Swapped positions with ${targetName}.`
      );
      void animatePlayersToPositions([
        {
          playerIndex: currentPlayerIndex,
          fromNodeId: selfPos,
          toNodeId: targetPos,
        },
        {
          playerIndex: targetPlayerIndex,
          fromNodeId: targetPos,
          toNodeId: selfPos,
        },
      ]);
      return true;
    }

    if (effect.kind === "hit_anywhere") {
      setStatusTitle(item.name);
      setStatusSubtitle("Board targeting is not available from inventory yet.");
      showAnnouncement(
        item.name,
        "Board targeting is not available from inventory yet."
      );
      return false;
    }

    setStatusTitle(item.name);
    setStatusSubtitle("This item can only be used during spike defuse.");
    return false;
  }

  function handleInventoryItemAction(action: InventoryItemAction) {
    if (!canUseInventoryActions()) return;

    if (isOnlineGuest) {
      if (multiplayer?.yourPlayerIndex !== currentPlayerIndex) return;
      if (action.kind === "use") {
        const item = itemById.get(action.itemId);
        if (
          item?.boardEffect?.kind === "steal_creds" ||
          item?.boardEffect?.kind === "swap_position"
        ) {
          setPendingInventoryItemId(action.itemId);
          return;
        }
        sendAction({ type: "use_item", itemId: action.itemId });
        return;
      }
      sendAction({
        type: "use_item",
        itemId: action.itemId,
        targetPlayerIndex: action.targetPlayerIndex,
      });
      return;
    }

    if (action.kind === "use") {
      applyInventoryItemUse(action.itemId);
      return;
    }
    applyInventoryItemUse(action.itemId, action.targetPlayerIndex);
  }

  function openUltimateModal() {
    if (!canUseInventoryActions()) return;
    const agentName = getAgentName(playersInGame[currentPlayerIndex] ?? playersInGame[0]!);
    const def = getUltimateForAgent(agentName);
    if (!def || def.implementation !== "full") return;
    const player = playersInGame[currentPlayerIndex];
    if (!player || !canActivateUltimate(player.ultimateOrbs ?? 0)) return;

    setMobileInventoryOpen(false);
    setRazeTargetPlayerIndex(null);

    if (def.targetKind === "none") {
      if (isOnlineGuest) {
        if (multiplayer?.yourPlayerIndex !== currentPlayerIndex) return;
        sendAction({ type: "use_ultimate" });
        return;
      }
      void resolveUltimateUse({});
      return;
    }

    if (usesBoardTargeting(def.targetKind)) {
      if (isOnlineGuest && multiplayer?.yourPlayerIndex !== currentPlayerIndex) {
        return;
      }
      setUltimateModalOpen(false);
      setUltimateTargeting({
        agentName,
        ultimateId: def.id,
        ultimateName: def.name,
        targetKind: def.targetKind,
      });
      return;
    }

    // Choice / sequential (Sage, Killjoy) — keep modal.
    if (isOnlineGuest && multiplayer?.yourPlayerIndex !== currentPlayerIndex) {
      return;
    }
    setUltimateTargeting(null);
    setUltimateModalOpen(true);
  }

  async function resolveUltimateUse(
    selection: UltimateTargetSelection,
    options?: { fromRemote?: boolean }
  ) {
    if (!options?.fromRemote && isOnlineGuest) {
      sendAction({
        type: "use_ultimate",
        targetPlayerIndex: selection.targetPlayerIndex,
        targetNodeId: selection.targetNodeId,
        targetNodeId2: selection.targetNodeId2,
        choiceId: selection.choiceId,
        opponentChoices: selection.opponentChoices,
        razeMode: selection.razeMode,
        stealFromPlayerIndex: selection.stealFromPlayerIndex,
      });
      setUltimateModalOpen(false);
      setUltimateTargeting(null);
      setRazeTargetPlayerIndex(null);
      return;
    }

    const casterIndex = currentPlayerIndex;
    const caster = playersInGameRef.current[casterIndex];
    if (!caster) return;
    const agentName = getAgentName(caster);
    const def = getUltimateForAgent(agentName);
    if (!def) return;

    const result = applyUltimate({
      casterPlayerIndex: casterIndex,
      agentName,
      players: playersInGameRef.current.map(toUltimatePlayerState),
      board: boardUltimateStateRef.current,
      boardNodeIds: getBoardNodeIds(),
      adjacency: buildBoardAdjacency(),
      paths: ULTIMATE_BOARD_PATHS,
      currentRound: round,
      targetPlayerIndex: selection.targetPlayerIndex,
      targetNodeId: selection.targetNodeId,
      targetNodeId2: selection.targetNodeId2,
      choiceId: selection.choiceId,
      opponentChoices: selection.opponentChoices,
      razeMode: selection.razeMode,
      stealFromPlayerIndex: selection.stealFromPlayerIndex,
    });

    if (result.incomplete) {
      setStatusTitle(result.headline);
      setStatusSubtitle(result.description);
      showAnnouncement(result.headline, result.description);
      // Keep / restore targeting or modal so the cast can be completed.
      if (usesBoardTargeting(def.targetKind) && def.targetKind !== "player_or_choice") {
        setUltimateModalOpen(false);
        setUltimateTargeting({
          agentName,
          ultimateId: def.id,
          ultimateName: def.name,
          targetKind: def.targetKind,
        });
      } else if (
        def.targetKind === "choice" ||
        def.targetKind === "sequential_opponents" ||
        def.targetKind === "player_or_choice"
      ) {
        setUltimateModalOpen(true);
      }
      return;
    }

    setUltimateModalOpen(false);
    setUltimateTargeting(null);
    setRazeTargetPlayerIndex(null);
    setPlayersInGame(mergeUltimatePlayers(playersInGameRef.current, result.players));
    setBoardUltimateState(result.board);
    setStatusTitle(result.headline);
    setStatusSubtitle(result.description);
    showAnnouncement(result.headline, result.description);
    publishGameEventChat(`${caster.name} used ${result.headline}: ${result.description}`);

    const orbsBefore = caster.ultimateOrbs ?? 0;
    const orbsAfter = result.players[casterIndex]?.ultimateOrbs ?? orbsBefore;
    if (orbsAfter < orbsBefore && def) {
      const cue = buildUltimateCastCue({
        def,
        casterPlayerIndex: casterIndex,
        casterName: caster.name,
        casterPosition: caster.position,
        selection,
        result,
        playerPositions: playersInGameRef.current.map((p) => p.position),
        rangeTiles: def.rangeTiles,
      });
      lastPlayedCastIdRef.current = cue.id;
      setUltimateCast(cue);
      await sleep(Math.min(900, cue.durationMs));
    }

    for (const change of result.positionChanges) {
      await animateTeleport(
        change.playerIndex,
        change.fromNodeId,
        change.toNodeId,
        setAnimatedToken
      );
    }
    setAnimatedToken(null);

    if (result.omenMiniMoveSteps != null) {
      setPendingOmenMiniMove({
        steps: result.omenMiniMoveSteps,
        fromNodeId:
          result.players[casterIndex]?.position ??
          caster.position,
      });
    }

    if (result.jettMoveSteps != null) {
      void runJettBladeStormMove(result.jettMoveSteps);
    }
  }

  async function runJettBladeStormMove(steps: number) {
    const playerIndex = currentPlayerIndex;
    const startPosition =
      playersInGameRef.current[playerIndex]?.position ?? "start";
    const passed: number[] = [];
    setIsMoving(true);
    setMovingPlayerIndex(playerIndex);
    setHasRolledThisTurn(true);
    setDiceFlowPhase("hidden");

    const yoruIgnore =
      (playersInGameRef.current[playerIndex]?.ultimateStatus?.yoruDriftRounds ??
        0) > 0;

    const result = await traverseMovement({
      playerIndex,
      startNodeId: startPosition,
      steps,
      setAnimatedToken,
      updatePlayerPosition: (idx, nodeId) => {
        updatePlayerPosition(idx, nodeId);
        for (let i = 0; i < playersInGameRef.current.length; i += 1) {
          if (i === idx) continue;
          if (playersInGameRef.current[i]?.position === nodeId) {
            passed.push(i);
          }
        }
      },
      onPassOverSpike: (nodeId, playerIdx) =>
        handlePassOverSpike(nodeId, playerIdx),
      isEdgeBlocked: (from, to) =>
        !yoruIgnore &&
        isEdgeBlockedByWall(boardUltimateStateRef.current, from, to),
      onEnterNode: (nodeId, playerIdx) => {
        const trap = getArmedTrapAt(boardUltimateStateRef.current, nodeId);
        if (!trap || trap.ownerPlayerIndex === playerIdx) return false;
        setBoardUltimateState((board) => ({
          ...board,
          traps: board.traps.map((t) =>
            t.nodeId === nodeId ? { ...t, armed: false } : t
          ),
        }));
        showAnnouncement("Steel Garden", "Trap sprung — movement ended.");
        return true;
      },
    });

    setIsMoving(false);
    setMovingPlayerIndex(null);
    setAnimatedToken(null);

    const toll = applyJettPassToll(
      playersInGameRef.current.map(toUltimatePlayerState),
      playerIndex,
      passed
    );
    setPlayersInGame(
      mergeUltimatePlayers(playersInGameRef.current, toll.players)
    );
    if (toll.description) {
      setStatusSubtitle(toll.description);
      showAnnouncement("Blade Storm", toll.description);
    }

    if (result.blockedBySplit) {
      setPendingPathChoice({
        playerIndex,
        atNodeId: result.finalNodeId,
        remainingSteps: result.remainingSteps ?? 1,
        options: result.splitOptions ?? [],
      });
      return;
    }

    await resolveLanding(playerIndex, result.finalNodeId, steps);
  }

  async function resolvePhoenixChoice(keepEndPosition: boolean) {
    const idx = currentPlayerIndex;
    const player = playersInGameRef.current[idx];
    if (!player) return;
    setPhoenixChoiceOpen(false);

    if (!keepEndPosition && player.ultimateStatus?.turnStartPosition) {
      const from = player.position;
      const to = player.ultimateStatus.turnStartPosition;
      updatePlayer(idx, (p) => ({
        ...p,
        position: to,
        ultimateStatus: {
          ...createEmptyPlayerUltimateStatus(),
          ...p.ultimateStatus,
          phoenixRunItBack: false,
          turnStartPosition: null,
        },
      }));
      await animateTeleport(idx, from, to, setAnimatedToken);
      setAnimatedToken(null);
    } else {
      updatePlayer(idx, (p) => ({
        ...p,
        ultimateStatus: {
          ...createEmptyPlayerUltimateStatus(),
          ...p.ultimateStatus,
          phoenixRunItBack: false,
          turnStartPosition: null,
        },
      }));
    }

    await advanceToNextPlayer();
  }

  async function resolveOmenMiniMove(steps: number) {
    const pending = pendingOmenMiniMove;
    setPendingOmenMiniMove(null);
    if (!pending || steps <= 0) return;
    const playerIndex = currentPlayerIndex;
    const yoruIgnore =
      (playersInGameRef.current[playerIndex]?.ultimateStatus?.yoruDriftRounds ??
        0) > 0;
    setIsMoving(true);
    setMovingPlayerIndex(playerIndex);
    await traverseMovement({
      playerIndex,
      startNodeId:
        playersInGameRef.current[playerIndex]?.position ?? pending.fromNodeId,
      steps,
      setAnimatedToken,
      updatePlayerPosition,
      isEdgeBlocked: (from, to) =>
        !yoruIgnore &&
        isEdgeBlockedByWall(boardUltimateStateRef.current, from, to),
    });
    setIsMoving(false);
    setMovingPlayerIndex(null);
    setAnimatedToken(null);
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
      pendingEventChoice: toSyncedPendingEventChoice(pendingEventChoice),
      scheduledCustomMatch: toSyncedScheduledCustomMatch(scheduledCustomMatch),
      customMatchPhase: toSyncedCustomMatchPhase(customMatchPhase),
      boardUltimateState,
      ultimateCast,
    });
  }, [
    activeStoryEvent,
    animatedToken,
    boardUltimateState,
    customMatchPhase,
    currentTurnOrderIndex,
    diceDisplayValue,
    diceFlowPhase,
    hasRolledThisTurn,
    isMoving,
    lastRoll,
    movingPlayerIndex,
    multiplayer?.isHost,
    pendingEventChoice,
    pendingPathChoice,
    phase,
    playersInGame,
    publishSnapshot,
    round,
    scheduledCustomMatch,
    statusSubtitle,
    statusTitle,
    turnBannerPlayerIndex,
    turnOrder,
    ultimateCast,
  ]);

  useEffect(() => {
    if (multiplayer || !onLocalSnapshotChange) return;

    // Skip the first paint so a restored snapshot is not immediately rewritten.
    if (!localSnapshotReadyRef.current) {
      localSnapshotReadyRef.current = true;
      return;
    }

    snapshotVersionRef.current += 1;
    onLocalSnapshotChange({
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
      // Never persist the turn intro — refresh should resume ready-to-play.
      turnBannerPlayerIndex: null,
      statusTitle,
      statusSubtitle,
      isMoving,
      movingPlayerIndex,
      animatedToken,
      pendingPathChoice,
      activeStoryEvent: activeStoryEvent
        ? toSyncedActiveStoryEvent(activeStoryEvent)
        : null,
      pendingEventChoice: toSyncedPendingEventChoice(pendingEventChoice),
      scheduledCustomMatch: toSyncedScheduledCustomMatch(scheduledCustomMatch),
      customMatchPhase: toSyncedCustomMatchPhase(customMatchPhase),
      boardUltimateState,
      ultimateCast,
    });
  }, [
    activeStoryEvent,
    animatedToken,
    boardUltimateState,
    customMatchPhase,
    currentTurnOrderIndex,
    diceDisplayValue,
    diceFlowPhase,
    hasRolledThisTurn,
    isMoving,
    lastRoll,
    movingPlayerIndex,
    multiplayer,
    onLocalSnapshotChange,
    pendingEventChoice,
    pendingPathChoice,
    phase,
    playersInGame,
    round,
    scheduledCustomMatch,
    statusSubtitle,
    statusTitle,
    turnBannerPlayerIndex,
    turnOrder,
    ultimateCast,
  ]);

  useEffect(() => {
    remoteActionHandlerRef.current = (fromPlayerId, action) => {
      if (!multiplayer?.isHost) return;
      const playerIndex = multiplayer.playerIndexByLobbyId[fromPlayerId];
      if (playerIndex == null || playerIndex !== currentPlayerIndex) return;

      switch (action.type) {
        case "open_dice":
          if (
            !isTurnInteractionClear() ||
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
            void beginDiceRoll(true);
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
        case "use_item":
          applyInventoryItemUse(action.itemId, action.targetPlayerIndex, {
            fromRemote: true,
          });
          break;
        case "use_ultimate":
          void resolveUltimateUse(
            {
              targetPlayerIndex: action.targetPlayerIndex,
              targetNodeId: action.targetNodeId,
              targetNodeId2: action.targetNodeId2,
              choiceId: action.choiceId,
              opponentChoices: action.opponentChoices,
              razeMode: action.razeMode,
              stealFromPlayerIndex: action.stealFromPlayerIndex,
            },
            { fromRemote: true }
          );
          break;
        case "event_choice":
          handleEventChoice({
            choiceId: action.choiceId,
            targetPlayerIndex: action.targetPlayerIndex,
            betAmount: action.betAmount,
          });
          break;
        case "finish_event":
          void finishEventStoryAndAdvance();
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

  /** Large full-body art for the next-turn banner only — keep separate from sidebar. */
  function getAgentTurnBannerImage(player: PlayerInGame) {
    const agent = getAgentData(player);
    if (!agent) return null;
    if (agent.fullPortrait) return agent.fullPortrait;
    if (agent.displayName) return agentPortraitPath(agent.displayName);
    return agent.displayIcon ?? null;
  }

  /** Lobby roster-style icon for inventory sidebar (same as AgentRoster tiles). */
  function getAgentRosterImage(player: PlayerInGame) {
    const agent = getAgentData(player);
    if (!agent) return null;
    return agent.displayIcon ?? null;
  }

  const rankedPlayers = rankPlayersByScore(playersInGame);
  const winner = rankedPlayers[0];
  const showTurnOrder = turnOrderRevealOpen && phase === "roll-for-order";

  useEffect(() => {
    setPendingInventoryItemId(null);
    setMobileInventoryOpen(false);
  }, [currentPlayerIndex]);

  const activeCanOpenDice =
    !gameFinished &&
    phase !== "roll-for-order" &&
    diceFlowPhase === "hidden" &&
    !hasRolledThisTurn &&
    canInteractWithDice();

  const activeDiceHint =
    !gameFinished &&
    phase !== "roll-for-order" &&
    diceFlowPhase === "ready"
      ? "Roll on screen"
      : !gameFinished &&
          phase !== "roll-for-order" &&
          diceFlowPhase === "result"
        ? "Move on screen"
        : activeCanOpenDice
          ? "Tap to roll"
          : null;

  const inventoryCanAct = canUseInventoryActions();

  function closeGameMenu() {
    setGameMenuOpen(false);
    setLeaveConfirmOpen(false);
  }

  function handleLeaveMatch() {
    closeGameMenu();
    if (multiplayer) {
      leaveMatch();
      onLeaveMatch?.();
      return;
    }
    const leaver = currentPlayer ?? playersInGame[0];
    if (leaver) {
      sendLocalSystemChat(`${leaver.name} left the game`);
    }
    onBackToLobby?.();
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#070b14] text-white">
      {gameMenuOpen && canOpenGameMenu && (
        <div
          id="in-game-menu"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="in-game-menu-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close game menu"
            onClick={closeGameMenu}
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0b1020]/98 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-400">
                  ValoRush
                </p>
                <h2 id="in-game-menu-title" className="mt-1 text-xl font-bold text-white">
                  Game menu
                </h2>
              </div>
              <button
                type="button"
                onClick={closeGameMenu}
                className="rounded-lg px-2 py-1 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                Esc
              </button>
            </div>

            <div className="border-b border-white/10 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Settings
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                More options will land here as they are ready.
              </p>

              <div className="mt-4 space-y-1">
                <button
                  type="button"
                  onClick={togglePerformanceMode}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-white transition hover:bg-white/5"
                >
                  <span>
                    <span className="font-medium">Performance mode</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Reduces animations and GPU load for streaming
                    </span>
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      performanceMode ? "text-emerald-300" : "text-zinc-400"
                    }`}
                  >
                    {performanceMode ? "On" : "Off"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleDebugMode}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-white transition hover:bg-white/5"
                >
                  <span>
                    <span className="font-medium">Debug mode</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Show the Debug button on the player card
                    </span>
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      debugMode ? "text-emerald-300" : "text-zinc-400"
                    }`}
                  >
                    {debugMode ? "On" : "Off"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={toggleChatGameEvents}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-white transition hover:bg-white/5"
                >
                  <span>
                    <span className="font-medium">Game events in chat</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {multiplayer && !multiplayer.isHost
                        ? "Host setting — you still see events the host posts"
                        : "Post wins, creds, and radianite to chat"}
                    </span>
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      chatGameEvents ? "text-emerald-300" : "text-zinc-400"
                    }`}
                  >
                    {chatGameEvents ? "On" : "Off"}
                  </span>
                </button>

                <div className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm text-zinc-500">
                  <span>
                    <span className="font-medium text-zinc-400">Sound</span>
                    <span className="mt-0.5 block text-xs">Audio mix and mute</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider">Soon</span>
                </div>

                <div className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm text-zinc-500">
                  <span>
                    <span className="font-medium text-zinc-400">Language</span>
                    <span className="mt-0.5 block text-xs">UI language</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider">Soon</span>
                </div>
              </div>
            </div>

            {canLeaveGame && (
              <div className="px-5 py-4">
                {!leaveConfirmOpen ? (
                  <button
                    type="button"
                    onClick={() => setLeaveConfirmOpen(true)}
                    className="flex w-full items-center justify-center rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 hover:text-red-100"
                  >
                    {multiplayer ? "Leave match" : "Leave game"}
                  </button>
                ) : (
                  <div className="rounded-xl border border-red-400/20 bg-red-950/40 p-4">
                    <p className="text-sm font-semibold text-red-100">
                      {multiplayer ? "Leave this match?" : "Leave this game?"}
                    </p>
                    <p className="mt-1 text-xs text-red-200/70">
                      {multiplayer
                        ? "You will return to the main menu and will not rejoin automatically."
                        : "Progress in this local game will not be saved."}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setLeaveConfirmOpen(false)}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleLeaveMatch}
                        className="flex-1 rounded-xl border border-red-400/30 bg-red-500/20 px-3 py-2.5 text-sm font-semibold text-red-100 transition hover:bg-red-500/30"
                      >
                        {multiplayer ? "Leave match" : "Leave game"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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

      {ultimateCast && (
        <UltimateCastPresentation
          cue={ultimateCast}
          onComplete={() =>
            setUltimateCast((current) =>
              current?.id === ultimateCast.id ? null : current
            )
          }
        />
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

      {customMatchPhase?.step === "format" && (
        <MatchFormatPresentation
          matchId={customMatchPhase.match.matchId}
          onComplete={handleFormatRevealComplete}
        />
      )}

      {customMatchPhase?.step === "reveal" && (
        <MapRevealPresentation
          matchId={customMatchPhase.match.matchId}
          mapId={customMatchPhase.match.mapId}
          onComplete={handleMapRevealComplete}
        />
      )}

      {customMatchPhase?.step === "lobby" && (
        <CustomMatchLobby
          match={customMatchPhase.match}
          players={playersInGame.map((player) => ({
            name: player.name,
            avatar: player.avatar,
          }))}
          isHost={!multiplayer || !!multiplayer.isHost}
          selectingWinner={!!customMatchPhase.selectingWinner}
          onStartMatch={handleStartCustomMatch}
          onMarkComplete={handleMarkCustomMatchComplete}
          onSelectWinner={(index) => void handleSelectCustomMatchWinner(index)}
          onSelectWinnerTeam={(team) => void handleSelectCustomMatchWinnerTeam(team)}
          onSelectWinnerSide={(side) => void handleSelectCustomMatchWinnerSide(side)}
          onCancelWinnerSelection={handleCancelWinnerSelection}
        />
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
                      {player.creds} Creds ·{" "}
                      {player.primaryWeapon ??
                        player.weapon ??
                        player.secondaryWeapon ??
                        "No weapon"}
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
          agentImage={getAgentTurnBannerImage(playersInGame[turnBannerPlayerIndex])}
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
      <div className="game-play-viewport">
        <div className="game-play-shell">
          {currentPlayer && (
            <aside className="game-inventory-sidebar">
              <PlayerInventorySidebar
                player={currentPlayer}
                agentName={getAgentName(currentPlayer)}
                agentBackgroundImage={getAgentBackgroundImage(currentPlayer)}
                agentPortraitImage={getAgentRosterImage(currentPlayer)}
                isCurrentTurn={!gameFinished && phase !== "roll-for-order"}
                canAct={inventoryCanAct}
                canOpenDice={activeCanOpenDice}
                diceHint={activeDiceHint}
                performanceMode={effectivePerformanceMode}
                pendingTargetItemId={pendingInventoryItemId}
                otherPlayers={inventoryOtherPlayers}
                plantedSpike={
                  activeSpike &&
                  activeSpike.plantedByPlayerIndex === currentPlayerIndex &&
                  (activeSpike.status === "planted" ||
                    activeSpike.status === "half-defused")
                    ? {
                        nodeId: activeSpike.plantedOnNodeId,
                        status: activeSpike.status,
                      }
                    : null
                }
                onOpenDice={openDiceOverlay}
                onUseItem={handleInventoryItemAction}
                onCancelTarget={() => setPendingInventoryItemId(null)}
                onActivateUltimate={openUltimateModal}
                onOpenMenu={openGameMenu}
                menuOpen={gameMenuOpen}
                chatWidget={
                  isDesktopInventory ? renderGameChatWidget() : undefined
                }
                showDebugButton={debugMode}
                debugOpen={debugOverlayOpen}
                onToggleDebug={toggleDebugOverlay}
              />
            </aside>
          )}

          <div className="game-play-main">
            <div className="game-player-strip">
              {orderedPlayerIndices.map((index) => {
                const player = playersInGame[index];
                if (!player) return null;

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

                const cardClassName = `relative flex h-36 flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition sm:h-40 sm:p-4 ${
                  isCurrent
                    ? "border-cyan-400/50 bg-cyan-400/10 shadow-[0_0_28px_rgba(34,211,238,0.12)] lg:hidden"
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

                    <div className="relative z-10 flex h-full flex-col justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 sm:h-16 sm:w-16">
                          {player.avatar ? (
                            <img
                              src={player.avatar}
                              alt={player.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-full w-full items-center justify-center text-xl font-bold text-white sm:text-2xl"
                              style={{
                                backgroundColor: player.color ?? "#334155",
                              }}
                            >
                              {(player.name.trim().charAt(0) || "?").toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-extrabold leading-tight text-white sm:text-xl">
                            {player.name}
                          </p>
                          <p className="truncate text-sm font-semibold text-zinc-300 sm:text-base">
                            {getAgentName(player)}
                          </p>
                          {canOpenDice && (
                            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                              Tap to roll
                            </p>
                          )}
                          {isDiceTurn && diceFlowPhase === "ready" && (
                            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                              Roll on screen
                            </p>
                          )}
                          {isDiceTurn && diceFlowPhase === "result" && (
                            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                              Move on screen
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <img
                              src="/points/Credits_icon.png"
                              alt="Credits"
                              className="h-5 w-5 object-contain"
                            />
                            <span className="flex h-6 items-center text-xl font-bold leading-none text-white">
                              <AnimatedNumber value={player.creds} />
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <img
                              src="/points/Radianite_Points.png"
                              alt="Radianite"
                              className="h-6 w-6 object-contain"
                            />
                            <span className="flex h-6 items-center text-xl font-bold leading-none text-cyan-300">
                              <AnimatedNumber value={player.radianitePoints} />
                            </span>
                          </div>
                        </div>
                        <UltimateMeter
                          orbs={player.ultimateOrbs ?? 0}
                          agentName={getAgentName(player)}
                          compact
                          showReadyLabel
                        />
                      </div>
                    </div>
                  </>
                );

                if (isCurrent) {
                  return (
                    <div
                      key={player.id}
                      className={`${cardClassName} flex flex-col gap-1.5`}
                    >
                      {canOpenDice ? (
                        <button
                          type="button"
                          onClick={openDiceOverlay}
                          className="relative min-h-0 flex-1 overflow-hidden rounded-xl text-left"
                        >
                          {cardBody}
                        </button>
                      ) : (
                        <div className="relative min-h-0 flex-1 overflow-hidden">
                          {cardBody}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={player.id} className={cardClassName}>
                    {cardBody}
                  </div>
                );
              })}
            </div>

            {currentPlayer && (
              <div className="game-inventory-mobile-bar">
                <div className="game-inventory-mobile-bar__meta">
                  <p>{currentPlayer.name}</p>
                  <p>
                    {getAgentName(currentPlayer)}
                    {currentPlayer.primaryWeapon || currentPlayer.secondaryWeapon
                      ? ` · ${[
                          currentPlayer.primaryWeapon,
                          currentPlayer.secondaryWeapon,
                        ]
                          .filter(Boolean)
                          .join(" / ")}`
                      : " · No weapon"}
                  </p>
                </div>
                <div className="game-inventory-mobile-bar__actions">
                  {!isDesktopInventory &&
                    !mobileInventoryOpen &&
                    renderGameChatWidget()}
                  <button
                    type="button"
                    className="game-inventory-mobile-bar__menu-btn"
                    onClick={openGameMenu}
                    aria-label="Game menu"
                    aria-expanded={gameMenuOpen}
                    aria-controls="in-game-menu"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-5 w-5"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="game-inventory-mobile-bar__btn"
                    onClick={() => setMobileInventoryOpen(true)}
                  >
                    Loadout
                  </button>
                </div>
              </div>
            )}

            <div className="game-board-area">
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
                onEdgeClick={handleUltimateEdgeClick}
                onPlayerTokenClick={handleUltimatePlayerTarget}
                debugClickable={debugMode && debugBoardAction !== null}
                selectableNodeIds={
                  ultimateTargeting
                    ? getSelectableTileIdsForUltimate(ultimateTargeting.targetKind, {
                        opponentPositions: playersInGame
                          .filter((_, index) => index !== currentPlayerIndex)
                          .map((p) => p.position),
                        paths: ULTIMATE_BOARD_PATHS,
                      })
                    : pendingPathChoice?.options ?? []
                }
                selectableEdges={
                  ultimateTargeting
                    ? getSelectableEdgesForUltimate(ultimateTargeting.targetKind)
                    : []
                }
                selectablePlayerIndices={
                  ultimateTargeting &&
                  (ultimateTargeting.targetKind === "player" ||
                    ultimateTargeting.targetKind === "player_or_choice")
                    ? playersInGame
                        .map((_, index) => index)
                        .filter((index) => index !== currentPlayerIndex)
                    : []
                }
                dimNonSelectable={ultimateTargeting != null}
                targetingBanner={
                  ultimateTargeting
                    ? {
                        title: getUltimateTargetingPrompt(
                          ultimateTargeting.ultimateName,
                          ultimateTargeting.targetKind
                        ),
                        subtitle: getUltimateTargetingSubtitle(
                          ultimateTargeting.targetKind
                        ),
                        onCancel: cancelUltimateTargeting,
                      }
                    : null
                }
                pathChoiceHint={
                  !ultimateTargeting && pendingPathChoice
                    ? `${playersInGame[pendingPathChoice.playerIndex]?.name ?? "Player"} — choose your route, click a highlighted tile`
                    : null
                }
                spikePlantAnimation={spikePlantAnimation}
                onSpikePlantAnimationComplete={handleSpikePlantAnimationComplete}
                castFx={
                  ultimateCast
                    ? {
                        theme: ultimateCast.theme,
                        nodeIds: ultimateCast.highlightNodeIds,
                        playerIndices: ultimateCast.highlightPlayerIndices,
                      }
                    : null
                }
                hazards={{
                  poisonClouds: boardUltimateState.poisonClouds,
                  walls: boardUltimateState.walls,
                  traps: boardUltimateState.traps,
                }}
              />
            </div>
          </div>
        </div>

        {mobileInventoryOpen && currentPlayer && (
          <div
            className="game-inventory-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Player loadout"
            onClick={() => setMobileInventoryOpen(false)}
          >
            <div
              className="game-inventory-sheet__panel"
              onClick={(event) => event.stopPropagation()}
            >
              <PlayerInventorySidebar
                player={currentPlayer}
                agentName={getAgentName(currentPlayer)}
                agentBackgroundImage={getAgentBackgroundImage(currentPlayer)}
                agentPortraitImage={getAgentRosterImage(currentPlayer)}
                isCurrentTurn={!gameFinished && phase !== "roll-for-order"}
                canAct={inventoryCanAct}
                canOpenDice={activeCanOpenDice}
                diceHint={activeDiceHint}
                performanceMode={effectivePerformanceMode}
                pendingTargetItemId={pendingInventoryItemId}
                otherPlayers={inventoryOtherPlayers}
                plantedSpike={
                  activeSpike &&
                  activeSpike.plantedByPlayerIndex === currentPlayerIndex &&
                  (activeSpike.status === "planted" ||
                    activeSpike.status === "half-defused")
                    ? {
                        nodeId: activeSpike.plantedOnNodeId,
                        status: activeSpike.status,
                      }
                    : null
                }
                onOpenDice={() => {
                  setMobileInventoryOpen(false);
                  openDiceOverlay();
                }}
                onUseItem={handleInventoryItemAction}
                onCancelTarget={() => setPendingInventoryItemId(null)}
                onActivateUltimate={openUltimateModal}
                onClose={() => setMobileInventoryOpen(false)}
                onOpenMenu={openGameMenu}
                menuOpen={gameMenuOpen}
                chatWidget={
                  !isDesktopInventory ? renderGameChatWidget() : undefined
                }
                showDebugButton={debugMode}
                debugOpen={debugOverlayOpen}
                onToggleDebug={toggleDebugOverlay}
              />
            </div>
          </div>
        )}
      </div>
      )}
      {(() => {
        const agentName = currentPlayer ? getAgentName(currentPlayer) : "";
        const ultDef = getUltimateForAgent(agentName);
        if (!ultDef) return null;
        const razePlayer =
          razeTargetPlayerIndex != null
            ? {
                index: razeTargetPlayerIndex,
                name: playersInGame[razeTargetPlayerIndex]?.name ?? "Player",
                creds: playersInGame[razeTargetPlayerIndex]?.creds ?? 0,
                items: playersInGame[razeTargetPlayerIndex]?.items ?? [],
                ultimateOrbs: playersInGame[razeTargetPlayerIndex]?.ultimateOrbs ?? 0,
              }
            : null;
        return (
          <UltimateTargetModal
            open={ultimateModalOpen}
            ultimate={ultDef}
            casterName={currentPlayer?.name ?? "Player"}
            otherPlayers={playersInGame
              .map((p, index) => ({
                index,
                name: p.name,
                creds: p.creds,
                items: p.items ?? [],
                ultimateOrbs: p.ultimateOrbs ?? 0,
              }))
              .filter((p) => p.index !== currentPlayerIndex)}
            razeTargetPlayer={razePlayer}
            onConfirm={(selection) => void resolveUltimateUse(selection)}
            onCancel={cancelUltimateTargeting}
          />
        );
      })()}

      {phoenixChoiceOpen && (
        <div className="fixed inset-0 z-[86] flex animate-fadeIn items-center justify-center bg-black/60 p-4">
          <div className="ultimate-modal">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
              Run It Back
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">Keep or rewind?</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Stay at your end position or return to where this turn started.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="ultimate-modal__btn ultimate-modal__btn--primary"
                onClick={() => void resolvePhoenixChoice(true)}
              >
                Keep end position
              </button>
              <button
                type="button"
                className="ultimate-modal__btn"
                onClick={() => void resolvePhoenixChoice(false)}
              >
                Return to turn start
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingOmenMiniMove && (
        <div className="fixed inset-0 z-[86] flex animate-fadeIn items-center justify-center bg-black/60 p-4">
          <div className="ultimate-modal">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-purple-300">
              From The Shadows
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">Mini-move</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Take up to {pendingOmenMiniMove.steps} more spaces (or stay put).
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {Array.from(
                { length: pendingOmenMiniMove.steps + 1 },
                (_, steps) => (
                  <button
                    key={steps}
                    type="button"
                    className="ultimate-modal__btn ultimate-modal__btn--primary"
                    onClick={() => void resolveOmenMiniMove(steps)}
                  >
                    {steps === 0
                      ? "Stay"
                      : `${steps} space${steps === 1 ? "" : "s"}`}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {debugMode && debugOverlayOpen && (
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
          eventPipelineBusy={isEventPipelineBusy()}
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
          onAdjustUltimateOrbs={(amount) =>
            debugAdjustUltimateOrbs(debugSelectedPlayerIndex, amount)
          }
          onSetUltimateOrbs={(orbs) =>
            debugSetUltimateOrbs(debugSelectedPlayerIndex, orbs)
          }
          onGiveItem={debugGiveItem}
          onTriggerMinigame={debugTriggerMinigameById}
          onLandOnTile={debugLandOnTile}
          onTriggerShop={debugTriggerShop}
          logs={debugLogs}
          onClearLogs={() => setDebugLogs([])}
        />
      )}
    </div >
  );
}