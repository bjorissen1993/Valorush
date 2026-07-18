/** Board event system — extensible registry with player choices. */

import type { EventWeight } from "../director/types";
import type { PlayerUltimateStatus } from "../ultimates";

export type EventCategory =
  | "teleport"
  | "movement"
  | "economy"
  | "player_interaction"
  | "custom_match"
  | "map_event";

export type StoryEventMood = "positive" | "negative" | "neutral" | "mysterious";

export type EventStorySpec = {
  headline: string;
  paragraphs: string[];
  narrator: string;
  narratorRole?: string;
  presentation?: "agent" | "briefing";
  backgroundImage?: string;
  accentImage?: string;
  mood: StoryEventMood;
  tag?: string;
  relatedAgents?: string[];
};

export type EventChoiceOption = {
  id: string;
  label: string;
  description?: string;
};

export type EventChoiceSpec =
  | { kind: "fixed"; options: EventChoiceOption[] }
  | { kind: "pick_player"; excludeSelf?: boolean; label?: string }
  | { kind: "bet_creds"; presets: number[]; label?: string };

export type FlatEventEffect =
  | { type: "creds"; amount: number }
  | { type: "radianite"; amount: number }
  | { type: "discount"; amount: number };

export type ScheduledCustomMatchPayload = {
  matchId: string;
  mapId: string;
  announcedRound: number;
};

export type PlayerBoardState = {
  id: number;
  slotIndex: number;
  name: string;
  position: string;
  creds: number;
  radianitePoints: number;
  primaryWeapon: string | null;
  secondaryWeapon: string | null;
  /** @deprecated Migrated to primaryWeapon. */
  weapon?: string | null;
  shield: string | null;
  nextWeaponDiscount: number;
  items: string[];
  movementBonus: number;
  movementBonusTurns: number;
  maxStepsPerTurn: number | null;
  maxStepsTurns: number;
  ultimateOrbs?: number;
  ultimateStatus?: PlayerUltimateStatus;
};

export type EventApplyContext = {
  triggerPlayerIndex: number;
  players: PlayerBoardState[];
  choiceId?: string;
  betAmount?: number;
  targetPlayerIndex?: number;
  /** Board node ids in traversal order — used for push-back / teleport. */
  boardNodeIds?: string[];
  currentRound?: number;
};

export type EventApplyResult = {
  players: PlayerBoardState[];
  outcomeDescription: string;
  outcomeHeadline: string;
  outcomeMood: StoryEventMood;
  flatEffect?: FlatEventEffect;
  scheduleCustomMatch?: ScheduledCustomMatchPayload;
};

export type BoardEventDefinition = {
  id: string;
  name: string;
  description: string;
  category: EventCategory;
  sourceAgent?: string;
  sourceKingdom?: string;
  weight: EventWeight;
  story: EventStorySpec;
  playerChoices?: EventChoiceSpec;
  applyEffect: (ctx: EventApplyContext) => EventApplyResult;
};
