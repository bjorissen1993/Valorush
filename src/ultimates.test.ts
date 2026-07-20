import { describe, expect, it } from "vitest";
import {
  applyUltimate,
  canActivateUltimate,
  gainOrb,
  spendUltimate,
  getSelectableEdgesForUltimate,
  getSelectableTileIdsForUltimate,
} from "./game/ultimates";
import {
  createEmptyBoardUltimateState,
  createEmptyPlayerUltimateStatus,
  getUltimateForAgent,
  listPlayableUltimates,
  normalizeAgentLookupKey,
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

  it("maps every playable ultimate to an ability icon path", () => {
    const playable = listPlayableUltimates();
    expect(playable).toHaveLength(21);
    for (const ult of playable) {
      expect(ult.icon, `${ult.agentName} missing icon`).toBeTruthy();
      expect(ult.icon).toMatch(/^\/abilities\//);
    }
  });
});

describe("applyUltimate — all 21 playable agents", () => {
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

  it("does not spend orbs when targeting is incomplete", () => {
    const result = applyUltimate(baseInput("Viper"));
    expect(result.incomplete).toBe(true);
    expect(result.players[0]?.ultimateOrbs).toBe(3);
  });

  it("does not spend orbs for unknown agents", () => {
    const result = applyUltimate(baseInput("Unknown Agent X"));
    expect(result.incomplete).toBe(true);
    expect(result.players[0]?.ultimateOrbs).toBe(3);
  });

  it("stubs Harbor without crash", () => {
    const result = applyUltimate(baseInput("Harbor"));
    expect(result.stub).toBe(true);
    expect(result.players[0]?.ultimateOrbs).toBe(0);
  });
});

describe("ultimate board targeting helpers", () => {
  it("exposes selectable tiles and edges for board ultimates", () => {
    expect(getSelectableTileIdsForUltimate("tile").length).toBeGreaterThan(10);
    expect(getSelectableTileIdsForUltimate("path").length).toBeGreaterThan(5);
    expect(getSelectableEdgesForUltimate("edge").length).toBeGreaterThan(5);
    expect(getSelectableEdgesForUltimate("tile")).toEqual([]);
  });
});
