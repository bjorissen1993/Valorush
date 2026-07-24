import { describe, expect, it } from "vitest";
import { boardLayout, migrateBoardPosition } from "./game/boardLayout";
import { validateBoardGraph } from "./game/boardValidator";
import { stealCredits, rollNormalTileCredits } from "./game/economy";
import { computeFinalMovement, rollDice, DEFAULT_DICE_COUNT } from "./game/diceSystem";
import { getPlayerTokenPosition } from "./game/tokenLayout";
import { tileIdsInArea, AREA_RADIUS } from "./game/ultimates/areaTargeting";
import { getNodeById } from "./game/boardLayout";

describe("expansion board", () => {
  it("has ~47–54 tiles with no split/merge types", () => {
    expect(boardLayout.length).toBeGreaterThanOrEqual(47);
    expect(boardLayout.length).toBeLessThanOrEqual(54);
    expect(boardLayout.every((n) => n.type !== ("split" as never))).toBe(true);
    expect(boardLayout.every((n) => n.type !== ("merge" as never))).toBe(true);
    expect(boardLayout.some((n) => n.next.length > 1)).toBe(true);
  });

  it("passes graph validation", () => {
    const report = validateBoardGraph();
    expect(report.ok, JSON.stringify(report.issues, null, 2)).toBe(true);
  });

  it("migrates legacy positions", () => {
    expect(migrateBoardPosition("top-split")).toBe("o4");
    expect(migrateBoardPosition("unknown-xyz")).toBe("start");
    expect(migrateBoardPosition("start")).toBe("start");
  });
});

describe("economy", () => {
  it("never steals more than available", () => {
    const result = stealCredits(200, 100, 500);
    expect(result.intended).toBe(500);
    expect(result.actual).toBe(200);
    expect(result.fromCredsAfter).toBe(0);
    expect(result.toCredsAfter).toBe(300);
  });

  it("rolls normal tile credits from the weighted table", () => {
    const amounts = new Set<number>();
    for (let i = 0; i < 200; i += 1) {
      amounts.add(rollNormalTileCredits(() => i / 200));
    }
    expect([...amounts].every((a) => [300, 500, 1000].includes(a))).toBe(true);
  });
});

describe("dice & movement", () => {
  it("defaults to 2 dice and clamps final movement at 0", () => {
    expect(DEFAULT_DICE_COUNT).toBe(2);
    const roll = rollDice(2, 6, () => 0);
    expect(roll.dice).toEqual([1, 1]);
    expect(computeFinalMovement(3, { bonuses: 1, debuffs: 10 })).toBe(0);
    expect(computeFinalMovement(4, { doubleMovement: true })).toBe(8);
  });
});

describe("token stacking", () => {
  it("fans tokens around the bottom of the circle", () => {
    const a = getPlayerTokenPosition({ id: "o1", x: 10, y: 10 }, 0, 3);
    const b = getPlayerTokenPosition({ id: "o1", x: 10, y: 10 }, 2, 3);
    expect(a.offsetXPercent).not.toBe(b.offsetXPercent);
    expect(a.offsetYPercent).toBeGreaterThan(0);
  });
});

describe("area targeting", () => {
  it("counts partial tile hits as full", () => {
    const hub = getNodeById("inner-ne");
    expect(hub).toBeTruthy();
    const ids = tileIdsInArea({
      center: { x: hub!.x, y: hub!.y },
      radius: AREA_RADIUS.viper,
    });
    expect(ids.length).toBeGreaterThan(1);
    expect(ids).toContain("inner-ne");
  });
});

describe("board planarity", () => {
  it("has no visual road crossings between unconnected edges", () => {
    const report = validateBoardGraph();
    const crossings = report.issues.filter((i) => i.code === "visual_crossing");
    expect(crossings, JSON.stringify(crossings, null, 2)).toEqual([]);
  });
});
