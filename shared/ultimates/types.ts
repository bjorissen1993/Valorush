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
  | "sequential_opponents";

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
  /** Max mini-move steps after teleport (Omen). */
  miniMoveSteps?: number;
  /** Approximate tile range for KAY/O NULL/CMD. */
  rangeTiles?: number;
  implementation: UltimateImplementation;
  /** Ability icon under /abilities when available. */
  icon?: string;
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
  };
}

/** Board-level ultimate hazards (separate from director Cosmic Divide event). */
export type PoisonCloud = {
  nodeId: string;
  roundsLeft: number;
  ownerPlayerIndex: number;
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
};

export function createEmptyBoardUltimateState(): BoardUltimateState {
  return {
    poisonClouds: [],
    walls: [],
    traps: [],
    detainZones: [],
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
  /** Omen: after teleport, allow mini-move up to N. */
  omenMiniMoveSteps?: number;
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
  /** Chamber duel outcome. */
  chamberDuel?: {
    casterRoll: number;
    targetRoll: number;
    winnerPlayerIndex: number;
  };
  /** Phoenix: wait for post-turn choice. */
  awaitPhoenixChoice?: boolean;
  stub?: boolean;
};
