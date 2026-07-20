import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  applyUltimate,
  canActivateUltimate,
  collectConnectedZone,
  gainOrb,
  spendUltimate,
  getSelectableEdgesForUltimate,
  getSelectableTileIdsForUltimate,
  moveTowardNode,
} from "./game/ultimates";
import {
  createEmptyBoardUltimateState,
  createEmptyPlayerUltimateStatus,
  getUltimateForAgent,
  listPlayableUltimates,
  normalizeAgentLookupKey,
  ultimateRegistry,
  ULTIMATE_BOARD_PATHS,
} from "../shared/ultimates";
import type { UltimatePlayerState } from "../shared/ultimates";
import { getBoardNodeIds } from "./game/boardEventBridge";

function player(
  overrides: Partial<UltimatePlayerState> & { name: string }
): UltimatePlayerState {
  return {
    id: 1,
    slotIndex: 0,
    position: "start",
    creds: 800,
    radianitePoints: 0,
    items: ["stim-beacon"],
    ultimateOrbs: 3,
    status: createEmptyPlayerUltimateStatus(),
    movementBonus: 0,
    movementBonusTurns: 0,
    maxStepsPerTurn: null,
    maxStepsTurns: 0,
    ...overrides,
  };
}

function baseInput(
  agentName: string,
  extras: Partial<Parameters<typeof applyUltimate>[0]> = {}
) {
  const players = [
    player({ name: "Caster", id: 1, slotIndex: 0 }),
    player({
      name: "Opponent",
      id: 2,
      slotIndex: 1,
      ultimateOrbs: 2,
      position: "top-1",
      creds: 900,
    }),
  ];
  return {
    casterPlayerIndex: 0,
    agentName,
    players,
    board: createEmptyBoardUltimateState(),
    boardNodeIds: getBoardNodeIds(),
    adjacency: {},
    paths: ULTIMATE_BOARD_PATHS,
    currentRound: 1,
    ...extras,
  };
}

describe("ultimate orbs", () => {
  it("caps at 3 and spends to 0 when ready", () => {
    expect(gainOrb(2, 1)).toBe(3);
    expect(gainOrb(3, 1)).toBe(3);
    expect(canActivateUltimate(3)).toBe(true);
    expect(spendUltimate(3)).toBe(0);
    expect(spendUltimate(2)).toBe(2);
  });
});

describe("agent ultimate lookup", () => {
  it("resolves KAY/O name variants", () => {
    expect(normalizeAgentLookupKey("KAY/O")).toBe("kayo");
    expect(getUltimateForAgent("KAY/O")?.id).toBe("null-cmd");
    expect(getUltimateForAgent("Kayo")?.id).toBe("null-cmd");
    expect(getUltimateForAgent("kay-o")?.id).toBe("null-cmd");
  });

  it("resolves every registry agent including former stubs", () => {
    for (const ult of ultimateRegistry) {
      expect(getUltimateForAgent(ult.agentName)?.id).toBe(ult.id);
      expect(ult.implementation).toBe("full");
      expect(ult.icon, `${ult.agentName} missing icon`).toBeTruthy();
    }
  });

  it("maps every playable ultimate to an existing ability PNG", () => {
    const playable = listPlayableUltimates();
    expect(playable).toHaveLength(27);
    const publicRoot = path.resolve(process.cwd(), "public");
    for (const ult of playable) {
      expect(ult.icon, `${ult.agentName} missing icon`).toBeTruthy();
      expect(ult.icon).toMatch(/^\/abilities\//);
      const filePath = path.join(publicRoot, ult.icon!.replace(/^\//, ""));
      expect(existsSync(filePath), `missing file ${ult.icon}`).toBe(true);
    }
  });
});

describe("applyUltimate — all playable agents", () => {
  it("applies instant / self ultimates", () => {
    const cases: { agent: string; headline: string }[] = [
      { agent: "Phoenix", headline: "Run It Back" },
      { agent: "Jett", headline: "Blade Storm" },
      { agent: "Reyna", headline: "Empress" },
      { agent: "Breach", headline: "Rolling Thunder" },
      { agent: "Skye", headline: "Seekers" },
      { agent: "Yoru", headline: "Dimensional Drift" },
      { agent: "KAY/O", headline: "NULL/CMD" },
      { agent: "Neon", headline: "Overdrive" },
      { agent: "Fade", headline: "Nightfall" },
      { agent: "Clove", headline: "Not Dead Yet" },
    ];
    for (const { agent, headline } of cases) {
      const result = applyUltimate(baseInput(agent));
      expect(result.incomplete, agent).toBeFalsy();
      expect(result.stub, agent).toBeFalsy();
      expect(result.headline, agent).toBe(headline);
      expect(result.players[0]?.ultimateOrbs, agent).toBe(0);
    }
  });

  it("applies tile / path / edge / player / choice ultimates", () => {
    expect(
      applyUltimate(baseInput("Brimstone", { targetNodeId: "top-2" })).headline
    ).toBe("Orbital Strike");
    expect(
      applyUltimate(baseInput("Viper", { targetNodeId: "right-2" })).board
        .poisonClouds[0]?.nodeId
    ).toBe("right-2");
    {
      const existing = createEmptyBoardUltimateState();
      existing.poisonClouds = [
        { nodeId: "top-1", roundsLeft: 1, ownerPlayerIndex: 0 },
      ];
      const viper = applyUltimate(
        baseInput("Viper", {
          targetNodeId: "right-2",
          board: existing,
          players: [
            player({ name: "V", position: "right-2", ultimateOrbs: 3 }),
            player({ name: "O", position: "top-1", ultimateOrbs: 0 }),
          ],
        })
      );
      expect(viper.board.poisonClouds).toEqual([
        {
          nodeId: "right-2",
          roundsLeft: 1,
          ownerPlayerIndex: 0,
        },
      ]);
      expect(viper.players[0]?.status.inViperPit).toBe(true);
      expect(viper.players[1]?.status.inViperPit).toBe(false);
    }
    expect(
      applyUltimate(baseInput("Omen", { targetNodeId: "bottom-1" }))
        .omenMiniMoveSteps
    ).toBe(3);
    expect(
      applyUltimate(
        baseInput("Killjoy", {
          opponentChoices: { 1: "pay" },
        })
      ).headline
    ).toBe("Lockdown");
    expect(
      applyUltimate(
        baseInput("Cypher", {
          targetPlayerIndex: 1,
          stealFromPlayerIndex: 1,
        })
      ).cypherReveal?.players.length
    ).toBe(1);
    expect(
      applyUltimate(
        baseInput("Sova", { choiceId: "top-row", targetNodeId: "top-row" })
      ).headline
    ).toBe("Hunter's Fury");
    expect(
      applyUltimate(baseInput("Sage", { choiceId: "extra-turn" })).players[0]
        ?.status.extraTurnPending
    ).toBe(true);
    expect(
      applyUltimate(
        baseInput("Raze", {
          targetPlayerIndex: 1,
          razeMode: "creds",
          choiceId: "creds",
        })
      ).players[1]?.creds
    ).toBe(300);
    expect(
      applyUltimate(
        baseInput("Astra", {
          targetNodeId: "start",
          targetNodeId2: "top-1",
        })
      ).board.walls[0]?.fromNodeId
    ).toBe("start");
    expect(
      applyUltimate(
        baseInput("Chamber", {
          targetPlayerIndex: 1,
          diceRolls: [6, 1],
        })
      ).chamberDuel?.winnerPlayerIndex
    ).toBe(0);
    expect(
      applyUltimate(baseInput("Vyse", { targetNodeId: "left-2" })).board.traps[0]
        ?.armed
    ).toBe(true);
  });

  it("applies formerly stubbed lobby agents", () => {
    expect(
      applyUltimate(
        baseInput("Harbor", { choiceId: "top-row", targetNodeId: "top-row" })
      ).headline
    ).toBe("Reckoning");
    expect(
      applyUltimate(baseInput("Gekko", { targetNodeId: "right-2" })).board
        .detainZones[0]?.nodeId
    ).toBe("right-2");
    const annihilation = applyUltimate(
      baseInput("Deadlock", { targetPlayerIndex: 1 })
    );
    expect(annihilation.incomplete).toBeFalsy();
    expect(annihilation.headline).toBe("Annihilation");
    expect(annihilation.players[0]!.creds).toBeGreaterThan(800);
    expect(
      applyUltimate(
        baseInput("Iso", {
          targetPlayerIndex: 1,
          diceRolls: [6, 1],
        })
      ).players[0]?.creds
    ).toBe(1200);
    expect(
      applyUltimate(baseInput("Tejo", { targetNodeId: "top-1" })).headline
    ).toBe("Armageddon");
    expect(
      applyUltimate(
        baseInput("Waylay", { choiceId: "bottom-row", targetNodeId: "bottom-row" })
      ).headline
    ).toBe("Saturating Fire");
  });

  it("does not spend orbs when targeting is incomplete", () => {
    const cases = [
      "Viper",
      "Sova",
      "Astra",
      "Chamber",
      "Harbor",
      "Gekko",
      "Deadlock",
      "Tejo",
      "Waylay",
    ];
    for (const agent of cases) {
      const result = applyUltimate(baseInput(agent));
      expect(result.incomplete, agent).toBe(true);
      expect(result.players[0]?.ultimateOrbs, agent).toBe(3);
    }
  });

  it("does not spend orbs for unknown agents", () => {
    const result = applyUltimate(baseInput("Unknown Agent X"));
    expect(result.incomplete).toBe(true);
    expect(result.players[0]?.ultimateOrbs).toBe(3);
  });
});

describe("ultimate board helpers", () => {
  it("exposes selectable tiles and edges for board ultimates", () => {
    expect(getSelectableTileIdsForUltimate("tile").length).toBeGreaterThan(10);
    expect(getSelectableTileIdsForUltimate("path").length).toBeGreaterThan(5);
    expect(getSelectableEdgesForUltimate("edge").length).toBeGreaterThan(5);
    expect(getSelectableEdgesForUltimate("tile")).toEqual([]);
  });

  it("pulls toward a destination and builds connected zones", () => {
    expect(moveTowardNode("bottom-1", "start", 3)).not.toBe("bottom-1");
    expect(collectConnectedZone("top-2", 3).size).toBe(3);
  });
});
