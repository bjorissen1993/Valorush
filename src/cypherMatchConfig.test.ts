import { describe, expect, it } from "vitest";
import {
  applyCypherMatchOverride,
  validateCypherTeamAssignment,
  type CypherMatchConfig,
} from "../shared/customMatches/cypherOverride";
import type { ScheduledCustomMatch } from "../shared/customMatches/types";
import { TDM_WEAPON_TIERS, TDM_EXCLUDED_WEAPONS } from "../shared/customMatches/weaponTiers";

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
      modeId: "retake",
      attackerIndex: 1,
      defenderIndices: [0, 2, 3],
      weaponRule: "locked_tier",
      weaponTier: 3,
    };
    const next = applyCypherMatchOverride(base, config);
    expect(next.mapId).toBe("Ascent");
    expect(next.matchId).toBe("retake");
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
});
