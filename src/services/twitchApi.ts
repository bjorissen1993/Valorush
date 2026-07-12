/**
 * Twitch Helix API — user search for the lobby.
 *
 * Required env vars (.env.local):
 * - VITE_TWITCH_CLIENT_ID — Twitch application Client ID (safe to expose in browser)
 *
 * Auth (pick one):
 * - VITE_TWITCH_CLIENT_SECRET — preferred for local dev; Vite dev server mints tokens
 *   via POST /api/twitch/token (secret stays server-side during `npm run dev`).
 * - VITE_TWITCH_ACCESS_TOKEN — manually generated app access token (works for preview/build).
 *
 * Manual token (PowerShell):
 *
 *   $body = @{
 *     client_id     = "YOUR_CLIENT_ID"
 *     client_secret = "YOUR_CLIENT_SECRET"
 *     grant_type    = "client_credentials"
 *   }
 *   Invoke-RestMethod -Method Post -Uri "https://id.twitch.tv/oauth2/token" -Body $body
 *
 * Copy the `access_token` field — NOT the client secret — into VITE_TWITCH_ACCESS_TOKEN.
 * App tokens expire (~60 days); refresh when search starts failing with 401.
 *
 * FUTURE: a production backend proxy so streamers only set Client ID. Chat-based import
 * (!join / live chatters) is deferred — see src/planning/multiDevicePlay.ts.
 */

import type { TwitchSearchResult } from "../types/twitch";
import { readTwitchEnv } from "./twitchEnv";

type HelixUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
};

type HelixChannelSearchItem = {
  id: string;
  broadcaster_login: string;
  display_name: string;
  thumbnail_url: string;
  is_live: boolean;
};

type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

const HELIX_BASE = "https://api.twitch.tv/helix";
const TOKEN_REFRESH_BUFFER_MS = 60_000;

let cachedToken: { accessToken: string; expiresAt: number } | null = null;
let tokenFetchPromise: Promise<string> | null = null;

function getClientId(): string | undefined {
  return readTwitchEnv().clientId;
}

function getAccessToken(): string | undefined {
  return readTwitchEnv().accessToken;
}

function getClientSecret(): string | undefined {
  return readTwitchEnv().clientSecret;
}

/** True when Client ID is set and auth is usable (not a likely secret-in-wrong-slot). */
export function isTwitchSearchConfigured(): boolean {
  if (!getClientId()) return false;
  if (getClientSecret()) return true;
  if (getAccessToken() && getTwitchMisconfigurationHint()) return false;
  return !!getAccessToken();
}

/** True when Client ID is set (token may still be missing). */
export function hasTwitchClientId(): boolean {
  return !!getClientId();
}

/** True when client secret is set for automatic token minting. */
export function hasTwitchClientSecret(): boolean {
  return !!getClientSecret();
}

export type TwitchAuthMode = "auto" | "manual" | "none";

/** How Twitch auth is resolved from env vars (auto-fetch always wins when secret is set). */
export function getTwitchAuthMode(): TwitchAuthMode {
  if (getClientSecret()) return "auto";
  if (getAccessToken()) return "manual";
  return "none";
}

/** Twitch client secrets are 30-char lowercase alphanumeric strings — easy to paste into ACCESS_TOKEN by mistake. */
function looksLikeClientSecret(value: string): boolean {
  return /^[a-z0-9]{30}$/.test(value);
}

/** Non-fatal hint when ACCESS_TOKEN likely holds a client secret instead. */
export function getTwitchMisconfigurationHint(): string | undefined {
  if (getClientSecret()) return undefined;

  const accessToken = getAccessToken();
  if (!accessToken || !looksLikeClientSecret(accessToken)) return undefined;

  return (
    "VITE_TWITCH_ACCESS_TOKEN looks like a Client Secret (30 lowercase letters/numbers). " +
    "Move that value to VITE_TWITCH_CLIENT_SECRET, delete VITE_TWITCH_ACCESS_TOKEN, and restart npm run dev."
  );
}

function isCachedTokenValid(): boolean {
  return (
    cachedToken !== null &&
    Date.now() < cachedToken.expiresAt - TOKEN_REFRESH_BUFFER_MS
  );
}

async function fetchAppAccessToken(): Promise<string> {
  if (readTwitchEnv().isDev) {
    const response = await fetch("/api/twitch/token", { method: "POST" });
    if (!response.ok) {
      throw new Error(formatTokenFetchError(response.status));
    }
    const json = (await response.json()) as TokenResponse;
    cacheToken(json);
    return json.access_token;
  }

  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Automatic token fetch needs VITE_TWITCH_CLIENT_SECRET. For preview/build, set VITE_TWITCH_ACCESS_TOKEN instead."
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(formatTokenFetchError(response.status));
  }

  const json = (await response.json()) as TokenResponse;
  cacheToken(json);
  return json.access_token;
}

function cacheToken(json: TokenResponse): void {
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

async function resolveAccessToken(): Promise<string | undefined> {
  // Client secret always wins — never fall back to a stale manual ACCESS_TOKEN.
  if (getClientSecret()) {
    if (isCachedTokenValid()) {
      return cachedToken!.accessToken;
    }

    if (!tokenFetchPromise) {
      tokenFetchPromise = fetchAppAccessToken().finally(() => {
        tokenFetchPromise = null;
      });
    }

    return tokenFetchPromise;
  }

  const misconfigurationHint = getTwitchMisconfigurationHint();
  if (misconfigurationHint) {
    throw new Error(misconfigurationHint);
  }

  return getAccessToken();
}

async function helixHeaders(): Promise<HeadersInit | null> {
  const clientId = getClientId();
  const token = await resolveAccessToken();
  if (!clientId || !token) return null;

  return {
    "Client-ID": clientId,
    Authorization: `Bearer ${token}`,
  };
}

function mapHelixUser(user: HelixUser): TwitchSearchResult {
  return {
    id: user.id,
    login: user.login.toLowerCase(),
    displayName: user.display_name,
    avatarUrl: user.profile_image_url,
  };
}

function formatTokenFetchError(status: number): string {
  if (status === 400 || status === 403) {
    return "Twitch rejected the client ID or client secret. Check VITE_TWITCH_CLIENT_ID and VITE_TWITCH_CLIENT_SECRET in .env.local, then restart the dev server.";
  }
  if (status === 404) {
    return "Twitch token proxy is unavailable. Restart `npm run dev` after updating .env.local.";
  }
  return "Could not fetch a Twitch app access token.";
}

function formatHelixError(status: number): string {
  if (status === 401) {
    const misconfigurationHint = getTwitchMisconfigurationHint();
    if (misconfigurationHint) return misconfigurationHint;

    if (getClientSecret()) {
      return "Twitch rejected the app access token. Verify VITE_TWITCH_CLIENT_SECRET in .env.local and restart the dev server.";
    }
    return (
      "Twitch access token is invalid or expired. You may have pasted your Client Secret instead of an access token — they look similar. " +
      "Add VITE_TWITCH_CLIENT_SECRET to .env.local for automatic tokens during dev (recommended), or generate a real access_token via client_credentials."
    );
  }
  if (status === 403) {
    return "Twitch rejected the request (403). Confirm VITE_TWITCH_CLIENT_ID matches the app that issued your token.";
  }
  return "Could not reach the Twitch API. Check your network connection.";
}

/** Exact login lookup via GET /helix/users?login= */
export async function lookupTwitchUser(
  login: string
): Promise<TwitchSearchResult | undefined> {
  const headers = await helixHeaders();
  if (!headers) return undefined;

  const normalized = login.trim().toLowerCase().replace(/^@/, "");
  if (!normalized) return undefined;

  const response = await fetch(
    `${HELIX_BASE}/users?login=${encodeURIComponent(normalized)}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(formatHelixError(response.status));
  }

  const json = (await response.json()) as { data: HelixUser[] };
  const user = json.data[0];
  return user ? mapHelixUser(user) : undefined;
}

function normalizeTwitchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/^@/, "");
}

/** Exact login/display name first, then prefix matches, then partial. */
export function rankTwitchSearchResults(
  results: TwitchSearchResult[],
  query: string
): TwitchSearchResult[] {
  const normalized = normalizeTwitchQuery(query);
  if (!normalized) return results;

  const score = (result: TwitchSearchResult): number => {
    const login = result.login.toLowerCase();
    const display = result.displayName.toLowerCase();

    if (login === normalized || display === normalized) return 0;
    if (login.startsWith(normalized) || display.startsWith(normalized)) return 1;
    if (login.includes(normalized) || display.includes(normalized)) return 2;
    return 3;
  };

  return [...results].sort((a, b) => {
    const scoreDiff = score(a) - score(b);
    if (scoreDiff !== 0) return scoreDiff;
    return a.login.localeCompare(b.login);
  });
}

/**
 * Search Twitch accounts by partial or full name.
 * Uses GET /helix/search/channels for autocomplete, then supplements with
 * GET /helix/users?login= when the query looks like an exact login.
 */
export async function searchTwitchUsers(
  query: string
): Promise<TwitchSearchResult[]> {
  const headers = await helixHeaders();
  if (!headers) {
    throw new Error("Twitch search is not configured.");
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const results: TwitchSearchResult[] = [];
  const seen = new Set<string>();

  const params = new URLSearchParams({ query: trimmed, first: "10" });
  const response = await fetch(`${HELIX_BASE}/search/channels?${params}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(formatHelixError(response.status));
  }

  const json = (await response.json()) as { data: HelixChannelSearchItem[] };

  for (const channel of json.data) {
    const login = channel.broadcaster_login.toLowerCase();
    if (!login || seen.has(login)) continue;
    seen.add(login);
    results.push({
      id: channel.id,
      login,
      displayName: channel.display_name,
      avatarUrl: channel.thumbnail_url,
    });
  }

  const exactLogin = normalizeTwitchQuery(trimmed);
  if (!seen.has(exactLogin) && /^[a-z0-9_]{3,25}$/i.test(exactLogin)) {
    try {
      const user = await lookupTwitchUser(exactLogin);
      if (user) {
        seen.add(user.login);
        results.push(user);
      }
    } catch {
      // Exact lookup is best-effort; channel search results are enough.
    }
  }

  return rankTwitchSearchResults(results, trimmed);
}

/** @internal Reset cached token — for tests only. */
export function __resetTwitchTokenCacheForTests(): void {
  cachedToken = null;
  tokenFetchPromise = null;
}
