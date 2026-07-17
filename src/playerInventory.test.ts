import { describe, expect, it } from "vitest";
import { rotatePlayersToActive } from "./components/PlayerInventorySidebar";

describe("rotatePlayersToActive", () => {
  it("puts the active index first and rotates the rest", () => {
    expect(rotatePlayersToActive(4, 2)).toEqual([2, 3, 0, 1]);
    expect(rotatePlayersToActive(3, 0)).toEqual([0, 1, 2]);
    expect(rotatePlayersToActive(2, 1)).toEqual([1, 0]);
  });

  it("handles empty and wraps negative indices", () => {
    expect(rotatePlayersToActive(0, 0)).toEqual([]);
    expect(rotatePlayersToActive(3, -1)).toEqual([2, 0, 1]);
  });
});
