import { getCustomMatchDefinition } from "./registry";
import type { CustomMatchId, ScheduledCustomMatch } from "./types";
import {
  clampTdmWeaponTier,
  type CypherWeaponRule,
} from "./weaponTiers";

export type CypherMatchup = "free_for_all" | "2v2" | "1v3";

/** Payload from Cypher Neural Theft match configurator. */
export type CypherMatchConfig = {
  matchup: CypherMatchup;
  /** Registry custom-match id (gamemode). */
  modeId: CustomMatchId;
  /** 2v2 roster — every player index exactly once across both teams. */
  teamAlpha?: number[];
  teamBravo?: number[];
  /** 1v3 roster — solo attacker vs defenders. */
  attackerIndex?: number;
  defenderIndices?: number[];
  /** "all" = full arsenal; "tier" = locked to weaponTier only. */
  weaponRule: CypherWeaponRule;
  /** Tier 1–4 when weaponRule is "tier" (ignored for "all"). */
  weaponTier: number;
};

export function validateCypherTeamAssignment(
  config: Pick<
    CypherMatchConfig,
    | "matchup"
    | "teamAlpha"
    | "teamBravo"
    | "attackerIndex"
    | "defenderIndices"
  >,
  playerCount: number
): string | null {
  if (playerCount <= 0) return "No players to assign.";
  const expected = Array.from({ length: playerCount }, (_, i) => i);

  if (config.matchup === "free_for_all") {
    return null;
  }

  if (config.matchup === "2v2") {
    const alpha = config.teamAlpha ?? [];
    const bravo = config.teamBravo ?? [];
    const combined = [...alpha, ...bravo];
    if (combined.length !== playerCount) {
      return "Assign every player to Team A or Team B.";
    }
    if (new Set(combined).size !== playerCount) {
      return "Each player can only be on one team.";
    }
    if (!expected.every((index) => combined.includes(index))) {
      return "Assign every player to Team A or Team B.";
    }
    if (alpha.length === 0 || bravo.length === 0) {
      return "Both teams need at least one player.";
    }
    if (alpha.length > 2 || bravo.length > 2) {
      return "Each team can have at most 2 players.";
    }
    return null;
  }

  // 1v3
  if (config.attackerIndex == null) {
    return "Assign a Solo attacker.";
  }
  const defenders = config.defenderIndices ?? [];
  if (defenders.length > 3) {
    return "The Team of 3 can have at most 3 players.";
  }
  const combined = [config.attackerIndex, ...defenders];
  if (combined.length !== playerCount) {
    return "Assign every player to Solo or the Team of 3.";
  }
  if (new Set(combined).size !== playerCount) {
    return "Each player can only be assigned once.";
  }
  if (!expected.every((index) => combined.includes(index))) {
    return "Assign every player to Solo or the Team of 3.";
  }
  return null;
}

/** Apply Cypher override to the next custom match — map is never changed. */
export function applyCypherMatchOverride(
  match: ScheduledCustomMatch,
  config: CypherMatchConfig
): ScheduledCustomMatch {
  const definition = getCustomMatchDefinition(config.modeId);
  const modeId = definition?.id ?? config.modeId;
  const weaponRule = config.weaponRule === "tier" ? "tier" : "all";
  const weaponTier =
    weaponRule === "tier" ? clampTdmWeaponTier(config.weaponTier) : 1;

  const next: ScheduledCustomMatch = {
    ...match,
    matchId: modeId,
    // Map stays as scheduled — Cypher cannot change it.
    mapId: match.mapId,
    weaponRule,
    weaponTier,
    teamAlpha: undefined,
    teamBravo: undefined,
    attackerIndex: undefined,
    defenderIndices: undefined,
  };

  if (config.matchup === "2v2") {
    next.teamAlpha = [...(config.teamAlpha ?? [])];
    next.teamBravo = [...(config.teamBravo ?? [])];
  } else if (config.matchup === "1v3") {
    next.attackerIndex = config.attackerIndex;
    next.defenderIndices = [...(config.defenderIndices ?? [])];
  }

  return next;
}

export function cypherOverrideHasFixedTeams(config: CypherMatchConfig): boolean {
  return config.matchup === "2v2" || config.matchup === "1v3";
}
