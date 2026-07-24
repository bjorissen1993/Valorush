/** Ultimate Orb System — shared types & effect descriptors. */

export const MAX_ULTIMATE_ORBS = 3;

export type UltimateTargetKind =
  | "none"
  | "tile"
  | "player"
  | "path"
  | "edge"
  | "choice"
  | "tile_and_move"
  | "player_or_choice"
  | "sequential_opponents"
  | "area"
  | "multi_shot"
  | "match_config"
  | "reactive";

export type UltimateChoiceOption = {
  id: string;
  label: string;
  description?: string;
};

export type UltimateImplementation = "full" | "stub";

export type UltimateDefinition = {
  agentName: string;
  id: string;
  name: string;
  description: string;
  targetKind: UltimateTargetKind;
  choices?: UltimateChoiceOption[];
  /** Max mini-move steps after teleport (legacy Omen). */
  miniMoveSteps?: number;
  /** Approximate tile range for KAY/O NULL/CMD. */
  rangeTiles?: number;
  /** Area radius in layout units (Brimstone / Viper / Killjoy). */
  areaRadius?: number;
  /** Placement radius around caster (Viper / Killjoy). */
  placementRadius?: number;
  /** Configurable credit loss for area strikes. */
  creditDamage?: number;
  implementation: UltimateImplementation;
  /** Ability icon under /abilities when available. */
  icon?: string;
};

/** Status effect keyed by activation so debuffs apply once per ultimate cast. */
export type StatusEffectInstance = {
  activationId: string;
  kind: "movement_debuff" | "revealed" | "slow_zone";
  /** Movement delta (negative = slower). */
  amount?: number;
  roundsLeft: number;
};

/** Per-player status / buffs applied by ultimates. */
export type PlayerUltimateStatus = {
  /** Reyna Empress: remaining rounds of double minigame rewards / ignore penalties. */
  reynaBuffRounds: number;
  /** Yoru Dimensional Drift: remaining rounds untargetable / ignore neg / through walls. */
  yoruDriftRounds: number;
  /** Clove: next negative effect ignored once. */
  cloveShield: boolean;
  /** Breach Rolling Thunder: −1 effective movement next turn. */
  movementPenalty: number;
  movementPenaltyTurns: number;
  /** Neon Overdrive: next movement doubled. */
  neonOverdrive: boolean;
  /** Phoenix Run It Back armed — resolve after turn. */
  phoenixRunItBack: boolean;
  /** Position at start of turn (Phoenix restore). */
  turnStartPosition: string | null;
  /** KAY/O: cannot use inventory items this turn. */
  itemsLockedTurns: number;
  /** Killjoy / skip: miss the next turn. */
  skipNextTurn: boolean;
  /** Sage Resurrection: take another turn after the current one ends. */
  extraTurnPending: boolean;
  /** Half movement while standing in Viper's Pit (computed each roll; flag for UI). */
  inViperPit: boolean;
  /** Phoenix/Sage reactive: prompt before applying a negative effect. */
  reactiveUltArmed: boolean;
  reactiveUltAgent: "Phoenix" | "Sage" | null;
  /** Snapshot for full rollback when reactive ult confirms. */
  reactiveSnapshot: ReactivePlayerSnapshot | null;
  /** Revealed status (Sova) — rounds left. */
  revealedRounds: number;
  /** Activation-scoped status effects. */
  statusEffects: StatusEffectInstance[];
  /** ActivationIds already applied for movement debuffs (once per cast). */
  appliedActivationIds: string[];
};

export type ReactivePlayerSnapshot = {
  position: string;
  creds: number;
  radianitePoints: number;
  items: string[];
  ultimateOrbs: number;
  status: PlayerUltimateStatus;
};

export function createEmptyPlayerUltimateStatus(): PlayerUltimateStatus {
  return {
    reynaBuffRounds: 0,
    yoruDriftRounds: 0,
    cloveShield: false,
    movementPenalty: 0,
    movementPenaltyTurns: 0,
    neonOverdrive: false,
    phoenixRunItBack: false,
    turnStartPosition: null,
    itemsLockedTurns: 0,
    skipNextTurn: false,
    extraTurnPending: false,
    inViperPit: false,
    reactiveUltArmed: false,
    reactiveUltAgent: null,
    reactiveSnapshot: null,
    revealedRounds: 0,
    statusEffects: [],
    appliedActivationIds: [],
  };
}

/** Board-level ultimate hazards (separate from director Cosmic Divide event). */
export type PoisonCloud = {
  nodeId: string;
  /** All tiles in the poison zone. */
  nodeIds?: string[];
  roundsLeft: number;
  ownerPlayerIndex: number;
  activationId: string;
  /** Movement debuff applied once per activationId when entering. */
  movementDebuff: number;
};

/** Killjoy Lockdown device — detonates at start of KJ's next turn. */
export type KilljoyDevice = {
  centerNodeId: string;
  nodeIds: string[];
  ownerPlayerIndex: number;
  activationId: string;
  /** Detonate when this player's turn starts (same as owner). */
  detonateOnOwnerTurn: boolean;
  armed: boolean;
};

/** Chamber slow zone on a tile. */
export type SlowZone = {
  nodeId: string;
  roundsLeft: number;
  ownerPlayerIndex: number;
  activationId: string;
  movementDebuff: number;
};

/** Astra ultimate wall — blocks passage between two connected nodes. */
export type UltimateWall = {
  fromNodeId: string;
  toNodeId: string;
  roundsLeft: number;
  ownerPlayerIndex: number;
};

export type UltimateTrap = {
  nodeId: string;
  ownerPlayerIndex: number;
  /** Consumed on first trigger. */
  armed: boolean;
};

/** Gekko Thrash — first opponent to enter is detained (skip next turn). */
export type DetainZone = {
  nodeId: string;
  ownerPlayerIndex: number;
  armed: boolean;
};

export type BoardUltimateState = {
  poisonClouds: PoisonCloud[];
  walls: UltimateWall[];
  traps: UltimateTrap[];
  detainZones: DetainZone[];
  killjoyDevices: KilljoyDevice[];
  slowZones: SlowZone[];
};

export function createEmptyBoardUltimateState(): BoardUltimateState {
  return {
    poisonClouds: [],
    walls: [],
    traps: [],
    detainZones: [],
    killjoyDevices: [],
    slowZones: [],
  };
}

export type UltimatePathOption = {
  id: string;
  label: string;
  nodeIds: string[];
};

export type UltimateApplyInput = {
  casterPlayerIndex: number;
  agentName: string;
  players: UltimatePlayerState[];
  board: BoardUltimateState;
  boardNodeIds: string[];
  /** Adjacent map: nodeId → neighbor ids. */
  adjacency: Record<string, string[]>;
  /** Named paths for Sova / row hits. */
  paths: UltimatePathOption[];
  currentRound: number;
  targetPlayerIndex?: number;
  targetNodeId?: string;
  /** Second node for edge walls / Omen mini-move destination. */
  targetNodeId2?: string;
  /** Area ultimate: all node ids inside the circle. */
  areaNodeIds?: string[];
  choiceId?: string;
  /** Killjoy: map of opponentIndex → "pay" | "skip". */
  opponentChoices?: Record<number, "pay" | "skip">;
  /** Raze: "creds" | "spaces". */
  razeMode?: "creds" | "spaces";
  /** Cypher: steal from this player after reveal. */
  stealFromPlayerIndex?: number;
  /** Dice rolls for Jett / Chamber. */
  diceRolls?: number[];
  /** Nodes the caster passed during Blade Storm movement (filled by GamePage). */
  passedOpponentIndices?: number[];
  /** Unique id for this cast (status effect once-per-activation). */
  activationId?: string;
  /** Cypher match configurator payload. */
  cypherMatchConfig?: CypherMatchConfig;
  /** Chamber loot wheel segment id. */
  chamberLootId?: string;
  /** Sova multi-shot: remaining shots after this one. */
  sovaShotsRemaining?: number;
};

export type CypherMatchConfig = {
  matchup: string;
  teams: string;
  mode: string;
  weapons: string;
  agents: string;
  modifiers: string[];
};

export type UltimatePlayerState = {
  id: number;
  slotIndex: number;
  name: string;
  selectedAgentId?: string;
  position: string;
  creds: number;
  radianitePoints: number;
  items: string[];
  ultimateOrbs: number;
  status: PlayerUltimateStatus;
  movementBonus: number;
  movementBonusTurns: number;
  maxStepsPerTurn: number | null;
  maxStepsTurns: number;
};

export type PositionChange = {
  playerIndex: number;
  fromNodeId: string;
  toNodeId: string;
};

export type UltimateApplyResult = {
  players: UltimatePlayerState[];
  board: BoardUltimateState;
  headline: string;
  description: string;
  positionChanges: PositionChange[];
  /** True when required targeting/choice was missing — orbs not spent. */
  incomplete?: boolean;
  /** Jett: start special movement with this step count. */
  jettMoveSteps?: number;
  /** Omen: after teleport, allow mini-move up to N. (legacy — new Omen ends turn). */
  omenMiniMoveSteps?: number;
  /** Omen: end turn immediately after teleport (no land activate). */
  endTurnImmediately?: boolean;
  /** Skip landing activation for position changes. */
  skipLandingActivation?: boolean;
  /** Cypher reveal payload for UI. */
  cypherReveal?: {
    players: {
      playerIndex: number;
      name: string;
      creds: number;
      items: string[];
      ultimateOrbs: number;
    }[];
  };
  /** Cypher match config for next custom match only. */
  cypherMatchConfig?: CypherMatchConfig;
  /** Chamber duel outcome. */
  chamberDuel?: {
    casterRoll: number;
    targetRoll: number;
    winnerPlayerIndex: number;
  };
  /** Chamber loot wheel result. */
  chamberLoot?: {
    segmentId: string;
    label: string;
    credsStolen: number;
    radianiteStolen: number;
    intendedCreds: number;
    intendedRadianite: number;
    targetPlayerIndex: number;
    targetName: string;
    segments: { id: string; label: string; weight: number }[];
  };
  /** Phoenix: wait for post-turn choice. */
  awaitPhoenixChoice?: boolean;
  /** Open reactive ultimate prompt for a pending negative. */
  awaitReactivePrompt?: {
    playerIndex: number;
    agent: "Phoenix" | "Sage";
  };
  /** Sova: continue aiming (shots remaining). */
  sovaShotsRemaining?: number;
  stub?: boolean;
};
