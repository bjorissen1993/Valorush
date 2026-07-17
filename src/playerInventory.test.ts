import { describe, expect, it } from "vitest";
import { rotatePlayersToActive } from "./components/PlayerInventorySidebar";

describe("rotatePlayersToActive", () => {
  it("puts the active seat first, then follows turn order left to right", () => {
    expect(rotatePlayersToActive([2, 0, 3, 1], 2)).toEqual([2, 0, 3, 1]);
    expect(rotatePlayersToActive([2, 0, 3, 1], 0)).toEqual([0, 3, 1, 2]);
    expect(rotatePlayersToActive([2, 0, 3, 1], 1)).toEqual([1, 2, 0, 3]);
    expect(rotatePlayersToActive([0, 1, 2], 0)).toEqual([0, 1, 2]);
    expect(rotatePlayersToActive([1, 0], 1)).toEqual([1, 0]);
  });

  it("handles empty order and missing active seats", () => {
    expect(rotatePlayersToActive([], 0)).toEqual([]);
    expect(rotatePlayersToActive([0, 1, 2], 9)).toEqual([0, 1, 2]);
  });
});
