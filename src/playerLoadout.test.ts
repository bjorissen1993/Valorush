import { describe, expect, it } from "vitest";
import {
  computeEffectiveRoll,
  consumeOneShotMovementBonus,
  normalizePlayerLoadout,
  tickMovementModifiers,
} from "./game/boardEventBridge";
import type { PlayerInGame } from "./types/Game";

function basePlayer(overrides: Partial<PlayerInGame> = {}): PlayerInGame {
  return {
    id: 1,
    slotIndex: 0,
    name: "Test",
    position: "start",
    creds: 800,
    radianitePoints: 0,
    primaryWeapon: null,
    secondaryWeapon: null,
    weapon: null,
    shield: null,
    nextWeaponDiscount: 0,
    items: [],
    movementBonus: 0,
    movementBonusTurns: 0,
    maxStepsPerTurn: null,
    maxStepsTurns: 0,
    ultimateOrbs: 0,
    ultimateStatus: {
      reynaBuffRounds: 0,
      yoruDriftRounds: 0,
      cloveShield: false,
      movementPenalty: 0,
      movementPenaltyTurns: 0,
      neonOverdrive: false,
      phoenixRunItBack: false,
      turnStartPosition: null,
      itemsLockedTurns: 0,
      skipNextTurn: false,
      extraTurnPending: false,
      inViperPit: false,
    },
    ...overrides,
  };
}

describe("movement bonus", () => {
  it("adds one-shot bonus to the next roll and clears it", () => {
    const player = basePlayer({ movementBonus: 1, movementBonusTurns: 0 });
    expect(computeEffectiveRoll(4, player)).toBe(5);
    expect(consumeOneShotMovementBonus(player).movementBonus).toBe(0);
  });

  it("keeps multi-turn bonuses until turns expire", () => {
    const player = basePlayer({ movementBonus: 2, movementBonusTurns: 2 });
    expect(computeEffectiveRoll(3, player)).toBe(5);
    expect(consumeOneShotMovementBonus(player).movementBonus).toBe(2);
    const afterTick = tickMovementModifiers(player);
    expect(afterTick.movementBonusTurns).toBe(1);
    expect(afterTick.movementBonus).toBe(2);
  });
});

describe("normalizePlayerLoadout", () => {
  it("migrates legacy weapon into primaryWeapon", () => {
    const normalized = normalizePlayerLoadout({
      weapon: "Vandal",
      shield: "Light Shields",
    });
    expect(normalized.primaryWeapon).toBe("Vandal");
    expect(normalized.secondaryWeapon).toBeNull();
    expect(normalized.weapon).toBe("Vandal");
  });

  it("preserves primary and secondary when both set", () => {
    const normalized = normalizePlayerLoadout({
      primaryWeapon: "Phantom",
      secondaryWeapon: "Ghost",
      weapon: "Classic",
    });
    expect(normalized.primaryWeapon).toBe("Phantom");
    expect(normalized.secondaryWeapon).toBe("Ghost");
  });
});
