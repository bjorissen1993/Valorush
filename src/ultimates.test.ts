import { describe, expect, it } from "vitest";
import {
  applyUltimate,
  canActivateUltimate,
  gainOrb,
  spendUltimate,
} from "./game/ultimates";
import {
  createEmptyBoardUltimateState,
  createEmptyPlayerUltimateStatus,
  ULTIMATE_BOARD_PATHS,
} from "../shared/ultimates";
import type { UltimatePlayerState } from "../shared/ultimates";

function player(
  overrides: Partial<UltimatePlayerState> & { name: string }
): UltimatePlayerState {
  return {
    id: 1,
    slotIndex: 0,
    position: "start",
    creds: 800,
    radianitePoints: 0,
    items: [],
    ultimateOrbs: 3,
    status: createEmptyPlayerUltimateStatus(),
    movementBonus: 0,
    movementBonusTurns: 0,
    maxStepsPerTurn: null,
    maxStepsTurns: 0,
    ...overrides,
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

describe("applyUltimate", () => {
  it("applies Reyna Empress buff", () => {
    const players = [
      player({ name: "Reyna", id: 1, slotIndex: 0 }),
      player({ name: "Jett", id: 2, slotIndex: 1, ultimateOrbs: 0 }),
    ];
    const result = applyUltimate({
      casterPlayerIndex: 0,
      agentName: "Reyna",
      players,
      board: createEmptyBoardUltimateState(),
      boardNodeIds: ["start", "top-1"],
      adjacency: {},
      paths: ULTIMATE_BOARD_PATHS,
      currentRound: 1,
    });
    expect(result.players[0]?.ultimateOrbs).toBe(0);
    expect(result.players[0]?.status.reynaBuffRounds).toBe(3);
    expect(result.headline).toBe("Empress");
  });

  it("stubs Harbor without crash", () => {
    const players = [player({ name: "Harbor", id: 1, slotIndex: 0 })];
    const result = applyUltimate({
      casterPlayerIndex: 0,
      agentName: "Harbor",
      players,
      board: createEmptyBoardUltimateState(),
      boardNodeIds: ["start"],
      adjacency: {},
      paths: ULTIMATE_BOARD_PATHS,
      currentRound: 1,
    });
    expect(result.stub).toBe(true);
    expect(result.players[0]?.ultimateOrbs).toBe(0);
  });
});
