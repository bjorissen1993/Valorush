import type { AgentDirectorDefinition } from "./types";

/**
 * Agent Director registry — each agent ONLY directs events matching their kit & lore.
 * Add agents here; map `eventId` to entries in `src/game/eventPool.ts`.
 */
export const agentDirectorRegistry: AgentDirectorDefinition[] = [
  {
    agentId: "Brimstone",
    agentName: "Brimstone",
    role: "Protocol Commander",
    quote: "Listen up. This site is about to get loud.",
    personality: "Tactical leadership, smokes, orbital strikes, team coordination",
    events: [
      { eventId: "brimstone-smoke-gamble", weight: "common", theme: "Team Deathmatch" },
      { eventId: "supply-ascent", weight: "rare", theme: "Logistics Drop" },
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
      { eventId: "supply-ascent", weight: "rare", theme: "Supply Drop" },
    ],
  },
  {
    agentId: "Cypher",
    agentName: "Cypher",
    role: "Sentinel",
    quote: "Everything is recorded. Including your creds.",
    personality: "Intel, surveillance, hidden information revealed",
    events: [
      { eventId: "cypher-market-gamble", weight: "common", theme: "Black Market Intel" },
      { eventId: "sova-intel", weight: "rare", theme: "Shared Intel" },
    ],
  },
  {
    agentId: "Chamber",
    agentName: "Chamber",
    role: "Weapons Dealer",
    quote: "Premium inventory. Premium prices. Take it or leave it.",
    personality: "Economy, black market weapons, concierge deals",
    events: [
      { eventId: "chamber-invoice-gamble", weight: "common", theme: "Black Market" },
    ],
  },
  {
    agentId: "Sage",
    agentName: "Sage",
    role: "Monarch",
    quote: "Stay close. I won't let your economy flatline.",
    personality: "Healing, protection, team support",
    events: [
      { eventId: "sage-resilience", weight: "common", theme: "Protection" },
    ],
  },
  {
    agentId: "Fade",
    agentName: "Fade",
    role: "Initiator",
    quote: "The dark sees what Kingdom won't tell you.",
    personality: "Nightmares, fear, dark map modifiers, intel",
    events: [
      { eventId: "fade-whispers-gamble", weight: "common", theme: "Dark Intel" },
      { eventId: "viper-omen-shadow", weight: "epic", theme: "Shadow Briefing" },
    ],
  },
  {
    agentId: "Neon",
    agentName: "Neon",
    role: "Duelist",
    quote: "Keep up — sparks don't wait for slow buys.",
    personality: "Speed, movement, high-tempo plays",
    events: [
      { eventId: "jett-neon-gamble", weight: "common", theme: "Speed Event" },
    ],
  },
  {
    agentId: "Jett",
    agentName: "Jett",
    role: "Duelist",
    quote: "Too slow. Watch how it's done.",
    personality: "Mobility, duels, wind-style aggression",
    events: [
      { eventId: "jett-neon-gamble", weight: "common", theme: "Speed Duel" },
    ],
  },
  {
    agentId: "Yoru",
    agentName: "Yoru",
    role: "Dimensional Duelist",
    quote: "Wrong dimension. Try again.",
    personality: "Teleports, rifts, dimensional bluffs",
    events: [
      { eventId: "yoru-fakeout-gamble", weight: "common", theme: "Teleport Bluff" },
    ],
  },
  {
    agentId: "Omen",
    agentName: "Omen",
    role: "Shadow Agent",
    quote: "New routes open in the smoke. Choose wisely.",
    personality: "Smokes, shadow economy, new paths",
    events: [
      { eventId: "omen-smoke-deal", weight: "common", theme: "Shadow Routes" },
      { eventId: "viper-omen-shadow", weight: "rare", theme: "Smoke Cabinet" },
    ],
  },
  {
    agentId: "Reyna",
    agentName: "Reyna",
    role: "Radiant Empress",
    quote: "Your creds look hungry. Feed me.",
    personality: "Life steal, tribute, empress dominance",
    events: [
      { eventId: "reyna-empress-tax", weight: "common", theme: "Steal Mechanic" },
    ],
  },
  {
    agentId: "Breach",
    agentName: "Breach",
    role: "Initiator",
    quote: "Move — or I'll move you through the wall.",
    personality: "Disruption, pushes, stuns, force",
    events: [
      { eventId: "breach-standoff", weight: "common", theme: "Push Event" },
    ],
  },
  {
    agentId: "Harbor",
    agentName: "Harbor",
    role: "Controller",
    quote: "The tide turns. Swim with it.",
    personality: "Water, tidal control, map flooding",
    events: [
      { eventId: "supply-ascent", weight: "common", theme: "Water Supply" },
    ],
  },
  {
    agentId: "Clove",
    agentName: "Clove",
    role: "Controller",
    quote: "Live a little. Everyone bets creds — winner takes the pot.",
    personality: "Resurrection vibes, chaos, credit gambling",
    events: [
      { eventId: "brimstone-smoke-gamble", weight: "common", theme: "Credit Bet" },
      { eventId: "fade-whispers-gamble", weight: "rare", theme: "All-In Gamble" },
    ],
  },
  {
    agentId: "Sova",
    agentName: "Sova",
    role: "Initiator",
    quote: "Recon bolt inbound. Intel is power.",
    personality: "Recon, intel, owl drone",
    events: [
      { eventId: "sova-intel", weight: "common", theme: "Hidden Info" },
    ],
  },
  {
    agentId: "Skye",
    agentName: "Skye",
    role: "Initiator",
    quote: "My seeker found something worth chasing.",
    personality: "Guiding light, recovery, tracking",
    events: [
      { eventId: "skye-trail", weight: "common", theme: "Trail Intel" },
    ],
  },
  {
    agentId: "Raze",
    agentName: "Raze",
    role: "Duelist",
    quote: "Demo time. Stand back.",
    personality: "Explosives, chaos, demolition",
    events: [
      { eventId: "raze-demo-gamble", weight: "common", theme: "Demo Event" },
    ],
  },
  {
    agentId: "Phoenix",
    agentName: "Phoenix",
    role: "Duelist",
    quote: "Watch this flash — then collect your creds.",
    personality: "Fire, self-res, aggressive duels",
    events: [
      { eventId: "raze-demo-gamble", weight: "common", theme: "Flash Chaos" },
    ],
  },
  {
    agentId: "KAY/O",
    agentName: "KAY/O",
    role: "Combat Machine",
    quote: "Threat detected. Memory core online.",
    personality: "Suppression, war machine, radianite fragments",
    events: [
      { eventId: "kayo-memory", weight: "common", theme: "Memory Core" },
    ],
  },
  {
    agentId: "Viper",
    agentName: "Viper",
    role: "Protocol Founder",
    quote: "Breathe the toxin. Obey the protocol.",
    personality: "Toxic control, economy manipulation, shadows",
    events: [
      { eventId: "viper-omen-shadow", weight: "common", theme: "Toxic Deal" },
    ],
  },
  {
    agentId: "Astra",
    agentName: "Astra",
    role: "Astral Guardian",
    quote: "Reality's thin here. Hold on.",
    personality: "Cosmic, dimensional glitches, map anomalies",
    events: [
      { eventId: "mirror-glitch", weight: "epic", theme: "Dimensional Glitch" },
    ],
  },
];

export const agentDirectorById = new Map(
  agentDirectorRegistry.map((entry) => [entry.agentId, entry])
);
