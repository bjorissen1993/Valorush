import type { CustomMatchId } from "./types";

/**
 * Modes with fixed or automatic weapon rules — Cypher has no weapon picker.
 * - escalation: built-in weapon progression
 * - team-deathmatch: native TDM tier-to-tier unlocks
 * - spike-rush: random weapons each round
 */
const CYPHER_WEAPON_CONFIG_DISABLED = new Set<CustomMatchId>([
  "escalation",
  "team-deathmatch",
  "spike-rush",
]);

/** True when Neural Theft should show the weapons / tier UI for this mode. */
export function cypherModeAllowsWeaponConfig(modeId: CustomMatchId): boolean {
  return !CYPHER_WEAPON_CONFIG_DISABLED.has(modeId);
}
