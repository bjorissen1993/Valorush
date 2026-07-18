import type { GameEvent } from "../../types/Game";
import type { NarrativeContext } from "../narrativeSystem";
import { personalizeEventStory } from "../narrativeSystem";
import { resolveEventOutcome } from "../eventResolution";
import { getRelationship, getRivals, getSupporters } from "../agentRelationships";
import {
  agentDirectorRegistry,
  kingdomProtocolRegistry,
  KINGDOM_DIRECTOR_CHANCE,
  WEIGHT_NUMERIC,
  WEIGHT_PRESENTATION_MS,
  type AgentDirectorDefinition,
  type AgentEventBinding,
  type DirectorPickPayload,
  type EventWeight,
} from "../../../shared/director";
import { boardEventById } from "../../../shared/events";
import { isEventEligibleAgent } from "../../../shared/availableAgents";

export type DirectorPickResult = DirectorPickPayload & {
  event: GameEvent;
  /** Milliseconds to show the director intro before the event modal. */
  introDurationMs: number;
};

function pickWeighted<T extends { weight: EventWeight }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + WEIGHT_NUMERIC[item.weight], 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= WEIGHT_NUMERIC[item.weight];
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function pickWeightedEventBinding(bindings: AgentEventBinding[]): AgentEventBinding {
  return pickWeighted(bindings);
}

function scoreAgentDirector(
  director: AgentDirectorDefinition,
  context: NarrativeContext,
  availableEventIds: Set<string>
): number {
  const eligible = director.events.filter((binding) =>
    availableEventIds.has(binding.eventId)
  );
  if (eligible.length === 0) return -1;

  const { triggerAgentName } = context;
  let score = 1;
  const rel = getRelationship(triggerAgentName, director.agentName);
  if (rel === "ally" || rel === "mentor") score += 4;
  if (rel === "rival") score += 2;

  if (director.agentName === triggerAgentName) {
    score += 6;
  }

  if (getRivals(triggerAgentName).includes(director.agentName)) {
    score += 2;
  }

  if (getSupporters(triggerAgentName).includes(director.agentName)) {
    score += 3;
  }

  score += Math.random() * 1.5;
  return score;
}

function buildEventById(pool: GameEvent[]): Map<string, GameEvent> {
  return new Map(pool.map((event) => [event.id, event]));
}

function resolveDirectorEvent(
  event: GameEvent,
  context: NarrativeContext
): GameEvent {
  return resolveEventOutcome(personalizeEventStory(event, context));
}

function pickAgentDirector(
  pool: GameEvent[],
  context: NarrativeContext
): DirectorPickResult | null {
  const eventById = buildEventById(pool);
  const availableEventIds = new Set(pool.map((event) => event.id));

  const scored = agentDirectorRegistry
    .map((director) => ({
      director,
      score: scoreAgentDirector(director, context, availableEventIds),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const topScore = scored[0].score;
  const topTier = scored.filter((entry) => entry.score >= topScore - 1.5);
  const chosenDirector =
    topTier[Math.floor(Math.random() * topTier.length)].director;

  const eligibleBindings = chosenDirector.events.filter((binding) =>
    availableEventIds.has(binding.eventId)
  );
  if (eligibleBindings.length === 0) return null;

  const binding = pickWeightedEventBinding(eligibleBindings);
  const baseEvent = eventById.get(binding.eventId);
  if (!baseEvent) return null;

  return {
    mode: "agent",
    weight: binding.weight,
    quote: chosenDirector.quote,
    agentName: chosenDirector.agentName,
    agentRole: chosenDirector.role,
    event: resolveDirectorEvent(baseEvent, context),
    introDurationMs: WEIGHT_PRESENTATION_MS[binding.weight],
  };
}

function pickKingdomDirector(
  pool: GameEvent[],
  context: NarrativeContext
): DirectorPickResult | null {
  const eventById = buildEventById(pool);
  const availableEventIds = new Set(pool.map((event) => event.id));

  const eligibleProtocols = kingdomProtocolRegistry.filter((protocol) =>
    protocol.eventIds.some((id) => availableEventIds.has(id))
  );
  if (eligibleProtocols.length === 0) return null;

  const protocol = pickWeighted(eligibleProtocols);
  const eligibleEventIds = protocol.eventIds.filter((id) =>
    availableEventIds.has(id)
  );
  if (eligibleEventIds.length === 0) return null;

  const eventId =
    eligibleEventIds[Math.floor(Math.random() * eligibleEventIds.length)];
  const baseEvent = eventById.get(eventId);
  if (!baseEvent) return null;

  return {
    mode: "kingdom",
    weight: protocol.weight,
    quote: protocol.quote,
    protocolId: protocol.id,
    protocolName: protocol.name,
    protocolSubtitle: protocol.subtitle,
    protocolCode: protocol.protocolCode,
    event: resolveDirectorEvent(baseEvent, context),
    introDurationMs: WEIGHT_PRESENTATION_MS[protocol.weight],
  };
}

/**
 * Build a director intro for one exact board event id — used by debug and forced triggers.
 * Matches production director presentation without re-rolling the event pool.
 */
function buildAgentDirectorPick(
  director: AgentDirectorDefinition,
  baseEvent: GameEvent,
  context: NarrativeContext,
  weight: EventWeight,
  quote?: string
): DirectorPickResult {
  return {
    mode: "agent",
    weight,
    quote: quote ?? director.quote,
    agentName: director.agentName,
    agentRole: director.role,
    event: resolveDirectorEvent(baseEvent, context),
    introDurationMs: WEIGHT_PRESENTATION_MS[weight],
  };
}

export function buildDirectorPickForEventId(
  pool: GameEvent[],
  eventId: string,
  context: NarrativeContext
): DirectorPickResult {
  const baseEvent = buildEventById(pool).get(eventId);
  if (!baseEvent) {
    throw new Error(`Unknown board event: ${eventId}`);
  }

  const definition = boardEventById.get(eventId);
  const preferredAgent =
    definition?.sourceAgent ??
    (isEventEligibleAgent(definition?.story.narrator ?? "")
      ? definition?.story.narrator
      : undefined);

  // Prefer the event's source/narrator agent so Cosmic Divide always shows Astra, etc.
  if (preferredAgent && !definition?.sourceKingdom) {
    const preferredDirector = agentDirectorRegistry.find(
      (entry) =>
        entry.agentId === preferredAgent || entry.agentName === preferredAgent
    );
    if (preferredDirector) {
      const binding = preferredDirector.events.find(
        (entry) => entry.eventId === eventId
      );
      return buildAgentDirectorPick(
        preferredDirector,
        baseEvent,
        context,
        binding?.weight ?? definition?.weight ?? "common"
      );
    }
  }

  for (const director of agentDirectorRegistry) {
    const binding = director.events.find((entry) => entry.eventId === eventId);
    if (binding) {
      return buildAgentDirectorPick(
        director,
        baseEvent,
        context,
        binding.weight
      );
    }
  }

  for (const protocol of kingdomProtocolRegistry) {
    if (!protocol.eventIds.includes(eventId)) continue;
    return {
      mode: "kingdom",
      weight: protocol.weight,
      quote: protocol.quote,
      protocolId: protocol.id,
      protocolName: protocol.name,
      protocolSubtitle: protocol.subtitle,
      protocolCode: protocol.protocolCode,
      event: resolveDirectorEvent(baseEvent, context),
      introDurationMs: WEIGHT_PRESENTATION_MS[protocol.weight],
    };
  }

  const narrator =
    preferredAgent ?? agentDirectorRegistry[0]?.agentName ?? "Brimstone";

  const weight: EventWeight = definition?.weight ?? "common";

  return {
    mode: definition?.sourceKingdom ? "kingdom" : "agent",
    weight,
    quote:
      definition?.story.paragraphs[1]?.match(/"([^"]+)"/)?.[1] ??
      "Something's happening. Stay sharp.",
    agentName: definition?.sourceKingdom ? undefined : narrator,
    agentRole: definition?.story.narratorRole,
    protocolName: definition?.sourceKingdom ? definition.sourceKingdom : undefined,
    protocolSubtitle: definition?.sourceKingdom ? "Protocol Brief" : undefined,
    protocolCode: definition?.sourceKingdom ? "KNG-DEBUG" : undefined,
    event: resolveDirectorEvent(baseEvent, context),
    introDurationMs: WEIGHT_PRESENTATION_MS[weight],
  };
}

/**
 * Personality-first event pick: Agent Director (common) or Kingdom Director (rare).
 * Host-authoritative — call only on the host / local pass-and-play client.
 */
export function pickDirectorEvent(
  pool: GameEvent[],
  context: NarrativeContext,
  options?: { forceKingdom?: boolean; forceAgent?: string }
): DirectorPickResult {
  const useKingdom =
    options?.forceKingdom ??
    (!options?.forceAgent && Math.random() < KINGDOM_DIRECTOR_CHANCE);

  if (useKingdom && !options?.forceAgent) {
    const kingdomPick = pickKingdomDirector(pool, context);
    if (kingdomPick) return kingdomPick;
  }

  if (options?.forceAgent) {
    const forced = agentDirectorRegistry.find(
      (entry) => entry.agentId === options.forceAgent
    );
    if (forced) {
      const eventById = buildEventById(pool);
      const availableEventIds = new Set(pool.map((event) => event.id));
      const bindings = forced.events.filter((binding) =>
        availableEventIds.has(binding.eventId)
      );
      if (bindings.length > 0) {
        const binding = pickWeightedEventBinding(bindings);
        const baseEvent = eventById.get(binding.eventId);
        if (baseEvent) {
          return {
            mode: "agent",
            weight: binding.weight,
            quote: forced.quote,
            agentName: forced.agentName,
            agentRole: forced.role,
            event: resolveDirectorEvent(baseEvent, context),
            introDurationMs: WEIGHT_PRESENTATION_MS[binding.weight],
          };
        }
      }
    }
  }

  const agentPick = pickAgentDirector(pool, context);
  if (agentPick) return agentPick;

  const kingdomFallback = pickKingdomDirector(pool, context);
  if (kingdomFallback) return kingdomFallback;

  const fallback = pool[Math.floor(Math.random() * pool.length)];
  const fallbackNarrator = isEventEligibleAgent(fallback.story.narrator)
    ? fallback.story.narrator
    : agentDirectorRegistry[0]?.agentName ?? "Brimstone";
  return {
    mode: "agent",
    weight: "common",
    quote: "Something's happening. Stay sharp.",
    agentName: fallbackNarrator,
    agentRole: fallback.story.narratorRole,
    event: resolveDirectorEvent(fallback, context),
    introDurationMs: WEIGHT_PRESENTATION_MS.common,
  };
}
