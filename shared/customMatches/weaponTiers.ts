/**
 * Valorant Team Deathmatch–style weapon progression tiers for Cypher Neural Theft.
 * Operator and Odin are intentionally excluded.
 */

export type TdmWeaponName =
  | "Classic"
  | "Shorty"
  | "Frenzy"
  | "Ghost"
  | "Bandit"
  | "Sheriff"
  | "Stinger"
  | "Spectre"
  | "Bucky"
  | "Judge"
  | "Bulldog"
  | "Guardian"
  | "Phantom"
  | "Vandal"
  | "Marshal"
  | "Outlaw"
  | "Ares";

export type TdmWeaponTier = {
  tier: number;
  name: string;
  description: string;
  weapons: TdmWeaponName[];
};

/** Escalating unlock tiers mirroring TDM feel (no Operator / Odin). */
export const TDM_WEAPON_TIERS: TdmWeaponTier[] = [
  {
    tier: 1,
    name: "Sidearms",
    description: "Open with pistols — Classic through Sheriff.",
    weapons: ["Classic", "Shorty", "Frenzy", "Ghost", "Bandit", "Sheriff"],
  },
  {
    tier: 2,
    name: "SMGs & Light",
    description: "Close-range pressure and light utility.",
    weapons: ["Stinger", "Spectre", "Bucky", "Marshal"],
  },
  {
    tier: 3,
    name: "Mid-tier",
    description: "Bulldogs, Guardians, heavy shotguns, LMGs.",
    weapons: ["Bulldog", "Guardian", "Judge", "Ares"],
  },
  {
    tier: 4,
    name: "Rifles & Precision",
    description: "Full rifles and Outlaw — no Operator or Odin.",
    weapons: ["Phantom", "Vandal", "Outlaw"],
  },
];

/** Representative weapon icon shown on each Cypher tier button. */
export const TDM_TIER_REPRESENTATIVE_ICON: Record<number, string> = {
  1: "/weapons/Sheriff_icon.png",
  2: "/weapons/Spectre_icon.png",
  3: "/weapons/Guardian_icon.png",
  4: "/weapons/Vandal_icon.png",
};

export const TDM_EXCLUDED_WEAPONS = ["Operator", "Odin"] as const;

export const TDM_TIER_COUNT = TDM_WEAPON_TIERS.length;

/** Mutually exclusive Cypher weapon choice: full arsenal, or a single locked tier. */
export type CypherWeaponRule = "all" | "tier";

export const CYPHER_WEAPON_RULE_LABELS: Record<CypherWeaponRule, string> = {
  all: "All Weapons",
  tier: "Tier Lock",
};

export const CYPHER_WEAPON_RULE_HINTS: Record<CypherWeaponRule, string> = {
  all: "Full arsenal — no tier restriction (Operator and Odin still excluded).",
  tier: "Only weapons from the selected tier — no progression.",
};

export function getTdmWeaponTier(tier: number): TdmWeaponTier | undefined {
  return TDM_WEAPON_TIERS.find((entry) => entry.tier === tier);
}

export function clampTdmWeaponTier(tier: number): number {
  if (!Number.isFinite(tier)) return 1;
  return Math.min(TDM_TIER_COUNT, Math.max(1, Math.floor(tier)));
}

export function describeCypherWeaponRule(
  rule: CypherWeaponRule,
  weaponTier: number
): string {
  if (rule === "all") {
    return "All weapons (no restriction)";
  }
  const tier = clampTdmWeaponTier(weaponTier);
  const tierName = getTdmWeaponTier(tier)?.name ?? `Tier ${tier}`;
  return `Locked to ${tierName} (Tier ${tier})`;
}
