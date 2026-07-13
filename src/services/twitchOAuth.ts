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
import { saveTwitchLink } from "./twitchLinkStorage";

export type TwitchIdentity = {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string;
};

const CODE_VERIFIER_KEY = "valorush_twitch_code_verifier";
const OAUTH_STATE_KEY = "valorush_twitch_oauth_state";
const RETURN_PATH_KEY = "valorush_twitch_oauth_return";
const OAUTH_ERROR_KEY = "valorush_twitch_oauth_error";

function getClientId(): string | undefined {
  return readTwitchEnv().clientId;
}

/** True when OAuth can start and the dev/prod token proxy has credentials. */
export function isTwitchOAuthConfigured(): boolean {
  const env = readTwitchEnv();
  if (!env.clientId) return false;
  // Local dev exchanges codes via the Vite middleware in vite.config.ts.
  if (env.isDev && !env.clientSecret) return false;
  return true;
}

export function getTwitchOAuthSetupHint(): string | undefined {
  const env = readTwitchEnv();
  if (!env.clientId) {
    return env.isDev
      ? "Add VITE_TWITCH_CLIENT_ID to .env.local and restart npm run dev."
      : "Twitch sign-in is unavailable. Rebuild with VITE_TWITCH_CLIENT_ID set.";
  }
  if (env.isDev && !env.clientSecret) {
    return "Add VITE_TWITCH_CLIENT_SECRET to .env.local and restart npm run dev.";
  }
  return undefined;
}

export function consumeTwitchOAuthError(): string | null {
  try {
    const message = sessionStorage.getItem(OAUTH_ERROR_KEY);
    sessionStorage.removeItem(OAUTH_ERROR_KEY);
    return message;
  } catch {
    return null;
  }
}

function saveTwitchOAuthError(message: string): void {
  try {
    sessionStorage.setItem(OAUTH_ERROR_KEY, message);
  } catch {
    // Ignore storage access errors.
  }
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

  const json = (await response.json()) as {
    access_token?: string;
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    if (
      response.status === 400 &&
      typeof json.error === "string" &&
      json.error.includes("VITE_TWITCH_CLIENT")
    ) {
      throw new Error(
        readTwitchEnv().isDev
          ? "Twitch OAuth is not configured. Set VITE_TWITCH_CLIENT_ID and VITE_TWITCH_CLIENT_SECRET in .env.local and restart npm run dev."
          : "Twitch OAuth is not configured on the server."
      );
    }
    if (response.status === 404) {
      throw new Error(
        readTwitchEnv().isDev
          ? "Twitch OAuth proxy unreachable. Run npm run dev (not preview only) and restart after .env.local changes."
          : "Twitch sign-in service is unavailable."
      );
    }
    throw new Error(
      json.message ??
        (json.error === "invalid_client"
          ? readTwitchEnv().isDev
            ? "Twitch rejected the client ID or client secret. Check .env.local and restart npm run dev."
            : "Twitch rejected the client ID or client secret."
          : json.error) ??
        "Twitch sign-in could not be completed."
    );
  }

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
    const message =
      "Twitch sign-in expired. Use the same browser tab and address (localhost vs 127.0.0.1) and try again.";
    saveTwitchOAuthError(message);
    throw new Error(message);
  }

  try {
    const accessToken = await exchangeCodeForToken(code, verifier);
    const identity = await fetchTwitchIdentity(accessToken);
    saveTwitchLink(identity);
    clearOAuthParamsFromUrl();
    return { identity, returnPath };
  } catch (error) {
    clearOAuthParamsFromUrl();
    const message =
      error instanceof Error
        ? error.message
        : "Twitch sign-in could not be completed.";
    saveTwitchOAuthError(message);
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
