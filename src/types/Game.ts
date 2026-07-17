import type { Player } from "./Player";

export type WeaponName =
  | "Classic"
  | "Shorty"
  | "Frenzy"
  | "Ghost"
  | "Sheriff"
  | "Stinger"
  | "Spectre"
  | "Bulldog"
  | "Guardian"
  | "Phantom"
  | "Vandal"
  | "Marshal"
  | "Operator"
  | "Ares"
  | "Odin";

export type ShieldName = "Light Shields" | "Regen Shield" | "Heavy Shields";

export type PlayerInGame = Player & {
  position: string;
  creds: number;
  radianitePoints: number;
  /** Primary (rifles, SMGs, snipers, etc.). */
  primaryWeapon: string | null;
  /** Secondary / sidearm. */
  secondaryWeapon: string | null;
  /**
   * Legacy single-weapon field. Migrated to primaryWeapon when present.
   * @deprecated Prefer primaryWeapon / secondaryWeapon.
   */
  weapon?: string | null;
  shield: ShieldName | null;
  nextWeaponDiscount: number;
  items: string[];
  movementBonus: number;
  /** Turns remaining for multi-turn bonuses. 0 = one-shot (cleared after next roll). */
  movementBonusTurns: number;
  maxStepsPerTurn: number | null;
  maxStepsTurns: number;
};

export type TurnPhase =
  | "roll-for-order"
  | "playing"
  | "resolving-event"
  | "turn-end"
  | "game-over";

export type TurnOrderRoll = {
  playerIndex: number;
  roll: number;
};

export type FlatEventEffect =
  | { type: "creds"; amount: number }
  | { type: "radianite"; amount: number }
  | { type: "discount"; amount: number };

export type GambleBranch = {
  effect: FlatEventEffect;
  mood: StoryEventMood;
  headline: string;
  speech: string;
  description: string;
};

export type GambleEffect = {
  type: "gamble";
  winChance: number;
  win: GambleBranch;
  lose: GambleBranch;
};

export type EventEffect = FlatEventEffect | GambleEffect;

/** Rolled at trigger time for gamble (and display) events. */
export type GameEventOutcome = {
  effect: FlatEventEffect;
  mood: StoryEventMood;
  headline: string;
  description: string;
  dialogueText: string;
  gambleResult?: "win" | "lose";
};

export type EventPresentation = "agent" | "briefing";

export type StoryEventMood = "positive" | "negative" | "neutral" | "mysterious";

export type StoryDialogueLine = {
  speaker: string;
  text: string;
};

/** Narrative layer for event tiles — inspired by Valorant agent lore & relationships. */
export type GameEventStory = {
  headline: string;
  /** Story beats shown in the modal (2–4 short paragraphs). */
  paragraphs: string[];
  narrator: string;
  narratorRole?: string;
  /** agent = NPC pop-out; briefing = map-only comms panel (no body model). */
  presentation?: EventPresentation;
  /** Large character art (npc preferred, portrait fallback). */
  characterImage?: string;
  /** Map loading art — used for all events to distinguish from shop agent backgrounds. */
  backgroundImage?: string;
  /** Small icon — ability, map, points, etc. */
  accentImage?: string;
  mood: StoryEventMood;
  /** Lore tag shown as chip, e.g. "Protocol", "Rivalry". */
  tag?: string;
  /** Agents this event resonates with (better match when they trigger it). */
  relatedAgents?: string[];
  /** Spoken lines shown as dialogue cards (narrator voice). */
  dialogues?: StoryDialogueLine[];
};

export type GameEvent = {
  id: string;
  title: string;
  description: string;
  effect: EventEffect;
  story: GameEventStory;
  /** Filled when the event triggers (gamble roll, display copy). */
  outcome?: GameEventOutcome;
};