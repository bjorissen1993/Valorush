import type { LobbyPlayer } from "../../shared/lobbyTypes";

type SpectatorWaitingPageProps = {
  players: LobbyPlayer[];
  onBack: () => void;
};

export default function SpectatorWaitingPage({
  players,
  onBack,
}: SpectatorWaitingPageProps) {
  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-400">
            Match Started
          </p>
          <h1 className="mt-2 text-3xl font-bold">Game is live on the host screen</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Multiplayer gameplay sync is not in this MVP yet. The host is running the
            board — watch their stream or play pass-and-play on their device.
          </p>

          <div className="mt-6 grid gap-3">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3"
              >
                {player.avatar ? (
                  <img
                    src={player.avatar}
                    alt={player.name}
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-bold">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium">{player.name}</p>
                  {player.twitchLogin && (
                    <p className="text-xs text-zinc-500">@{player.twitchLogin}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onBack}
            className="mt-8 w-full rounded-xl border border-white/10 px-4 py-3 font-semibold transition hover:bg-white/5"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
