/**
 * Single source of truth for local agent art shipped under `public/`.
 * Event directors and story narrators must use agents with portrait art
 * (DirectorPresentation always shows the portrait ring).
 */

/** Agents with `/portraits/{Name}_VALORANT_Portrait.png` */
export const AGENTS_WITH_PORTRAIT = [
  "Astra",
  "Breach",
  "Brimstone",
  "Chamber",
  "Clove",
  "Cypher",
  "Jett",
  "KAY/O",
  "Killjoy",
  "Neon",
  "Omen",
  "Phoenix",
  "Raze",
  "Reyna",
  "Sage",
  "Skye",
  "Sova",
  "Viper",
  "Yoru",
] as const;

/** Agents with full-body `/npc/{Name}_NPC.png` (subset also has portrait). */
export const AGENTS_WITH_NPC = [
  "Astra",
  "Breach",
  "Brimstone",
  "Chamber",
  "Cypher",
  "Fade",
  "Jett",
  "KAY/O",
  "Killjoy",
  "Neon",
  "Omen",
  "Phoenix",
  "Raze",
  "Reyna",
  "Sage",
  "Skye",
  "Sova",
  "Viper",
  "Yoru",
] as const;

export type AgentWithPortrait = (typeof AGENTS_WITH_PORTRAIT)[number];
export type AgentWithNpc = (typeof AGENTS_WITH_NPC)[number];

/** Agents allowed as event narrators / directors (portrait required). */
export const EVENT_ELIGIBLE_AGENTS = AGENTS_WITH_PORTRAIT;

export type EventEligibleAgent = AgentWithPortrait;

const PORTRAIT_SET = new Set<string>(AGENTS_WITH_PORTRAIT);
const NPC_SET = new Set<string>(AGENTS_WITH_NPC);
const EVENT_ELIGIBLE_SET = new Set<string>(EVENT_ELIGIBLE_AGENTS);

export function agentHasPortrait(agentName: string): boolean {
  return PORTRAIT_SET.has(agentName);
}

export function agentHasNpcModel(agentName: string): boolean {
  return NPC_SET.has(agentName);
}

/** True when an agent may appear in board events or the director registry. */
export function isEventEligibleAgent(agentName: string): agentName is EventEligibleAgent {
  return EVENT_ELIGIBLE_SET.has(agentName);
}

export function assertEventEligibleAgent(
  agentName: string,
  context: string
): asserts agentName is EventEligibleAgent {
  if (!isEventEligibleAgent(agentName)) {
    throw new Error(
      `${context}: agent "${agentName}" has no portrait asset — pick an entry from EVENT_ELIGIBLE_AGENTS`
    );
  }
}
