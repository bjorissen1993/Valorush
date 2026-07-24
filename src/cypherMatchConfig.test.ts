import { describe, expect, it } from "vitest";
import {
  applyCypherMatchOverride,
  validateCypherTeamAssignment,
  type CypherMatchConfig,
} from "../shared/customMatches/cypherOverride";
import { placeCypherPlayer } from "../shared/customMatches/cypherTeamPlacement";
import { customMatchById } from "../shared/customMatches/registry";
import type { ScheduledCustomMatch } from "../shared/customMatches/types";
import { TDM_WEAPON_TIERS, TDM_EXCLUDED_WEAPONS } from "../shared/customMatches/weaponTiers";
import { cypherModeAllowsWeaponConfig } from "../shared/customMatches/weaponConfig";

describe("Cypher match override", () => {
  it("validates 2v2 assignments cover every player once", () => {
    expect(
      validateCypherTeamAssignment(
        {
          matchup: "2v2",
          teamAlpha: [0, 1],
          teamBravo: [2, 3],
        },
        4
      )
    ).toBeNull();
    expect(
      validateCypherTeamAssignment(
        {
          matchup: "2v2",
          teamAlpha: [0, 1],
          teamBravo: [1, 2],
        },
        4
      )
    ).toMatch(/one team/i);
    expect(
      validateCypherTeamAssignment(
        {
          matchup: "2v2",
          teamAlpha: [0, 1, 2],
          teamBravo: [3],
        },
        4
      )
    ).toMatch(/at most 2/i);
  });

  it("validates 1v3 solo vs squad", () => {
    expect(
      validateCypherTeamAssignment(
        {
          matchup: "1v3",
          attackerIndex: 2,
          defenderIndices: [0, 1, 3],
        },
        4
      )
    ).toBeNull();
    expect(
      validateCypherTeamAssignment(
        {
          matchup: "1v3",
          attackerIndex: 0,
          defenderIndices: [1, 2],
        },
        4
      )
    ).toMatch(/every player/i);
  });

  it("applies mode and teams but keeps the map", () => {
    const base: ScheduledCustomMatch = {
      matchId: "spike-rush",
      mapId: "Ascent",
      scheduledAtRound: 3,
      status: "scheduled",
      participants: ["A", "B", "C", "D"],
      teamAlpha: [0, 1],
      teamBravo: [2, 3],
    };
    const config: CypherMatchConfig = {
      matchup: "1v3",
      modeId: "standard",
      attackerIndex: 1,
      defenderIndices: [0, 2, 3],
      weaponRule: "locked_tier",
      weaponTier: 3,
    };
    const next = applyCypherMatchOverride(base, config);
    expect(next.mapId).toBe("Ascent");
    expect(next.matchId).toBe("standard");
    expect(next.attackerIndex).toBe(1);
    expect(next.defenderIndices).toEqual([0, 2, 3]);
    expect(next.teamAlpha).toBeUndefined();
    expect(next.weaponRule).toBe("locked_tier");
    expect(next.weaponTier).toBe(3);
  });

  it("excludes Operator and Odin from TDM tiers", () => {
    const all = TDM_WEAPON_TIERS.flatMap((tier) => tier.weapons);
    for (const banned of TDM_EXCLUDED_WEAPONS) {
      expect(all).not.toContain(banned);
    }
    expect(TDM_WEAPON_TIERS).toHaveLength(4);
  });

  it("lists Retake and All Random One Site under 2v2", () => {
    expect(customMatchById.get("retake")?.category).toBe("2v2");
    expect(customMatchById.get("all-random-one-site")?.category).toBe("2v2");
  });

  it("hides weapon UI for fixed-weapon modes and shows it for configurable ones", () => {
    expect(cypherModeAllowsWeaponConfig("escalation")).toBe(false);
    expect(cypherModeAllowsWeaponConfig("team-deathmatch")).toBe(false);
    expect(cypherModeAllowsWeaponConfig("spike-rush")).toBe(false);
    expect(cypherModeAllowsWeaponConfig("deathmatch")).toBe(true);
    expect(cypherModeAllowsWeaponConfig("standard")).toBe(true);
    expect(cypherModeAllowsWeaponConfig("swiftplay")).toBe(true);
    expect(cypherModeAllowsWeaponConfig("retake")).toBe(true);
    expect(cypherModeAllowsWeaponConfig("skirmish")).toBe(true);
    expect(cypherModeAllowsWeaponConfig("all-random-one-site")).toBe(true);
  });
});

describe("Cypher team placement swaps", () => {
  const empty = {
    teamAlpha: [] as number[],
    teamBravo: [] as number[],
    attackerIndex: null as number | null,
    defenderIndices: [] as number[],
  };

  it("swaps oldest 2v2 member to the other team when full", () => {
    const start = {
      ...empty,
      teamAlpha: [0, 1],
      teamBravo: [2],
    };
    const next = placeCypherPlayer(start, 3, "alpha");
    expect(next.teamAlpha).toEqual([1, 3]);
    expect(next.teamBravo).toEqual([2, 0]);
  });

  it("moves between 2v2 teams without exceeding max 2", () => {
    const start = {
      ...empty,
      teamAlpha: [0, 1],
      teamBravo: [2, 3],
    };
    const next = placeCypherPlayer(start, 2, "alpha");
    expect(next.teamAlpha).toEqual([1, 2]);
    expect(next.teamBravo).toEqual([3, 0]);
    expect(next.teamAlpha).toHaveLength(2);
    expect(next.teamBravo).toHaveLength(2);
  });

  it("swaps oldest defender into solo when squad is full", () => {
    const start = {
      ...empty,
      attackerIndex: 0,
      defenderIndices: [1, 2, 3],
    };
    // Move solo onto squad — oldest defender becomes solo.
    const next = placeCypherPlayer(start, 0, "squad");
    expect(next.attackerIndex).toBe(1);
    expect(next.defenderIndices).toEqual([2, 3, 0]);
  });

  it("displaces solo onto defenders and drops oldest when full", () => {
    const start = {
      ...empty,
      attackerIndex: 0,
      defenderIndices: [1, 2, 3],
    };
    // Should not happen with 4 players from pool, but if solo is replaced:
    // re-place player 0 on solo is a no-op path; use a defender onto solo.
    const next = placeCypherPlayer(start, 1, "solo");
    expect(next.attackerIndex).toBe(1);
    expect(next.defenderIndices).toEqual([2, 3, 0]);
  });
});
