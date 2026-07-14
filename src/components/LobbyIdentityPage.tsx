import { useEffect, useState } from "react";
import type { PlayerProfile } from "../../shared/lobbyTypes";
import { validateLobbyCode } from "../services/lobbyClient";
import {
  clearTwitchLink,
  getStoredTwitchLink,
  storedLinkToProfile,
  type StoredTwitchLink,
} from "../services/twitchLinkStorage";
import {
  consumeTwitchOAuthError,
  getTwitchOAuthSetupHint,
  getTwitchRedirectUri,
  isTwitchOAuthConfigured,
  startTwitchOAuth,
} from "../services/twitchOAuth";

type LobbyIdentityPageProps = {
  mode: "create" | "join";
  joinCode?: string;
  onBack: () => void;
  onReady: (profile: PlayerProfile) => void | Promise<void>;
};

export default function LobbyIdentityPage({
  mode,
  joinCode,
  onBack,
  onReady,
}: LobbyIdentityPageProps) {
  const [cachedLink, setCachedLink] = useState<StoredTwitchLink | null>(() =>
    getStoredTwitchLink()
  );
  const [guestName, setGuestName] = useState("");
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [error, setError] = useState<string | null>(() => consumeTwitchOAuthError());
  const [validatingCode, setValidatingCode] = useState(mode === "join" && !!joinCode);
  const [codeValid, setCodeValid] = useState(mode !== "join" || !joinCode);
  const [submitting, setSubmitting] = useState(false);

  const twitchConfigured = isTwitchOAuthConfigured();
  const twitchSetupHint = getTwitchOAuthSetupHint();

  useEffect(() => {
    if (mode !== "join" || !joinCode) {
      setCodeValid(true);
      setValidatingCode(false);
      return;
    }

    let cancelled = false;
    setValidatingCode(true);
    setCodeValid(false);
    setError(null);

    void validateLobbyCode(joinCode)
      .then(() => {
        if (!cancelled) setCodeValid(true);
      })
      .catch((validationError) => {
        if (cancelled) return;
        setError(
          validationError instanceof Error
            ? validationError.message
            : "Lobby not found. Check the join code."
        );
      })
      .finally(() => {
        if (!cancelled) setValidatingCode(false);
      });

    return () => {
      cancelled = true;
    };
  }, [joinCode, mode]);

  function getOAuthReturnPath() {
    return mode === "join" && joinCode ? `?join=${joinCode}` : "?create=1";
  }

  function handleTwitchLogin() {
    setError(null);

    try {
      startTwitchOAuth(getOAuthReturnPath());
    } catch (oauthError) {
      setError(
        oauthError instanceof Error
          ? oauthError.message
          : "Could not start Twitch sign-in."
      );
    }
  }

  async function confirmReady(profile: PlayerProfile) {
    if (validatingCode || submitting || !!error || !codeValid) return;

    if (mode === "join" && joinCode) {
      setSubmitting(true);
      try {
        await validateLobbyCode(joinCode);
      } catch (validationError) {
        setError(
          validationError instanceof Error
            ? validationError.message
            : "Lobby not found. Check the join code."
        );
        setSubmitting(false);
        return;
      }
    }

    try {
      await onReady(profile);
    } finally {
      setSubmitting(false);
    }
  }

  function handleUseCachedLink() {
    if (!cachedLink) return;
    void confirmReady(storedLinkToProfile(cachedLink));
  }

  function handleUnlink() {
    clearTwitchLink();
    setCachedLink(null);
    setError(null);
  }

  function handleGuestJoin(event: React.FormEvent) {
    event.preventDefault();
    const name = guestName.trim();
    if (name.length < 2) {
      setError("Enter a name with at least 2 characters.");
      return;
    }
    void confirmReady({ name });
  }

  const title =
    mode === "join" && joinCode ? `Join ${joinCode}` : "Create lobby";

  const actionLabel = mode === "create" ? "Create lobby" : "Join lobby";
  const identityLocked = validatingCode || submitting || !!error || !codeValid;

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
              Link Twitch to auto-fill your name and avatar, or play as a guest.
            </p>
          </div>

          <div className="grid gap-4 p-8">
            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {validatingCode && (
              <p className="text-sm text-zinc-400">Checking lobby code...</p>
            )}

            {!validatingCode && !codeValid && !error && (
              <p className="text-sm text-zinc-400">Could not verify lobby code.</p>
            )}

            {codeValid && !showGuestForm ? (
              <>
                {cachedLink ? (
                  <div className="rounded-2xl border border-[#9146FF]/30 bg-[#9146FF]/10 p-6">
                    <div className="flex items-center gap-4">
                      <img
                        src={cachedLink.avatar}
                        alt=""
                        className="h-14 w-14 rounded-full border-2 border-[#9146FF]/40 object-cover"
                      />
                      <div>
                        <p className="text-lg font-semibold">
                          Welcome back @{cachedLink.twitchLogin}
                        </p>
                        <p className="text-sm text-zinc-400">{cachedLink.name}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                      <button
                        type="button"
                        onClick={handleUseCachedLink}
                        disabled={identityLocked}
                        className="rounded-xl bg-[#9146FF] px-4 py-3 font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Continue with this account
                      </button>
                      <button
                        type="button"
                        onClick={handleTwitchLogin}
                        disabled={!twitchConfigured || identityLocked}
                        className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-semibold text-zinc-200 transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Link a different Twitch account
                      </button>
                      <button
                        type="button"
                        onClick={handleUnlink}
                        className="rounded-xl px-4 py-2 text-sm text-zinc-500 transition hover:text-red-300"
                      >
                        Unlink Twitch
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleTwitchLogin}
                      disabled={!twitchConfigured || identityLocked}
                      className="rounded-2xl bg-[#9146FF] px-6 py-5 text-left font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="block text-lg">Link Twitch</span>
                      <span className="mt-1 block text-sm font-normal text-white/80">
                        Uses your Twitch display name and profile photo.
                      </span>
                    </button>
                    {!twitchConfigured && (
                      <p className="text-xs text-amber-200/80">
                        {twitchSetupHint ??
                          `Register ${getTwitchRedirectUri()} as a redirect URI in the Twitch developer console.`}
                      </p>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowGuestForm(true)}
                  disabled={identityLocked}
                  className="rounded-2xl border border-white/10 bg-zinc-900/70 px-6 py-5 text-left font-semibold transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="block text-lg">Continue as guest</span>
                  <span className="mt-1 block text-sm font-normal text-zinc-400">
                    Pick any name — no Twitch account required.
                  </span>
                </button>
              </>
            ) : codeValid ? (
              <form onSubmit={handleGuestJoin} className="grid gap-4">
                <div>
                  <label
                    htmlFor="guest-name"
                    className="mb-2 block text-xs uppercase tracking-wider text-zinc-500"
                  >
                    Display name
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
                    disabled={identityLocked}
                    className="flex-1 rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Joining..." : actionLabel}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
