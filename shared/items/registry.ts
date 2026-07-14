import type { ItemDefinition } from "./types";

export const itemRegistry: ItemDefinition[] = [
  {
    id: "jett-dice",
    name: "Jett's Updraft Dice",
    description: "Tailwind boost — +1 to your next movement roll.",
    category: "agent",
    sourceAgent: "Jett",
    price: 300,
    acquisition: ["shop", "event"],
    boardEffect: { kind: "dice_bonus", amount: 1 },
    icon: "/abilities/jett/Updraft.png",
  },
  {
    id: "ghost-steal",
    name: "Ghost Silencer",
    description: "Silent pick — steal 100 creds from a chosen player.",
    category: "weapon",
    price: 400,
    acquisition: ["shop", "black_market"],
    boardEffect: { kind: "steal_creds", amount: 100 },
    icon: "/weapons/Ghost.png",
  },
  {
    id: "knife-swap",
    name: "Tactical Knife",
    description: "Flank swap — exchange board positions with a target.",
    category: "weapon",
    price: 350,
    acquisition: ["shop", "minigame"],
    boardEffect: { kind: "swap_position", targetPlayerIndex: -1 },
    icon: "/weapons/Knife.png",
  },
  {
    id: "operator-scope",
    name: "Operator Scope",
    description: "Hit anywhere — advance up to 3 tiles toward any node.",
    category: "weapon",
    price: 800,
    acquisition: ["shop"],
    boardEffect: { kind: "hit_anywhere", steps: 3 },
    icon: "/weapons/Operator.png",
  },
  {
    id: "wire-cutter",
    name: "Wire Cutter",
    description: "Spike defuse — +1 to your defuse dice total.",
    category: "agent",
    sourceAgent: "Killjoy",
    price: 250,
    acquisition: ["shop", "event"],
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
    acquisition: ["shop"],
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
    acquisition: ["shop", "event"],
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

export const shopItems = itemRegistry.filter((item) =>
  item.acquisition.includes("shop")
);

export const blackMarketItems = itemRegistry.filter((item) =>
  item.acquisition.includes("black_market")
);
