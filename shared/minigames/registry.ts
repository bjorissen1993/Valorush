import type { MinigameDefinition } from "./types";

export const minigameRegistry: MinigameDefinition[] = [
  {
    id: "neon-race",
    name: "Neon Race",
    description: "Neon sparks a circuit across Sunset — fastest roller wins.",
    icon: "/abilities/neon/High_Gear.png",
    minPlayers: 2,
    maxPlayers: 8,
    rules: "All players roll. Highest roll wins creds and radianite. Ties reroll.",
    rewards: { creds: 175, radianite: 1 },
    map: "Sunset",
    durationLabel: "30 sec",
    playMode: "stub",
  },
  {
    id: "cypher-seek",
    name: "Cypher Seek",
    description: "Cypher's cameras catch every bluff — find the hidden node.",
    icon: "/abilities/cypher/Spycam.png",
    minPlayers: 2,
    maxPlayers: 8,
    rules: "Roll to decode camera feeds. Highest roll locates the stash.",
    rewards: { creds: 150, radianite: 1 },
    map: "Pearl",
    durationLabel: "45 sec",
    playMode: "stub",
  },
  {
    id: "quick-roll",
    name: "Quick Roll Challenge",
    description: "Classic board minigame — highest roll takes the pot.",
    icon: "/spike/Spike.png",
    minPlayers: 2,
    maxPlayers: 8,
    rules: "Everyone rolls once. Highest wins.",
    rewards: { creds: 150, radianite: 1 },
    map: "Ascent",
    durationLabel: "15 sec",
    playMode: "stub",
  },
];

export const minigameById = new Map(
  minigameRegistry.map((entry) => [entry.id, entry])
);

export const defaultBoardMinigameId = "quick-roll" as const;
