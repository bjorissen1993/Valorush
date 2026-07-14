import type { AgentDirectorDefinition } from "./types";
import { isEventEligibleAgent } from "../availableAgents";

/**
 * Agent Director registry — each agent ONLY directs events matching their kit & lore.
 * Only agents with portrait assets may appear here (see `shared/availableAgents.ts`).
 */
const agentDirectorRegistryRaw: AgentDirectorDefinition[] = [
  {
    agentId: "Brimstone",
    agentName: "Brimstone",
    role: "Protocol Commander",
    quote: "Listen up. This site is about to get loud.",
    personality: "Tactical leadership, smokes, orbital strikes, team coordination",
    events: [
      { eventId: "brimstone-tdm", weight: "common", theme: "Team Deathmatch" },
      { eventId: "kingdom-spike-rush", weight: "rare", theme: "Logistics Drop" },
    ],
  },
  {
    agentId: "Killjoy",
    agentName: "Killjoy",
    role: "Protocol Engineer",
    quote: "Board's reconfigured. Try not to break my setup.",
    personality: "Gadgets, locks, map control, engineering",
    events: [
      { eventId: "killjoy-cache", weight: "common", theme: "Gadget Cache" },
      { eventId: "bind-teleporter", weight: "rare", theme: "Supply Drop" },
      { eventId: "deadlock-lockdown", weight: "common", theme: "Barrier Trap" },
    ],
  },
  {
    agentId: "Cypher",
    agentName: "Cypher",
    role: "Sentinel",
    quote: "Everything is recorded. Including your creds.",
    personality: "Intel, surveillance, hidden information revealed",
    events: [
      { eventId: "chamber-tax", weight: "common", theme: "Black Market Intel" },
      { eventId: "skye-trail-boost", weight: "rare", theme: "Shared Intel" },
    ],
  },
  {
    agentId: "Chamber",
    agentName: "Chamber",
    role: "Weapons Dealer",
    quote: "Premium inventory. Premium prices. Take it or leave it.",
    personality: "Economy, black market weapons, concierge deals",
    events: [
      { eventId: "chamber-tax", weight: "common", theme: "Black Market" },
    ],
  },
  {
    agentId: "Sage",
    agentName: "Sage",
    role: "Monarch",
    quote: "Stay close. I won't let your economy flatline.",
    personality: "Healing, protection, team support",
    events: [
      { eventId: "killjoy-cache", weight: "common", theme: "Protection" },
    ],
  },
  {
    agentId: "Neon",
    agentName: "Neon",
    role: "Duelist",
    quote: "Keep up — sparks don't wait for slow buys.",
    personality: "Speed, movement, high-tempo plays",
    events: [
      { eventId: "neon-rush", weight: "common", theme: "Speed Event" },
    ],
  },
  {
    agentId: "Jett",
    agentName: "Jett",
    role: "Duelist",
    quote: "Too slow. Watch how it's done.",
    personality: "Mobility, duels, wind-style aggression",
    events: [
      { eventId: "neon-rush", weight: "common", theme: "Speed Duel" },
      { eventId: "ascent-zipline", weight: "common", theme: "Zipline Rush" },
    ],
  },
  {
    agentId: "Yoru",
    agentName: "Yoru",
    role: "Dimensional Duelist",
    quote: "Wrong dimension. Try again.",
    personality: "Teleports, rifts, dimensional bluffs",
    events: [
      { eventId: "yoru-rift", weight: "common", theme: "Rift Teleport" },
      { eventId: "bind-teleporter", weight: "rare", theme: "Dimensional Bluff" },
    ],
  },
  {
    agentId: "Omen",
    agentName: "Omen",
    role: "Shadow Agent",
    quote: "New routes open in the smoke. Choose wisely.",
    personality: "Smokes, shadow economy, new paths",
    events: [
      { eventId: "omen-shadows", weight: "common", theme: "Shadow Swap" },
      { eventId: "fade-paranoia", weight: "rare", theme: "Shadow Paranoia" },
      { eventId: "viper-escalation", weight: "epic", theme: "Escalation Match" },
    ],
  },
  {
    agentId: "Reyna",
    agentName: "Reyna",
    role: "Radiant Empress",
    quote: "Your creds look hungry. Feed me.",
    personality: "Life steal, tribute, empress dominance",
    events: [
      { eventId: "iso-challenge", weight: "common", theme: "Steal Mechanic" },
    ],
  },
  {
    agentId: "Breach",
    agentName: "Breach",
    role: "Initiator",
    quote: "Move — or I'll move you through the wall.",
    personality: "Disruption, pushes, stuns, force",
    events: [
      { eventId: "breach-shockwave", weight: "common", theme: "Push Event" },
    ],
  },
  {
    agentId: "Clove",
    agentName: "Clove",
    role: "Controller",
    quote: "Live a little. Everyone bets creds — winner takes the pot.",
    personality: "Resurrection vibes, chaos, credit gambling",
    events: [
      { eventId: "clove-gamble", weight: "common", theme: "Credit Bet" },
    ],
  },
  {
    agentId: "Sova",
    agentName: "Sova",
    role: "Initiator",
    quote: "Recon bolt inbound. Intel is power.",
    personality: "Recon, intel, owl drone",
    events: [
      { eventId: "skye-trail-boost", weight: "common", theme: "Hidden Info" },
    ],
  },
  {
    agentId: "Skye",
    agentName: "Skye",
    role: "Initiator",
    quote: "My seeker found something worth chasing.",
    personality: "Guiding light, recovery, tracking",
    events: [
      { eventId: "skye-trail-boost", weight: "common", theme: "Trail Intel" },
    ],
  },
  {
    agentId: "Raze",
    agentName: "Raze",
    role: "Duelist",
    quote: "Demo time. Stand back.",
    personality: "Explosives, chaos, demolition",
    events: [
      { eventId: "breach-shockwave", weight: "common", theme: "Demo Event" },
    ],
  },
  {
    agentId: "Phoenix",
    agentName: "Phoenix",
    role: "Duelist",
    quote: "Watch this flash — then collect your creds.",
    personality: "Fire, self-res, aggressive duels",
    events: [
      { eventId: "neon-rush", weight: "common", theme: "Flash Chaos" },
    ],
  },
  {
    agentId: "KAY/O",
    agentName: "KAY/O",
    role: "Combat Machine",
    quote: "Threat detected. Memory core online.",
    personality: "Suppression, war machine, radianite fragments",
    events: [
      { eventId: "astra-cosmic-divide", weight: "common", theme: "Memory Core" },
    ],
  },
  {
    agentId: "Viper",
    agentName: "Viper",
    role: "Protocol Founder",
    quote: "Breathe the toxin. Obey the protocol.",
    personality: "Toxic control, economy manipulation, shadows",
    events: [
      { eventId: "viper-escalation", weight: "common", theme: "Toxic Deal" },
    ],
  },
  {
    agentId: "Astra",
    agentName: "Astra",
    role: "Astral Guardian",
    quote: "Reality's thin here. Hold on.",
    personality: "Cosmic, dimensional glitches, map anomalies",
    events: [
      { eventId: "lotus-rotating-doors", weight: "epic", theme: "Dimensional Glitch" },
    ],
  },
];

export const agentDirectorRegistry = agentDirectorRegistryRaw.filter((entry) =>
  isEventEligibleAgent(entry.agentName)
);

export const agentDirectorById = new Map(
  agentDirectorRegistry.map((entry) => [entry.agentId, entry])
);
