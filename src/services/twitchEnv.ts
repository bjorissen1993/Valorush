export type TwitchEnv = {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  isDev: boolean;
};

const PLACEHOLDER_CLIENT_ID = "your_client_id_here";
const PLACEHOLDER_ACCESS_TOKEN = "your_access_token_here";
const PLACEHOLDER_CLIENT_SECRET = "your_client_secret_here";

function clean(value: string | undefined, placeholder?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === placeholder) return undefined;
  return trimmed;
}

/** Read Twitch-related Vite env vars (mockable in tests via vi.mock). */
export function readTwitchEnv(): TwitchEnv {
  return {
    clientId: clean(import.meta.env.VITE_TWITCH_CLIENT_ID, PLACEHOLDER_CLIENT_ID),
    clientSecret: clean(
      import.meta.env.VITE_TWITCH_CLIENT_SECRET,
      PLACEHOLDER_CLIENT_SECRET
    ),
    accessToken: clean(
      import.meta.env.VITE_TWITCH_ACCESS_TOKEN,
      PLACEHOLDER_ACCESS_TOKEN
    ),
    isDev: import.meta.env.DEV,
  };
}
