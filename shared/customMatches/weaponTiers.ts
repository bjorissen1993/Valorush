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

export const TDM_EXCLUDED_WEAPONS = ["Operator", "Odin"] as const;

export const TDM_TIER_COUNT = TDM_WEAPON_TIERS.length;

export type CypherWeaponRule = "full_progression" | "start_tier" | "locked_tier";

export const CYPHER_WEAPON_RULE_LABELS: Record<CypherWeaponRule, string> = {
  full_progression: "Full Progression",
  start_tier: "Starting Tier",
  locked_tier: "Tier Lock",
};

export const CYPHER_WEAPON_RULE_HINTS: Record<CypherWeaponRule, string> = {
  full_progression:
    "Start at Tier 1 and unlock higher tiers like Team Deathmatch.",
  start_tier: "Begin unlocked through the selected tier, then progress upward.",
  locked_tier: "Only weapons from the selected tier — no progression.",
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
  const tier = clampTdmWeaponTier(weaponTier);
  const tierName = getTdmWeaponTier(tier)?.name ?? `Tier ${tier}`;
  switch (rule) {
    case "full_progression":
      return "TDM full progression (Tier 1 → 4)";
    case "start_tier":
      return `Start at ${tierName} (Tier ${tier})`;
    case "locked_tier":
      return `Locked to ${tierName} (Tier ${tier})`;
  }
}
