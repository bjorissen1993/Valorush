import { useState } from "react";
import type { PlayerProfile } from "../../shared/lobbyTypes";
import { isTwitchOAuthConfigured, startTwitchOAuth } from "../services/twitchOAuth";

type LobbyIdentityPageProps = {
  mode: "create" | "join";
  joinCode?: string;
  onBack: () => void;
  onReady: (profile: PlayerProfile) => void;
};

export default function LobbyIdentityPage({
  mode,
  joinCode,
  onBack,
  onReady,
}: LobbyIdentityPageProps) {
  const [guestName, setGuestName] = useState("");
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const twitchConfigured = isTwitchOAuthConfigured();

  function handleTwitchLogin() {
    setError(null);
    const returnPath =
      mode === "join" && joinCode ? `?join=${joinCode}` : "?create=1";

    try {
      startTwitchOAuth(returnPath);
    } catch (oauthError) {
      setError(
        oauthError instanceof Error
          ? oauthError.message
          : "Could not start Twitch sign-in."
      );
    }
  }

  function handleGuestJoin(event: React.FormEvent) {
    event.preventDefault();
    const name = guestName.trim();
    if (name.length < 2) {
      setError("Enter a name with at least 2 characters.");
      return;
    }
    onReady({ name });
  }

  const title =
    mode === "join" && joinCode
      ? `Join ${joinCode}`
      : "Create Lobby";

  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md">
          <div className="border-b border-white/10 px-8 py-6">
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-zinc-400 transition hover:text-white"
            >
              ← Back
            </button>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.35em] text-cyan-400">
              {title}
            </p>
            <h1 className="mt-2 text-3xl font-bold">Choose your identity</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Link Twitch to auto-fill your name and avatar, or enter a guest name.
            </p>
          </div>

          <div className="grid gap-4 p-8">
            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {!showGuestForm ? (
              <>
                <button
                  type="button"
                  onClick={handleTwitchLogin}
                  disabled={!twitchConfigured}
                  className="rounded-2xl bg-[#9146FF] px-6 py-5 text-left font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="block text-lg">Link Twitch</span>
                  <span className="mt-1 block text-sm font-normal text-white/80">
                    Uses your Twitch display name and profile picture.
                  </span>
                </button>
                {!twitchConfigured && (
                  <p className="text-xs text-amber-200/80">
                    Add VITE_TWITCH_CLIENT_ID to .env.local and register{" "}
                    {window.location.origin}/ as a redirect URI in the Twitch developer console.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setShowGuestForm(true)}
                  className="rounded-2xl border border-white/10 bg-zinc-900/70 px-6 py-5 text-left font-semibold transition hover:bg-zinc-900"
                >
                  <span className="block text-lg">Continue as Guest</span>
                  <span className="mt-1 block text-sm font-normal text-zinc-400">
                    Pick any display name — no Twitch account needed.
                  </span>
                </button>
              </>
            ) : (
              <form onSubmit={handleGuestJoin} className="grid gap-4">
                <div>
                  <label
                    htmlFor="guest-name"
                    className="mb-2 block text-xs uppercase tracking-wider text-zinc-500"
                  >
                    Display Name
                  </label>
                  <input
                    id="guest-name"
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    maxLength={32}
                    autoFocus
                    placeholder="Your name"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-400/40"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGuestForm(false)}
                    className="rounded-xl border border-white/10 px-4 py-3 font-semibold text-zinc-300 transition hover:bg-white/5"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-black transition hover:brightness-110"
                  >
                    {mode === "create" ? "Create Lobby" : "Enter Lobby"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
