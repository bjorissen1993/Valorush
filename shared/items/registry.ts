import type { ItemDefinition } from "./types";

/** Creds cost to buy radianite from shop (not a cheap filler item). */
export const RADIANITE_BUY_COST = 3000;

/**
 * Shop / inventory items for the expansion shop rotation.
 * Normal Valorant weapons are NOT sold — only Odin + Operator as specials.
 */

export const itemRegistry: ItemDefinition[] = [
  {
    id: "extra-dice",
    name: "Extra Dice",
    description: "+1 to your next movement roll.",
    category: "weapon",
    price: 400,
    acquisition: ["shop", "event"],
    boardEffect: { kind: "dice_bonus", amount: 1 },
    icon: "/abilities/jett/Updraft.png",
  },
  {
    id: "agent-dice",
    name: "Agent Dice",
    description: "Roll with your agent's special dice rules next turn.",
    category: "agent",
    price: 600,
    acquisition: ["shop"],
    boardEffect: { kind: "dice_bonus", amount: 2 },
    icon: "/abilities/phoenix/Run_it_Back.png",
  },
  {
    id: "ultimate-orb-pack",
    name: "Ultimate Orb",
    description: "Gain +1 ultimate orb (capped at 3).",
    category: "agent",
    price: 800,
    acquisition: ["shop"],
    icon: "/abilities/jett/Blade_Storm.png",
  },
  {
    id: "special-odin",
    name: "Odin",
    description: "Special weapon — heavy machine gun for custom matches.",
    category: "weapon",
    price: 3200,
    acquisition: ["shop"],
    icon: "/weapons/Odin.png",
  },
  {
    id: "special-operator",
    name: "Operator",
    description: "Special weapon — one-shot potential in custom matches.",
    category: "weapon",
    price: 4700,
    acquisition: ["shop"],
    icon: "/weapons/Operator.png",
  },
  {
    id: "advanced-defuse-kit",
    name: "Advanced Defuse Kit",
    description: "Spike defuse — +2 to your defuse dice total.",
    category: "agent",
    sourceAgent: "Killjoy",
    price: 500,
    acquisition: ["shop", "event"],
    boardEffect: { kind: "spike_wire_cutter", bonus: 2 },
    icon: "/abilities/killjoy/Lockdown.png",
  },
  {
    id: "defuse-drone",
    name: "Defuse Drone",
    description: "Spike defuse — preview both dice before choosing.",
    category: "agent",
    sourceAgent: "Sova",
    price: 450,
    acquisition: ["shop"],
    boardEffect: { kind: "spike_owl_preview" },
    icon: "/abilities/sova/Owl_Drone.png",
  },
  {
    id: "lucky-backpack",
    name: "Lucky Backpack",
    description: "Next shop visit: one free reroll of the offer set.",
    category: "weapon",
    price: 350,
    acquisition: ["shop", "minigame"],
    icon: "/weapons/Classic.png",
  },
  {
    id: "dice-holder",
    name: "Dice Holder",
    description: "Store a rolled die and reuse it once instead of rolling.",
    category: "weapon",
    price: 550,
    acquisition: ["shop"],
    boardEffect: { kind: "dice_bonus", amount: 1 },
    icon: "/abilities/breach/Rolling_Thunder.png",
  },
  // Legacy / event loot retained for inventory compatibility
  {
    id: "jett-dice",
    name: "Jett's Updraft Dice",
    description: "Tailwind boost — +1 to your next movement roll.",
    category: "agent",
    sourceAgent: "Jett",
    price: 300,
    acquisition: ["event"],
    boardEffect: { kind: "dice_bonus", amount: 1 },
    icon: "/abilities/jett/Updraft.png",
  },
  {
    id: "ghost-steal",
    name: "Ghost Silencer",
    description: "Silent pick — steal 100 creds from a chosen player.",
    category: "weapon",
    price: 400,
    acquisition: ["black_market", "event"],
    boardEffect: { kind: "steal_creds", amount: 100 },
    icon: "/weapons/Ghost.png",
  },
  {
    id: "wire-cutter",
    name: "Wire Cutter",
    description: "Spike defuse — +1 to your defuse dice total.",
    category: "agent",
    sourceAgent: "Killjoy",
    price: 250,
    acquisition: ["event"],
    boardEffect: { kind: "spike_wire_cutter", bonus: 1 },
    icon: "/abilities/killjoy/Lockdown.png",
  },
  {
    id: "stim-beacon",
    name: "Stim Beacon",
    description: "Spike defuse — reroll both dice once.",
    category: "agent",
    sourceAgent: "Brimstone",
    price: 300,
    acquisition: ["event"],
    boardEffect: { kind: "spike_stim_reroll" },
    icon: "/abilities/brimstone/Stim_Beacon.png",
  },
  {
    id: "owl-drone",
    name: "Owl Drone",
    description: "Spike defuse — preview both dice before choosing.",
    category: "agent",
    sourceAgent: "Sova",
    price: 275,
    acquisition: ["event"],
    boardEffect: { kind: "spike_owl_preview" },
    icon: "/abilities/sova/Owl_Drone.png",
  },
  {
    id: "ultimate-charge",
    name: "Ultimate Charge",
    description: "Spike defuse — +2 to your chosen defuse dice.",
    category: "agent",
    price: 500,
    acquisition: ["event", "minigame"],
    boardEffect: { kind: "spike_ultimate", bonus: 2 },
    icon: "/abilities/jett/Blade_Storm.png",
  },
];

export const itemById = new Map(itemRegistry.map((item) => [item.id, item]));

/** Rotating shop pool (expansion). */
export const ROTATING_SHOP_ITEM_IDS = [
  "extra-dice",
  "agent-dice",
  "ultimate-orb-pack",
  "special-odin",
  "special-operator",
  "advanced-defuse-kit",
  "defuse-drone",
  "lucky-backpack",
  "dice-holder",
] as const;

export const shopItems = itemRegistry.filter((item) =>
  item.acquisition.includes("shop")
);

export const rotatingShopItems = ROTATING_SHOP_ITEM_IDS.map(
  (id) => itemById.get(id)!
).filter(Boolean);

export const blackMarketItems = itemRegistry.filter((item) =>
  item.acquisition.includes("black_market")
);
