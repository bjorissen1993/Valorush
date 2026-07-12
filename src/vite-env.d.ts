/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Twitch application Client ID — required for Helix user search */
  readonly VITE_TWITCH_CLIENT_ID?: string;
  /** Client secret — dev server mints tokens via /api/twitch/token (see twitchApi.ts) */
  readonly VITE_TWITCH_CLIENT_SECRET?: string;
  /** Manually generated app access token — alternative to client secret */
  readonly VITE_TWITCH_ACCESS_TOKEN?: string;
  /** OAuth redirect URI override — defaults to window.location.origin + "/" */
  readonly VITE_TWITCH_REDIRECT_URI?: string;
  /**
   * WebSocket URL override for lobby server — defaults to same host /ws.
   * Set when frontend and lobby run on different origins (unusual for tunnels).
   */
  readonly VITE_LOBBY_WS_URL?: string;
  /** Pre-baked lobby WebSocket URL for join-only desktop builds */
  readonly VITE_DEFAULT_LOBBY_WS_URL?: string;
  /** host | join | full — controls desktop join UI (full = web/default) */
  readonly VITE_VALORUSH_CLIENT?: "host" | "join" | "full";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
