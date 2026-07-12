import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetTwitchTokenCacheForTests,
  getTwitchAuthMode,
  getTwitchMisconfigurationHint,
  isTwitchSearchConfigured,
  searchTwitchUsers,
} from "./twitchApi";
import { readTwitchEnv, type TwitchEnv } from "./twitchEnv";

vi.mock("./twitchEnv", () => ({
  readTwitchEnv: vi.fn((): TwitchEnv => ({
    clientId: "test-client-id",
    accessToken: "valid-access-token",
    isDev: true,
  })),
}));

const readTwitchEnvMock = vi.mocked(readTwitchEnv);

function setTwitchEnv(overrides: Partial<TwitchEnv> = {}) {
  readTwitchEnvMock.mockReturnValue({
    clientId: "test-client-id",
    accessToken: "valid-access-token",
    clientSecret: undefined,
    isDev: true,
    ...overrides,
  });
}

describe("searchTwitchUsers", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    __resetTwitchTokenCacheForTests();
    setTwitchEnv();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    __resetTwitchTokenCacheForTests();
    vi.clearAllMocks();
  });

  it("sends Helix headers with Client-ID and Bearer token", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/search/channels")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "123",
                broadcaster_login: "ezeli",
                display_name: "Ezeli",
                thumbnail_url: "https://example.com/avatar.png",
                is_live: false,
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const results = await searchTwitchUsers("ezeli");

    expect(results).toHaveLength(1);
    expect(results[0]?.login).toBe("ezeli");

    const channelCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/search/channels")
    );
    expect(channelCall).toBeDefined();

    const init = channelCall?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["Client-ID"]).toBe("test-client-id");
    expect(headers?.Authorization).toBe("Bearer valid-access-token");
  });

  it("surfaces a helpful message when Helix returns 401", async () => {
    globalThis.fetch = vi.fn(async () => new Response("", { status: 401 })) as typeof fetch;

    await expect(searchTwitchUsers("ezeli")).rejects.toThrow(/invalid or expired/i);
  });

  it("prefers auto-fetch when client secret is set, ignoring manual access token", async () => {
    setTwitchEnv({
      clientSecret: "abcdefghijklmnopqrstuvwxyz012345",
      accessToken: "stale-wrong-token",
    });

    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/twitch/token") {
        return new Response(
          JSON.stringify({
            access_token: "fresh-auto-token",
            expires_in: 3600,
            token_type: "bearer",
          }),
          { status: 200 }
        );
      }
      if (url.includes("/search/channels")) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    globalThis.fetch = fetchMock as typeof fetch;

    await searchTwitchUsers("ezeli");

    expect(fetchMock).toHaveBeenCalledWith("/api/twitch/token", { method: "POST" });

    const channelCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/search/channels")
    );
    const headers = (channelCall?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.Authorization).toBe("Bearer fresh-auto-token");
  });

  it("detects client secret pasted into ACCESS_TOKEN", () => {
    setTwitchEnv({
      accessToken: "hepscm3wss61970op98k3v3358im4e",
      clientSecret: undefined,
    });

    expect(getTwitchMisconfigurationHint()).toMatch(/VITE_TWITCH_CLIENT_SECRET/);
    expect(isTwitchSearchConfigured()).toBe(false);
    expect(getTwitchAuthMode()).toBe("manual");
  });
});
