/** Director System — personality-first event narration (Agent + Kingdom). */

export type EventWeight = "common" | "rare" | "epic" | "legendary";

export type DirectorMode = "agent" | "kingdom";

/** Maps an agent to events they are allowed to "direct" — never random combos. */
export type AgentEventBinding = {
  eventId: string;
  weight: EventWeight;
  /** Short lore tag shown in debug / future UI chips. */
  theme?: string;
};

export type AgentDirectorDefinition = {
  /** Stable key — agent display name (e.g. "Brimstone"). */
  agentId: string;
  agentName: string;
  role: string;
  /** Voice-line shown on the director intro card. */
  quote: string;
  personality: string;
  events: AgentEventBinding[];
};

export type KingdomProtocolDefinition = {
  id: string;
  name: string;
  subtitle: string;
  /** Emergency comms line read during protocol activation. */
  quote: string;
  weight: EventWeight;
  /** Kingdom protocol designation shown on UI (e.g. KNG-7741). */
  protocolCode: string;
  /** Existing event pool IDs this protocol may trigger. */
  eventIds: string[];
};

/** Serializable director intro payload — safe for online sync. */
export type DirectorPickPayload = {
  mode: DirectorMode;
  weight: EventWeight;
  quote: string;
  /** Agent director fields */
  agentName?: string;
  agentRole?: string;
  /** Kingdom director fields */
  protocolId?: string;
  protocolName?: string;
  protocolSubtitle?: string;
  protocolCode?: string;
};

export const WEIGHT_NUMERIC: Record<EventWeight, number> = {
  common: 60,
  rare: 25,
  epic: 12,
  legendary: 3,
};

export const WEIGHT_PRESENTATION_MS: Record<EventWeight, number> = {
  common: 2200,
  rare: 2800,
  epic: 3400,
  legendary: 4200,
};

/** Chance (0–1) that a tile event is narrated by Kingdom instead of an Agent. */
export const KINGDOM_DIRECTOR_CHANCE = 0.14;
