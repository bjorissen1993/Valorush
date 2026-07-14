import type { CustomMatchDefinition } from "./types";

export const customMatchRegistry: CustomMatchDefinition[] = [
  {
    id: "spike-rush",
    name: "Spike Rush",
    description: "Fast rounds, spike planted every site. First to the spike wins creds.",
    rulesStub: "All players roll — highest roll plants pressure. Winner takes bonus creds.",
    maps: ["Bind", "Ascent", "Split", "Lotus"],
    winCreds: 200,
    winRadianite: 1,
    durationLabel: "3 rounds",
  },
  {
    id: "tdm",
    name: "Team Deathmatch",
    description: "Elimination scramble — no spike, pure tempo.",
    rulesStub: "Everyone rolls. Highest eliminates the lowest. Winner gains creds.",
    maps: ["Sunset", "Pearl", "Icebox", "Fracture"],
    winCreds: 175,
    winRadianite: 1,
    durationLabel: "1 engagement",
  },
  {
    id: "escalation",
    name: "Escalation",
    description: "Weapons escalate each round — economy on the line.",
    rulesStub: "Roll-off with escalating stakes. Winner earns radianite.",
    maps: ["Ascent", "Split", "Lotus", "Abyss"],
    winCreds: 150,
    winRadianite: 2,
    durationLabel: "5 rounds",
  },
  {
    id: "pistol-round",
    name: "Pistol Round",
    description: "Sidearms only — cred efficiency test.",
    rulesStub: "Classic pistols. Highest roll wins the eco bonus.",
    maps: ["Bind", "Pearl", "Sunset", "Corrode"],
    winCreds: 125,
    winRadianite: 0,
    durationLabel: "1 round",
  },
  {
    id: "sheriff-duel",
    name: "Sheriff Duel",
    description: "One-tap tension — Sheriff only standoff.",
    rulesStub: "Pick your opponent mentally, roll for the one-shot. Winner steals creds.",
    maps: ["Ascent", "Icebox", "Fracture"],
    winCreds: 200,
    winRadianite: 0,
    durationLabel: "1 duel",
  },
  {
    id: "operator-only",
    name: "Operator Only",
    description: "Hold angles, hold your breath — Op scopes only.",
    rulesStub: "Long-range roll-off. Highest scope shot wins.",
    maps: ["Icebox", "Fracture", "Abyss", "Corrode"],
    winCreds: 250,
    winRadianite: 1,
    durationLabel: "1 hold",
  },
  {
    id: "knife-fight",
    name: "Knife Fight",
    description: "Melee only — close quarters chaos.",
    rulesStub: "Blades out. Closest roll to 6 wins the knife round bonus.",
    maps: ["Bind", "Split", "Lotus"],
    winCreds: 100,
    winRadianite: 1,
    durationLabel: "1 clash",
  },
];

export const customMatchById = new Map(
  customMatchRegistry.map((entry) => [entry.id, entry])
);

export function pickRandomMapForMatch(matchId: string): string {
  const match = customMatchById.get(matchId as CustomMatchDefinition["id"]);
  if (!match || match.maps.length === 0) return "Ascent";
  return match.maps[Math.floor(Math.random() * match.maps.length)];
}
