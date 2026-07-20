import type { UltimateDefinition, UltimatePathOption } from "./types";

/**
 * Ultimate registry — one entry per agent.
 * `implementation: "full"` agents have playable apply logic in `src/game/ultimates/`.
 * Stub entries keep the official board-game spec for future work.
 */
export const ultimateRegistry: UltimateDefinition[] = [
  {
    agentName: "Brimstone",
    id: "orbital-strike",
    name: "Orbital Strike",
    description:
      "Pick a tile. That tile and adjacent tiles: −300 creds and back 2 spaces.",
    targetKind: "tile",
    implementation: "full",
    icon: "/abilities/brimstone/Orbital_Strike.png",
  },
  {
    agentName: "Viper",
    id: "vipers-pit",
    name: "Viper's Pit",
    description:
      "Drop a poison cloud on a tile for 1 round. Players in the cloud have half movement (floored).",
    targetKind: "tile",
    implementation: "full",
    icon: "/abilities/viper/Vipers_Pit.png",
  },
  {
    agentName: "Omen",
    id: "from-the-shadows",
    name: "From The Shadows",
    description: "Teleport to any tile, then take a mini-move of up to 3 spaces.",
    targetKind: "tile_and_move",
    miniMoveSteps: 3,
    implementation: "full",
    icon: "/abilities/omen/From_the_Shadows.png",
  },
  {
    agentName: "Killjoy",
    id: "lockdown",
    name: "Lockdown",
    description:
      "Each opponent must pay 300 creds or skip their next turn.",
    targetKind: "sequential_opponents",
    implementation: "full",
    icon: "/abilities/killjoy/Lockdown.png",
  },
  {
    agentName: "Cypher",
    id: "neural-theft",
    name: "Neural Theft",
    description:
      "Reveal opponents' creds, items, and orbs. Steal 1 random item from a chosen opponent.",
    targetKind: "player",
    implementation: "full",
    icon: "/abilities/cypher/Neural_Theft.png",
  },
  {
    agentName: "Sova",
    id: "hunters-fury",
    name: "Hunter's Fury",
    description:
      "Fire along a board path. Each opponent hit loses a random item or −250 creds.",
    targetKind: "path",
    implementation: "full",
    icon: "/abilities/sova/Hunters_Fury.png",
  },
  {
    agentName: "Sage",
    id: "resurrection",
    name: "Resurrection",
    description:
      "Choose: teleport to Start, gain an extra turn, or clear your status effects.",
    targetKind: "choice",
    choices: [
      {
        id: "to-start",
        label: "Return to Start",
        description: "Teleport to the Start tile.",
      },
      {
        id: "extra-turn",
        label: "Extra Turn",
        description: "Take another turn immediately after this one.",
      },
      {
        id: "cleanse",
        label: "Cleanse",
        description: "Clear poison, penalties, locks, and skip flags.",
      },
    ],
    implementation: "full",
    icon: "/abilities/sage/Resurrection.png",
  },
  {
    agentName: "Phoenix",
    id: "run-it-back",
    name: "Run It Back",
    description:
      "After your turn, choose: keep your end position or return to where you started the turn.",
    targetKind: "none",
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
    description: "Duel one player (dice). Winner gains +500 creds.",
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

  // ── Spec stubs (no portrait / future agents) ──────────────────────────
  {
    agentName: "Harbor",
    id: "reckoning",
    name: "Reckoning",
    description:
      "Summon a cascade along a path — opponents hit lose 200 creds and −1 movement next turn. (Stub)",
    targetKind: "path",
    implementation: "stub",
  },
  {
    agentName: "Gekko",
    id: "thrash",
    name: "Thrash",
    description:
      "Send Thrash to a tile; detain the first opponent who enters (skip next turn). (Stub)",
    targetKind: "tile",
    implementation: "stub",
  },
  {
    agentName: "Deadlock",
    id: "annihilation",
    name: "Annihilation",
    description:
      "Pull an opponent toward you up to 3 spaces and steal 150 creds. (Stub)",
    targetKind: "player",
    implementation: "stub",
  },
  {
    agentName: "Iso",
    id: "kill-contract",
    name: "Kill Contract",
    description:
      "Isolate one opponent in a duel — winner +400 creds, loser −1 orb. (Stub)",
    targetKind: "player",
    implementation: "stub",
  },
  {
    agentName: "Tejo",
    id: "armageddon",
    name: "Armageddon",
    description:
      "Mark a zone of 3 connected tiles; opponents there lose 350 creds. (Stub)",
    targetKind: "tile",
    implementation: "stub",
  },
  {
    agentName: "Waylay",
    id: "saturating-fire",
    name: "Saturating Fire",
    description:
      "Spray a row: each opponent hit pays 150 or discards a random item. (Stub)",
    targetKind: "path",
    implementation: "stub",
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
    id: "top-row",
    label: "Top Row",
    nodeIds: ["start", "top-1", "top-2", "top-split", "top-outer-1"],
  },
  {
    id: "right-side",
    label: "Right Side",
    nodeIds: ["right-1", "right-2", "right-merge", "right-3"],
  },
  {
    id: "bottom-row",
    label: "Bottom Row",
    nodeIds: [
      "bottom-1",
      "bottom-2",
      "bottom-3",
      "bottom-split",
      "bottom-outer-1",
    ],
  },
  {
    id: "left-side",
    label: "Left Side",
    nodeIds: ["left-3", "left-2", "left-merge", "left-1"],
  },
  {
    id: "top-inner",
    label: "Top Inner Shortcut",
    nodeIds: ["top-inner-1", "top-inner-2"],
  },
  {
    id: "bottom-inner",
    label: "Bottom Inner Shortcut",
    nodeIds: ["bottom-inner-1", "bottom-inner-2"],
  },
];
