import { describe, expect, it } from "vitest";
import {
  boardLayout,
  BOARD_TILE_PITCH,
  BUTTON_TILE_IDS,
  DEFAULT_GATE_STATES,
  GATE_IDS,
  GATE_LABELS,
  getNodeExits,
  migrateBoardPosition,
  toggleGate,
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
    expect(boardLayout.some((n) => n.id === "kingdom")).toBe(true);
    expect(
      boardLayout.some((n) => getNodeExits(n.id, DEFAULT_GATE_STATES).length > 1)
    ).toBe(true);
  });

  it("places START top-left as a one-way entry spur", () => {
    const start = getNodeById("start");
    const entry = getNodeById("entry");
    const land = getNodeById("tl4");
    expect(start).toBeTruthy();
    expect(entry).toBeTruthy();
    expect(land).toBeTruthy();
    expect(start!.x).toBeLessThan(20);
    expect(start!.y).toBeLessThan(15);
    expect(start!.next).toEqual(["entry"]);
    expect(entry!.next).toEqual(["tl4"]);
    // Spur is spatially detached: start is ~1–2 pitches from the circuit.
    const distStartToLand = Math.hypot(start!.x - land!.x, start!.y - land!.y);
    expect(distStartToLand).toBeGreaterThan(BOARD_TILE_PITCH);
    expect(distStartToLand).toBeLessThan(BOARD_TILE_PITCH * 3);
    // Nothing on the board points back at START.
    for (const node of boardLayout) {
      if (node.id === "start") continue;
      expect(node.next.includes("start")).toBe(false);
      expect((node.gateEdges ?? []).some((e) => e.to === "start")).toBe(false);
    }
    // After leaving the corridor, exits never offer START / entry.
    expect(getNodeExits("tl4", DEFAULT_GATE_STATES)).not.toContain("start");
    expect(getNodeExits("tl4", DEFAULT_GATE_STATES)).not.toContain("entry");
    expect(getNodeExits("start", DEFAULT_GATE_STATES)).toContain("entry");
  });

  it("places gate buttons on the playable road (no cul-de-sac stubs)", () => {
    for (const id of BUTTON_TILE_IDS) {
      const btn = getNodeById(id);
      expect(btn, id).toBeTruthy();
      expect(btn!.type).toBe("button");
      // Through-tile: at least two undirected neighbors on the path.
      const neighbors = new Set(btn!.next);
      for (const node of boardLayout) {
        if (node.next.includes(id)) neighbors.add(node.id);
        for (const edge of node.gateEdges ?? []) {
          if (edge.to === id) neighbors.add(node.id);
        }
      }
      expect(neighbors.size, `${id} should not be a dead-end stub`).toBeGreaterThanOrEqual(2);
    }
  });

  it("connects petals via outer rim bridges (not only Kingdom)", () => {
    for (const id of ["n0", "n1", "e0", "s0", "s1", "w0"]) {
      expect(getNodeById(id), id).toBeTruthy();
    }
    // North / east / south / west rim edges exist.
    expect(getNodeById("tl6")!.next).toContain("n0");
    expect(getNodeById("n1")!.next).toContain("tr4");
    expect(getNodeById("tr2")!.next).toContain("e0");
    expect(getNodeById("e0")!.next).toContain("br0");
    expect(getNodeById("br6")!.next).toContain("s0");
    expect(getNodeById("s1")!.next).toContain("bl0");
    expect(getNodeById("bl7")!.next).toContain("w0");
    expect(getNodeById("w0")!.next).toContain("tl0");
  });

  it("keeps uniform spacing between connected tiles", () => {
    const report = validateBoardGraph();
    const spacing = report.issues.filter((i) => i.code === "spacing");
    expect(spacing, JSON.stringify(spacing, null, 2)).toEqual([]);
  });

  it("passes graph validation across gate configurations", () => {
    const report = validateBoardGraph();
    expect(report.ok, JSON.stringify(report.issues, null, 2)).toBe(true);
    expect(report.modeReports.default?.reachable).toBe(report.nodeCount);
    expect(report.modeReports.all_right?.reachable).toBe(report.nodeCount);
    expect(report.modeReports.all_left?.reachable).toBe(report.nodeCount);
  });

  it("toggles a single gate branch without trapping the board", () => {
    const left = DEFAULT_GATE_STATES;
    const right = toggleGate(left, "g1");
    expect(getNodeExits("i7", left)).toContain("g1L");
    expect(getNodeExits("i7", left)).not.toContain("g1R");
    expect(getNodeExits("i7", right)).toContain("g1R");
    expect(getNodeExits("i7", right)).not.toContain("g1L");
    // Petal loop keeps both branch tiles reachable without the closed gate
    expect(getNodeExits("g1L", left)).toContain("tl0");
    expect(getNodeExits("g1R", right).length).toBeGreaterThan(0);
    expect(GATE_IDS).toHaveLength(4);
    expect(GATE_LABELS.g1).toMatch(/Gate/);
  });

  it("migrates legacy positions", () => {
    expect(migrateBoardPosition("top-split")).toBe("i7");
    expect(migrateBoardPosition("m-top-2")).toBe("g1L");
    expect(migrateBoardPosition("inner-ne")).toBe("i2");
    expect(migrateBoardPosition("hub")).toBe("kingdom");
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
    const a = getPlayerTokenPosition({ id: "o0", x: 10, y: 10 }, 0, 3);
    const b = getPlayerTokenPosition({ id: "o0", x: 10, y: 10 }, 2, 3);
    expect(a.offsetXPercent).not.toBe(b.offsetXPercent);
    expect(a.offsetYPercent).toBeGreaterThan(0);
  });
});

describe("area targeting", () => {
  it("counts partial tile hits as full", () => {
    const kingdom = getNodeById("kingdom");
    expect(kingdom).toBeTruthy();
    const ids = tileIdsInArea({
      center: { x: kingdom!.x, y: kingdom!.y },
      radius: AREA_RADIUS.viper,
    });
    expect(ids).toContain("kingdom");
    const wide = tileIdsInArea({
      center: { x: kingdom!.x, y: kingdom!.y },
      radius: Math.max(AREA_RADIUS.viper, 14),
    });
    expect(wide.length).toBeGreaterThan(1);
    expect(wide).toContain("i0");
  });
});

describe("board planarity", () => {
  it("has no visual road crossings between unconnected edges", () => {
    const report = validateBoardGraph();
    const crossings = report.issues.filter((i) => i.code === "visual_crossing");
    expect(crossings, JSON.stringify(crossings, null, 2)).toEqual([]);
  });
});
