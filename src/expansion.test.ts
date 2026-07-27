import { describe, expect, it } from "vitest";
import {
  boardLayout,
  DEFAULT_MID_ROAD_MODE,
  getNodeExits,
  migrateBoardPosition,
  toggleMidRoadMode,
} from "./game/boardLayout";
import { validateBoardGraph } from "./game/boardValidator";
import { stealCredits, rollNormalTileCredits, PORTAL_CREDIT_COST } from "./game/economy";
import { computeFinalMovement, rollDice, DEFAULT_DICE_COUNT } from "./game/diceSystem";
import { getPlayerTokenPosition } from "./game/tokenLayout";
import { tileIdsInArea, AREA_RADIUS } from "./game/ultimates/areaTargeting";
import { getNodeById } from "./game/boardLayout";

describe("expansion board", () => {
  it("has ~50–70 tiles with no split/merge types", () => {
    expect(boardLayout.length).toBeGreaterThanOrEqual(50);
    expect(boardLayout.length).toBeLessThanOrEqual(70);
    expect(boardLayout.every((n) => n.type !== ("split" as never))).toBe(true);
    expect(boardLayout.every((n) => n.type !== ("merge" as never))).toBe(true);
    expect(boardLayout.some((n) => n.type === "start")).toBe(true);
    expect(boardLayout.some((n) => n.type === "portal")).toBe(true);
    expect(boardLayout.some((n) => n.type === "button")).toBe(true);
    expect(boardLayout.some((n) => n.type === "lucky")).toBe(true);
    expect(boardLayout.some((n) => n.type === "risk")).toBe(true);
    expect(boardLayout.some((n) => n.type === "ult-orb")).toBe(true);
    // Branching exists under at least one mid-road mode
    expect(
      boardLayout.some((n) => getNodeExits(n.id, DEFAULT_MID_ROAD_MODE).length > 1)
    ).toBe(true);
  });

  it("passes graph validation in both mid-road modes", () => {
    const report = validateBoardGraph();
    expect(report.ok, JSON.stringify(report.issues, null, 2)).toBe(true);
    expect(report.modeReports.vertical_in.reachable).toBe(report.nodeCount);
    expect(report.modeReports.horizontal_in.reachable).toBe(report.nodeCount);
  });

  it("toggles mid-road directions so hub always has an exit", () => {
    const modeA = DEFAULT_MID_ROAD_MODE;
    const modeB = toggleMidRoadMode(modeA);
    const exitsA = getNodeExits("hub", modeA);
    const exitsB = getNodeExits("hub", modeB);
    expect(exitsA.length).toBe(2);
    expect(exitsB.length).toBe(2);
    // Mode A: horizontal out; Mode B: vertical out
    expect(exitsA.sort()).toEqual(["de", "dw"].sort());
    expect(exitsB.sort()).toEqual(["dn", "ds"].sort());
    // Outer north entry only in vertical_in
    expect(getNodeExits("ot5", modeA)).toContain("mn1");
    expect(getNodeExits("ot5", modeB)).not.toContain("mn1");
  });

  it("migrates legacy positions", () => {
    expect(migrateBoardPosition("top-split")).toBe("ot5");
    expect(migrateBoardPosition("m-top-2")).toBe("mn2");
    expect(migrateBoardPosition("inner-ne")).toBe("de");
    expect(migrateBoardPosition("unknown-xyz")).toBe("start");
    expect(migrateBoardPosition("start")).toBe("start");
  });

  it("prices portals fairly", () => {
    expect(PORTAL_CREDIT_COST).toBe(400);
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
    expect([...amounts].every((a) => [300, 400, 500].includes(a))).toBe(true);
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
    const a = getPlayerTokenPosition({ id: "ot1", x: 10, y: 10 }, 0, 3);
    const b = getPlayerTokenPosition({ id: "ot1", x: 10, y: 10 }, 2, 3);
    expect(a.offsetXPercent).not.toBe(b.offsetXPercent);
    expect(a.offsetYPercent).toBeGreaterThan(0);
  });
});

describe("area targeting", () => {
  it("counts partial tile hits as full", () => {
    const hub = getNodeById("hub");
    expect(hub).toBeTruthy();
    const ids = tileIdsInArea({
      center: { x: hub!.x, y: hub!.y },
      radius: AREA_RADIUS.viper,
    });
    expect(ids).toContain("hub");
    // Wider cast should also catch adjacent door tiles on the cross.
    const wide = tileIdsInArea({
      center: { x: hub!.x, y: hub!.y },
      radius: Math.max(AREA_RADIUS.viper, 14),
    });
    expect(wide.length).toBeGreaterThan(1);
    expect(wide).toContain("dn");
  });
});

describe("board planarity", () => {
  it("has no visual road crossings between unconnected edges", () => {
    const report = validateBoardGraph();
    const crossings = report.issues.filter((i) => i.code === "visual_crossing");
    expect(crossings, JSON.stringify(crossings, null, 2)).toEqual([]);
  });
});
