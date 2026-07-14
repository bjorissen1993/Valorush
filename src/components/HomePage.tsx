import { useState } from "react";
import ValorantPanel from "./valorant/ValorantPanel";
import {
  consumeLobbyKickedFlag,
  getBakedLobbyWsUrl,
  getStoredLobbyWsUrl,
  normalizeLobbyWsUrl,
  setStoredLobbyWsUrl,
  validateLobbyCode,
} from "../services/lobbyClient";

type HomePageProps = {
  onCreateLobby: () => void;
  onJoinLobby: (code?: string) => void;
  onLocalGame: () => void;
  joinError?: string | null;
  validatingJoin?: boolean;
};

const clientMode = import.meta.env.VITE_VALORUSH_CLIENT ?? "full";
const isJoinClient = clientMode === "join";
const isHostClient = clientMode === "host";
const bakedLobbyUrl = getBakedLobbyWsUrl();
const needsServerUrl = isJoinClient && !bakedLobbyUrl;

function KickedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      className="launcher-help-backdrop animate-fadeIn"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="launcher-help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kicked-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ValorantPanel accent="neutral" className="border-red-500/30 shadow-[0_0_24px_rgba(239,68,68,0.12)]">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-400">
              Lobby
            </p>
            <h2 id="kicked-modal-title" className="mt-2 text-xl font-bold text-white">
              Removed from lobby
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-300">
              You were kicked by the host.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="launcher-join-button mt-6 w-full px-8 py-3 font-bold uppercase tracking-wider"
            >
              OK
            </button>
          </div>
        </ValorantPanel>
      </div>
    </div>
  );
}

function HelpPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      className="launcher-help-backdrop animate-fadeIn"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="launcher-help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="launcher-help-title"
        onClick={(event) => event.stopPropagation()}
      >
      <ValorantPanel accent="cyan">
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-400">
                Help
              </p>
              <h2 id="launcher-help-title" className="mt-2 text-xl font-bold text-white">Getting started</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-white/20 hover:text-white"
              aria-label="Close help"
            >
              Close
            </button>
          </div>

          <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-300">
            <p>
              ValoRush is a stream-friendly party board game. Host a lobby, share the
              join code on stream, and up to four players can jump in from another device
              or the viewer app.
            </p>

            {isHostClient && (
              <div className="rounded-xl border border-orange-400/20 bg-orange-400/5 px-4 py-3 text-orange-100/90">
                <p className="font-semibold text-orange-200">Host setup</p>
                <p className="mt-1 text-xs text-orange-100/80">
                  The lobby server runs automatically on this PC. Expose port{" "}
                  <span className="font-mono">3001</span> with a tunnel (ngrok, Cloudflare
                  Tunnel) so viewers can join, then share the join code on stream.
                </p>
              </div>
            )}

            {isJoinClient && bakedLobbyUrl && (
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-cyan-100/90">
                <p className="font-semibold text-cyan-200">Viewer app</p>
                <p className="mt-1 text-xs text-cyan-100/80">
                  You&apos;re connected to the streamer&apos;s lobby server. Enter the code
                  shown on stream to join.
                </p>
              </div>
            )}

            {clientMode === "full" && (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-400">
                <p className="font-semibold text-zinc-300">Developer notes</p>
                <ul className="mt-2 list-inside list-disc space-y-1 font-mono">
                  <li>Dev: npm run dev:all</li>
                  <li>Prod local: npm run start:prod</li>
                  <li>Viewer build: npm run package:win:join</li>
                  <li>Host build: npm run package:win:host</li>
                </ul>
              </div>
            )}

            {needsServerUrl && (
              <p className="text-xs text-zinc-400">
                If the streamer shared a tunnel URL, paste it under server address before
                entering the join code.
              </p>
            )}
          </div>
        </div>
      </ValorantPanel>
      </div>
    </div>
  );
}

export default function HomePage({
  onCreateLobby,
  onJoinLobby,
  onLocalGame,
  joinError: externalJoinError = null,
  validatingJoin: externalValidatingJoin = false,
}: HomePageProps) {
  const [joinCode, setJoinCode] = useState("");
  const [serverUrl, setServerUrl] = useState(
    () => getStoredLobbyWsUrl()?.replace(/^wss?:\/\//, "") ?? ""
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [localJoinError, setLocalJoinError] = useState<string | null>(null);
  const [validatingLocalJoin, setValidatingLocalJoin] = useState(false);
  const joinError = localJoinError ?? externalJoinError;
  const validatingJoin = validatingLocalJoin || externalValidatingJoin;
  const [helpOpen, setHelpOpen] = useState(false);
  const [kickedOpen, setKickedOpen] = useState(() => consumeLobbyKickedFlag() !== null);

  async function handleJoinSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = joinCode.trim();
    if (!trimmed) return;

    if (needsServerUrl) {
      try {
        setStoredLobbyWsUrl(normalizeLobbyWsUrl(serverUrl));
        setServerError(null);
      } catch (error) {
        setServerError(
          error instanceof Error ? error.message : "Invalid server address."
        );
        return;
      }
    }

    setLocalJoinError(null);
    setValidatingLocalJoin(true);

    try {
      await validateLobbyCode(trimmed);
      onJoinLobby(trimmed.toUpperCase());
    } catch (error) {
      setLocalJoinError(
        error instanceof Error ? error.message : "Lobby not found. Check the join code."
      );
    } finally {
      setValidatingLocalJoin(false);
    }
  }

  const tagline = isJoinClient
    ? "Enter the code from stream and pick your agent."
    : "Host, join, or play locally — up to 4 agents per match.";

  return (
    <div className="launcher-screen relative min-h-screen overflow-hidden text-white">
      <div className="launcher-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="launcher-accent-bar pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="launcher-logo-mark" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-[0.45em] text-zinc-500">
              ValoRush
            </span>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="launcher-help-trigger flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-bold text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
            aria-label="Open help"
            title="Help"
          >
            ?
          </button>
        </header>

        <main className="flex flex-1 flex-col justify-center gap-10 py-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:py-12">
          <section className="launcher-hero">
            <p className="launcher-eyebrow text-xs font-semibold uppercase tracking-[0.5em] text-red-400">
              Tactical Party Rush
            </p>
            <h1 className="launcher-title mt-4 text-5xl font-black uppercase leading-[0.92] tracking-tight sm:text-6xl lg:text-7xl">
              Valo
              <span className="text-cyan-400">Rush</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-zinc-400 sm:text-lg">
              {tagline}
            </p>

            {isJoinClient && bakedLobbyUrl && (
              <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs font-medium text-cyan-200">
                <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                Connected to stream lobby
              </p>
            )}

            {isHostClient && (
              <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/10 px-4 py-2 text-xs font-medium text-orange-200">
                <span className="h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]" />
                Host mode — lobby server ready
              </p>
            )}
          </section>

          <section className="flex flex-col gap-4">
            {!isJoinClient && (
              <button
                type="button"
                onClick={onCreateLobby}
                className="launcher-action-primary group w-full text-left"
              >
                <ValorantPanel accent="neutral" className="border-red-500/30 p-0">
                  <div className="launcher-action-primary-inner px-6 py-5 sm:px-7 sm:py-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-red-300/80">
                          Host
                        </span>
                        <span className="mt-2 block text-2xl font-bold text-white">
                          Create Lobby
                        </span>
                        <span className="mt-1 block text-sm text-white/70">
                          Get a shareable code for up to 4 players.
                        </span>
                      </div>
                      <span
                        className="launcher-action-arrow text-2xl text-red-400 transition group-hover:translate-x-1"
                        aria-hidden
                      >
                        →
                      </span>
                    </div>
                  </div>
                </ValorantPanel>
              </button>
            )}

            <ValorantPanel accent="cyan">
              <form onSubmit={handleJoinSubmit} className="p-5 sm:p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/80">
                      {isJoinClient ? "Viewer" : "Join"}
                    </span>
                    <h2 className="mt-1 text-xl font-bold text-white">
                      {isJoinClient ? "Join the Stream" : "Join Lobby"}
                    </h2>
                  </div>
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  Enter the 6-character code from the stream or a shared link.
                </p>

                {needsServerUrl && (
                  <div className="mt-4">
                    <label
                      className="block text-sm font-medium text-zinc-300"
                      htmlFor="server-url"
                    >
                      Streamer server address
                    </label>
                    <input
                      id="server-url"
                      value={serverUrl}
                      onChange={(event) => setServerUrl(event.target.value)}
                      placeholder="your-tunnel.ngrok-free.app"
                      className="launcher-input mt-2 w-full px-4 py-3 font-mono text-sm"
                    />
                    {serverError && (
                      <p className="mt-2 text-sm text-red-300">{serverError}</p>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    id="join-code"
                    value={joinCode}
                    onChange={(event) => {
                      setJoinCode(
                        event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                      );
                      setLocalJoinError(null);
                    }}
                    maxLength={6}
                    placeholder="ABC123"
                    aria-label="Join code"
                    className="launcher-input w-full px-4 py-3 font-mono text-lg tracking-[0.3em]"
                  />
                  <button
                    type="submit"
                    disabled={
                      joinCode.trim().length < 4 ||
                      (needsServerUrl && serverUrl.trim().length < 4) ||
                      validatingJoin
                    }
                    className="launcher-join-button shrink-0 px-8 py-3 font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {validatingJoin ? "Checking..." : "Join"}
                  </button>
                </div>
                {joinError && (
                  <p className="mt-2 text-sm text-red-300">{joinError}</p>
                )}
              </form>
            </ValorantPanel>

            {!isJoinClient && (
              <button
                type="button"
                onClick={onLocalGame}
                className="launcher-action-secondary group w-full text-left"
              >
                <ValorantPanel accent="neutral" className="p-0">
                  <div className="px-6 py-4 sm:px-7 sm:py-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                          Offline
                        </span>
                        <span className="mt-1 block text-lg font-semibold text-white">
                          Local Game
                        </span>
                        <span className="mt-1 block text-sm text-zinc-400">
                          Pass &amp; play on one device — no lobby needed.
                        </span>
                      </div>
                      <span
                        className="text-xl text-zinc-500 transition group-hover:translate-x-1 group-hover:text-zinc-300"
                        aria-hidden
                      >
                        →
                      </span>
                    </div>
                  </div>
                </ValorantPanel>
              </button>
            )}
          </section>
        </main>

        <footer className="flex justify-end border-t border-white/5 pt-5 text-xs text-zinc-600">
          <span className="font-mono uppercase tracking-wider">
            {isJoinClient ? "Viewer" : isHostClient ? "Host" : "Full"} client
          </span>
        </footer>
      </div>

      <div className="launcher-studio-credit" aria-label="A game by Freaky Devs">
        <span className="launcher-studio-label">A game by</span>
        <img
          src="/studio/freaky-devs.png"
          alt="Freaky Devs"
          className="launcher-studio-logo"
          width={336}
          height={108}
        />
      </div>

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
      <KickedModal open={kickedOpen} onClose={() => setKickedOpen(false)} />
    </div>
  );
}
