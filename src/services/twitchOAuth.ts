/**
 * Twitch OAuth 2.0 (Authorization Code + PKCE) for player identity.
 *
 * Requires VITE_TWITCH_CLIENT_ID in .env.local and a matching redirect URI
 * registered in the Twitch developer console (default: http://localhost:5173/).
 *
 * Token exchange runs through the Vite dev proxy at /api/twitch/oauth/token so
 * the client secret stays server-side during local development.
 */

import { readTwitchEnv } from "./twitchEnv";

export type TwitchIdentity = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string;
};

const CODE_VERIFIER_KEY = "valorush_twitch_code_verifier";
const OAUTH_STATE_KEY = "valorush_twitch_oauth_state";
const RETURN_PATH_KEY = "valorush_twitch_oauth_return";

function getClientId(): string | undefined {
  return readTwitchEnv().clientId;
}

export function isTwitchOAuthConfigured(): boolean {
  return !!getClientId();
}

export function getTwitchRedirectUri(): string {
  const configured = import.meta.env.VITE_TWITCH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${window.location.origin}/`;
}

function randomString(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

export function startTwitchOAuth(returnPath = "/"): void {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("Twitch OAuth is not configured.");
  }

  const verifier = randomString(48);
  const state = randomString(16);

  sessionStorage.setItem(CODE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  sessionStorage.setItem(RETURN_PATH_KEY, returnPath);

  void createCodeChallenge(verifier).then((challenge) => {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getTwitchRedirectUri(),
      response_type: "code",
      scope: "",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    window.location.assign(`https://id.twitch.tv/oauth2/authorize?${params}`);
  });
}

function clearOAuthParamsFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("scope");
  url.searchParams.delete("state");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

async function exchangeCodeForToken(code: string, verifier: string): Promise<string> {
  const response = await fetch("/api/twitch/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      redirect_uri: getTwitchRedirectUri(),
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    throw new Error("Could not complete Twitch sign-in.");
  }

  const json = (await response.json()) as { access_token?: string; error?: string };
  if (!json.access_token) {
    throw new Error(json.error ?? "Twitch did not return an access token.");
  }

  return json.access_token;
}

async function fetchTwitchIdentity(accessToken: string): Promise<TwitchIdentity> {
  const clientId = getClientId();
  if (!clientId) throw new Error("Twitch OAuth is not configured.");

  const response = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-ID": clientId,
    },
  });

  if (!response.ok) {
    throw new Error("Could not load your Twitch profile.");
  }

  const json = (await response.json()) as {
    data: Array<{
      id: string;
      login: string;
      display_name: string;
      profile_image_url: string;
    }>;
  };

  const user = json.data[0];
  if (!user) throw new Error("Twitch profile not found.");

  return {
    id: user.id,
    login: user.login.toLowerCase(),
    displayName: user.display_name,
    avatarUrl: user.profile_image_url,
  };
}

export type TwitchOAuthResult = {
  identity: TwitchIdentity;
  returnPath: string;
};

/**
 * If the URL contains a Twitch OAuth callback, exchange the code and return identity.
 * Cleans query params from the address bar on success.
 */
export async function completeTwitchOAuthIfPending(): Promise<TwitchOAuthResult | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");

  if (!code || !state) return null;

  const storedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  const verifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
  const returnPath = sessionStorage.getItem(RETURN_PATH_KEY) ?? "/";

  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
  sessionStorage.removeItem(RETURN_PATH_KEY);

  if (!storedState || state !== storedState || !verifier) {
    clearOAuthParamsFromUrl();
    throw new Error("Twitch sign-in expired. Please try again.");
  }

  try {
    const accessToken = await exchangeCodeForToken(code, verifier);
    const identity = await fetchTwitchIdentity(accessToken);
    clearOAuthParamsFromUrl();
    return { identity, returnPath };
  } catch (error) {
    clearOAuthParamsFromUrl();
    throw error;
  }
}

export function identityToProfile(identity: TwitchIdentity) {
  return {
    name: identity.displayName,
    avatar: identity.avatarUrl,
    twitchLogin: identity.login,
    twitchId: identity.id,
    twitchImportedName: identity.displayName,
  };
}
