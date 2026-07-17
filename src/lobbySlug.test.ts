import { describe, expect, it } from "vitest";
import {
  classifyLobbyPathSegment,
  doesCodeMatchSlug,
  lobbyCodeToSlug,
  LOBBY_SLUG_LENGTH,
  normalizeLobbyCode,
} from "../shared/lobbySlug";

describe("lobbySlug", () => {
  it("normalizes codes and produces a stable hex slug", () => {
    const code = normalizeLobbyCode(" ab-c12 ");
    expect(code).toBe("ABC12");
    const slug = lobbyCodeToSlug(code);
    expect(slug).toHaveLength(LOBBY_SLUG_LENGTH);
    expect(slug).toMatch(/^[a-f0-9]+$/);
    expect(lobbyCodeToSlug("abc12")).toBe(slug);
  });

  it("does not expose the room code in the slug", () => {
    const code = "XYZ789";
    const slug = lobbyCodeToSlug(code);
    expect(slug.toUpperCase()).not.toContain(code);
    expect(doesCodeMatchSlug(code, slug)).toBe(true);
    expect(doesCodeMatchSlug("OTHER1", slug)).toBe(false);
  });

  it("classifies legacy codes vs hashed slugs", () => {
    expect(classifyLobbyPathSegment("ABC123")).toEqual({
      kind: "code",
      code: "ABC123",
    });
    const slug = lobbyCodeToSlug("ABC123");
    expect(classifyLobbyPathSegment(slug)).toEqual({ kind: "slug", slug });
  });
});
