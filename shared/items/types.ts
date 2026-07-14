/** Collectible board items — agent gadgets and weapon modifiers. */

export type ItemCategory = "agent" | "weapon";

export type ItemAcquisition = "shop" | "event" | "minigame" | "black_market";

export type BoardItemEffect =
  | { kind: "dice_bonus"; amount: number }
  | { kind: "steal_creds"; amount: number }
  | { kind: "swap_position"; targetPlayerIndex: number }
  | { kind: "hit_anywhere"; steps: number }
  | { kind: "spike_wire_cutter"; bonus: number }
  | { kind: "spike_stim_reroll" }
  | { kind: "spike_owl_preview" }
  | { kind: "spike_ultimate"; bonus: number };

export type ItemDefinition = {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  sourceAgent?: string;
  price: number;
  acquisition: ItemAcquisition[];
  /** Board or spike defuse effect when used. */
  boardEffect?: BoardItemEffect;
  icon?: string;
};
