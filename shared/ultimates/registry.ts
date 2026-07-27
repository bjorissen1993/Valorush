import type { UltimateDefinition, UltimatePathOption } from "./types";

/**
 * Ultimate registry — one entry per agent.
 * All entries are playable (`implementation: "full"`) with apply logic in `src/game/ultimates/`.
 */
export const ultimateRegistry: UltimateDefinition[] = [
  {
    agentName: "Brimstone",
    id: "orbital-strike",
    name: "Orbital Strike",
    description:
      "Place a free-cursor orbital circle. Partially hit tiles count fully. Opponents lose credits; Brimstone is immune. No knockback.",
    targetKind: "area",
    areaRadius: 12,
    creditDamage: 400,
    implementation: "full",
    icon: "/abilities/brimstone/Orbital_Strike.png",
  },
  {
    agentName: "Viper",
    id: "vipers-pit",
    name: "Viper's Pit",
    description:
      "Place a poison zone within range of Viper. Lasts 1 board round. Opponents get -2 movement once per cast. Viper is immune.",
    targetKind: "area",
    areaRadius: 8,
    placementRadius: 18,
    implementation: "full",
    icon: "/abilities/viper/Vipers_Pit.png",
  },
  {
    agentName: "Omen",
    id: "from-the-shadows",
    name: "From The Shadows",
    description:
      "Teleport to any tile. Do not activate the landing tile. Your turn ends immediately.",
    targetKind: "tile",
    implementation: "full",
    icon: "/abilities/omen/From_the_Shadows.png",
  },
  {
    agentName: "Killjoy",
    id: "lockdown",
    name: "Lockdown",
    description:
      "Place a device within range of Killjoy. It detonates at the start of your next turn. Survivors in the zone get -2 movement once.",
    targetKind: "area",
    areaRadius: 14,
    placementRadius: 22,
    implementation: "full",
    icon: "/abilities/killjoy/Lockdown.png",
  },
  {
    agentName: "Cypher",
    id: "neural-theft",
    name: "Neural Theft",
    description:
      "Configure the next custom match: matchup, gamemode, teams, and TDM-style weapons. Applies once, then resets. Map cannot be changed.",
    targetKind: "match_config",
    implementation: "full",
    icon: "/abilities/cypher/Neural_Theft.png",
  },
  {
    agentName: "Sova",
    id: "hunters-fury",
    name: "Hunter's Fury",
    description:
      "Fire 3 separate aim shots (re-aim between). Each hit steals credits and applies Revealed for 1 round.",
    targetKind: "multi_shot",
    creditDamage: 250,
    implementation: "full",
    icon: "/abilities/sova/Hunters_Fury.png",
  },
  {
    agentName: "Sage",
    id: "resurrection",
    name: "Resurrection",
    description:
      "Arm a reactive ultimate. When a negative effect hits you, choose to fully roll it back.",
    targetKind: "reactive",
    implementation: "full",
    icon: "/abilities/sage/Resurrection.png",
  },
  {
    agentName: "Phoenix",
    id: "run-it-back",
    name: "Run It Back",
    description:
      "Arm a reactive ultimate. When a negative effect hits you, choose to fully roll it back.",
    targetKind: "reactive",
    implementation: "full",
    icon: "/abilities/phoenix/Run_it_Back.png",
  },
  {
    agentName: "Jett",
    id: "blade-storm",
    name: "Blade Storm",
    description:
      "Roll 2 dice and move with the highest. Each opponent you pass pays 200 creds.",
    targetKind: "none",
    implementation: "full",
    icon: "/abilities/jett/Blade_Storm.png",
  },
  {
    agentName: "Reyna",
    id: "empress",
    name: "Empress",
    description:
      "For the next 3 rounds: double minigame rewards and ignore minigame penalties.",
    targetKind: "none",
    implementation: "full",
    icon: "/abilities/reyna/Empress.png",
  },
  {
    agentName: "Raze",
    id: "showstopper",
    name: "Showstopper",
    description:
      "Pick a player: they lose 600 creds OR are pushed back 4 spaces.",
    targetKind: "player_or_choice",
    choices: [
      { id: "creds", label: "−600 Creds", description: "Blast their wallet." },
      {
        id: "spaces",
        label: "Back 4 Spaces",
        description: "Knock them back along the board.",
      },
    ],
    implementation: "full",
    icon: "/abilities/raze/Showstopper.png",
  },
  {
    agentName: "Breach",
    id: "rolling-thunder",
    name: "Rolling Thunder",
    description: "All opponents get −1 movement on their next turn.",
    targetKind: "none",
    implementation: "full",
    icon: "/abilities/breach/Rolling_Thunder.png",
  },
  {
    agentName: "Skye",
    id: "seekers",
    name: "Seekers",
    description:
      "Send 3 seekers to random opponents. Each: 50% steal an item, else −200 creds.",
    targetKind: "none",
    implementation: "full",
    icon: "/abilities/skye/Seekers.png",
  },
  {
    agentName: "Yoru",
    id: "dimensional-drift",
    name: "Dimensional Drift",
    description:
      "Untargetable for 2 rounds. Ignore negative effects and pass through blocked paths.",
    targetKind: "none",
    implementation: "full",
    icon: "/abilities/yoru/Dimensional_Drift.png",
  },
  {
    agentName: "Astra",
    id: "cosmic-divide-ult",
    name: "Cosmic Divide",
    description:
      "Place a wall between two connected paths for 2 rounds. Players cannot pass (Yoru drift excepted).",
    targetKind: "edge",
    implementation: "full",
    icon: "/abilities/astra/Cosmic_Divide.png",
  },
  {
    agentName: "KAY/O",
    id: "null-cmd",
    name: "NULL/CMD",
    description:
      "Opponents within range cannot use items on their next turn.",
    targetKind: "none",
    rangeTiles: 3,
    implementation: "full",
    icon: "/abilities/kayo/NULL-cmd.png",
  },
  {
    agentName: "Chamber",
    id: "tour-de-force",
    name: "Tour de Force",
    description:
      "Target a player: Tour de Force animation, Slow Zone on their tile, then a weighted Loot Wheel — steal credits/radianite (fallback 3000 creds if no rad).",
    targetKind: "player",
    implementation: "full",
    icon: "/abilities/chamber/Tour_De_Force.png",
  },
  {
    agentName: "Neon",
    id: "overdrive",
    name: "Overdrive",
    description: "Your next movement is doubled.",
    targetKind: "none",
    implementation: "full",
    icon: "/abilities/neon/Overdrive.png",
  },
  {
    agentName: "Fade",
    id: "nightfall",
    name: "Nightfall",
    description: "Every opponent loses 1 ultimate orb.",
    targetKind: "none",
    implementation: "full",
    icon: "/abilities/fade/Nightfall.png",
  },
  {
    agentName: "Clove",
    id: "not-dead-yet",
    name: "Not Dead Yet",
    description: "Your next negative effect is ignored once.",
    targetKind: "none",
    implementation: "full",
    icon: "/abilities/clove/Not_Dead_Yet.png",
  },
  {
    agentName: "Vyse",
    id: "steel-garden",
    name: "Steel Garden",
    description:
      "Place a trap on a tile. The first player to land on it ends their movement.",
    targetKind: "tile",
    implementation: "full",
    icon: "/abilities/vyse/Steel_Garden.png",
  },

  {
    agentName: "Harbor",
    id: "reckoning",
    name: "Reckoning",
    description:
      "Summon a cascade along a path — opponents hit lose 200 creds and −1 movement next turn.",
    targetKind: "path",
    implementation: "full",
    icon: "/abilities/harbor/Reckoning.png",
  },
  {
    agentName: "Gekko",
    id: "thrash",
    name: "Thrash",
    description:
      "Send Thrash to a tile; detain the first opponent who enters (skip next turn).",
    targetKind: "tile",
    implementation: "full",
    icon: "/abilities/gekko/Thrash.png",
  },
  {
    agentName: "Deadlock",
    id: "annihilation",
    name: "Annihilation",
    description:
      "Pull a target to Deadlock's tile. Do not activate landing. Phoenix/Sage can reactive-counter.",
    targetKind: "player",
    implementation: "full",
    icon: "/abilities/deadlock/Annihilation.png",
  },
  {
    agentName: "Iso",
    id: "kill-contract",
    name: "Kill Contract",
    description:
      "Isolate one opponent in a duel — winner +400 creds, loser −1 orb.",
    targetKind: "player",
    implementation: "full",
    icon: "/abilities/iso/Kill_Contract.png",
  },
  {
    agentName: "Tejo",
    id: "armageddon",
    name: "Armageddon",
    description:
      "Mark a zone of 3 connected tiles; opponents there lose 350 creds.",
    targetKind: "tile",
    implementation: "full",
    icon: "/abilities/tejo/Armageddon.png",
  },
  {
    agentName: "Waylay",
    id: "saturating-fire",
    name: "Saturating Fire",
    description:
      "Spray a row: each opponent hit pays 150 or discards a random item.",
    targetKind: "path",
    implementation: "full",
    icon: "/abilities/waylay/Saturate.png",
  },
];

/** Strip punctuation/spacing so "KAY/O", "Kayo", "kay-o" all match. */
export function normalizeAgentLookupKey(agentName: string): string {
  return agentName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export const ultimateByAgentName = new Map(
  ultimateRegistry.map((ult) => [ult.agentName, ult])
);

const ultimateByNormalizedName = new Map(
  ultimateRegistry.map((ult) => [normalizeAgentLookupKey(ult.agentName), ult])
);

/** Extra aliases for API / display name drift. */
const AGENT_NAME_ALIASES: Record<string, string> = {
  kayo: "kayo",
  kay: "kayo",
  nullcmd: "kayo",
  kayoagent: "kayo",
};

export function getUltimateForAgent(
  agentName: string
): UltimateDefinition | undefined {
  if (!agentName || agentName === "No agent") return undefined;
  const exact = ultimateByAgentName.get(agentName);
  if (exact) return exact;
  const key = normalizeAgentLookupKey(agentName);
  const aliased = AGENT_NAME_ALIASES[key] ?? key;
  return ultimateByNormalizedName.get(aliased);
}

/** Playable (fully implemented) ultimates only. */
export function listPlayableUltimates(): UltimateDefinition[] {
  return ultimateRegistry.filter((ult) => ult.implementation === "full");
}

/** Board paths used by Sova Hunter's Fury (and similar path ultimates). */
export const ULTIMATE_BOARD_PATHS: UltimatePathOption[] = [
  {
    id: "outer-top",
    label: "Outer Top",
    nodeIds: ["start", "o1", "o2", "o3", "o4", "o5", "o6", "o7", "o8", "o9"],
  },
  {
    id: "outer-right",
    label: "Outer Right",
    nodeIds: ["o10", "o11", "o12", "o13", "o14", "o15", "o16", "o17", "o18"],
  },
  {
    id: "outer-bottom",
    label: "Outer Bottom",
    nodeIds: ["o19", "o20", "o21", "o22", "o23", "o24", "o25", "o26", "o27"],
  },
  {
    id: "outer-left",
    label: "Outer Left",
    nodeIds: ["o28", "o29", "o30", "o31", "o32", "o33", "o34", "o35"],
  },
  {
    id: "mid-ring",
    label: "Mid Ring",
    nodeIds: [
      "m1",
      "m2",
      "m3",
      "m4",
      "m5",
      "m6",
      "m7",
      "m8",
      "m9",
      "m10",
      "m11",
      "m12",
      "m13",
      "m14",
    ],
  },
  {
    id: "inner-hub",
    label: "Inner Ring",
    nodeIds: ["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8"],
  },
];
