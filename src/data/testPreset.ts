import type { Player } from "../types/Player";
import type { Agent } from "../types/Agent";

const TEST_NAME_POOL = [
  "Nova",
  "Rift",
  "Kira",
  "Milo",
  "Zane",
  "Lyra",
  "Orion",
  "Vex",
  "Niko",
  "Sable",
  "Roux",
  "Ember",
  "Cade",
  "Iris",
  "Juno",
  "Kael",
  "Mira",
  "Pax",
  "Quinn",
  "Rhea",
  "Talon",
  "Vera",
  "Wren",
  "Yuri",
  "Blaze",
  "Cipher",
  "Dusk",
  "Echo",
  "Flux",
  "Haze",
  "Jinx",
  "Lux",
  "Nyx",
  "Onyx",
  "Wraith",
  "ClutchKing99",
  "PixelPeek",
  "HeadshotHero",
  "RankedGrinder",
  "SmokeMain_",
  "TurboTactician",
  "EcoRound",
  "FragHouse",
  "AceHunter",
  "NoScopeNina",
  "NightOwlStream",
  "ValoGrinder",
  "StormChaser",
  "LuckyAce",
  "ByteBandit",
  "GlitchRunner",
  "FlashBangFan",
  "SpikeRushPro",
  "MidControl",
  "SiteExec",
  "PeekMaster",
  "SprayTransfer",
  "OneTapOnly",
  "LateNightQueue",
];

const TEST_COLOR_POOL = [
  "#22c55e",
  "#38bdf8",
  "#a78bfa",
  "#f97316",
  "#f43f5e",
  "#eab308",
  "#14b8a6",
  "#ec4899",
  "#6366f1",
  "#84cc16",
  "#06b6d4",
  "#f59e0b",
];

function pickRandomUnique<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];

  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
}

function buildEligibleNamePool(agents: Agent[]): string[] {
  const agentNames = new Set(
    agents.flatMap((agent) => [
      agent.displayName.toLowerCase(),
      agent.displayName.replace(/\//g, "").replace(/\s+/g, "").toLowerCase(),
    ])
  );

  return TEST_NAME_POOL.filter((name) => !agentNames.has(name.toLowerCase()));
}

/** Quick-fill preset for local testing — random names & agents each call. */
export function buildTestPlayers(agents: Agent[]): Player[] {
  if (agents.length === 0) {
    throw new Error("No agents available for test preset.");
  }

  const playerCount = 4;
  const baseId = Date.now();
  const selectedAgents = pickRandomUnique(agents, playerCount);
  const eligibleNames = buildEligibleNamePool(agents);
  const selectedNames = pickRandomUnique(eligibleNames, playerCount);
  const selectedColors = pickRandomUnique(TEST_COLOR_POOL, playerCount);

  return selectedAgents.map((agent, index) => ({
    id: baseId + index,
    slotIndex: index,
    name: selectedNames[index] ?? `Player ${index + 1}`,
    color: selectedColors[index],
    selectedAgentId: agent.uuid,
  }));
}
