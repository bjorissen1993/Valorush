import {
  CUSTOM_MATCH_CATEGORY_LABELS,
  getCustomMatchDefinition,
} from "../../shared/customMatches";
import type {
  CustomMatchCategory,
  CustomMatchStatus,
  ScheduledCustomMatch,
  ValorantMapId,
} from "../../shared/customMatches/types";
import { mapLoadingPath, pointsIconPath } from "../game/assetPaths";

type LobbyPlayer = {
  name: string;
  avatar?: string;
};

type CustomMatchLobbyProps = {
  match: ScheduledCustomMatch;
  players: LobbyPlayer[];
  isHost: boolean;
  selectingWinner: boolean;
  onStartMatch: () => void;
  onMarkComplete: () => void;
  onSelectWinner: (playerIndex: number) => void;
  onSelectWinnerTeam: (team: "alpha" | "bravo") => void;
  onSelectWinnerSide: (side: "attackers" | "defenders") => void;
  onCancelWinnerSelection: () => void;
};

function statusLabel(status: CustomMatchStatus): string {
  switch (status) {
    case "scheduled":
    case "revealed":
      return "Awaiting match";
    case "in_progress":
      return "Play in Valorant";
    case "completed":
      return "Match complete";
    default:
      return "Awaiting match";
  }
}

function playerLabel(players: LobbyPlayer[], index: number | undefined): string {
  if (index == null) return "Unknown";
  return players[index]?.name ?? `Player ${index + 1}`;
}

function TeamRoster({
  title,
  tone,
  indices,
  players,
}: {
  title: string;
  tone: "cyan" | "orange" | "red" | "emerald";
  indices: number[];
  players: LobbyPlayer[];
}) {
  const borderTone = {
    cyan: "border-cyan-400/25 bg-cyan-500/5",
    orange: "border-orange-400/25 bg-orange-500/5",
    red: "border-red-400/25 bg-red-500/5",
    emerald: "border-emerald-400/25 bg-emerald-500/5",
  }[tone];
  const labelTone = {
    cyan: "text-cyan-300",
    orange: "text-orange-300",
    red: "text-red-300",
    emerald: "text-emerald-300",
  }[tone];

  return (
    <div className={`rounded-xl border p-3 ${borderTone}`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${labelTone}`}>
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {indices.map((index) => (
          <li
            key={`${title}-${index}`}
            className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/25 px-2.5 py-1.5"
          >
            {players[index]?.avatar ? (
              <img
                src={players[index]?.avatar}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300">
                {playerLabel(players, index).charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-sm text-white">{playerLabel(players, index)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WinnerPicker({
  category,
  match,
  players,
  onSelectWinner,
  onSelectWinnerTeam,
  onSelectWinnerSide,
  onCancelWinnerSelection,
}: {
  category: CustomMatchCategory;
  match: ScheduledCustomMatch;
  players: LobbyPlayer[];
  onSelectWinner: (playerIndex: number) => void;
  onSelectWinnerTeam: (team: "alpha" | "bravo") => void;
  onSelectWinnerSide: (side: "attackers" | "defenders") => void;
  onCancelWinnerSelection: () => void;
}) {
  if (category === "2v2") {
    const alpha = match.teamAlpha ?? [];
    const bravo = match.teamBravo ?? [];
    return (
      <>
        <p className="mt-1 text-xs text-zinc-400">
          Select the winning team to award creds and resume the board game.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelectWinnerTeam("alpha")}
            className="rounded-lg border border-cyan-400/25 bg-cyan-500/5 px-3 py-3 text-left transition hover:border-cyan-400/50 hover:bg-cyan-500/10"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Team Alpha</p>
            <p className="mt-1 text-sm text-white">
              {alpha.map((index) => playerLabel(players, index)).join(" · ") || "—"}
            </p>
          </button>
          <button
            type="button"
            onClick={() => onSelectWinnerTeam("bravo")}
            className="rounded-lg border border-orange-400/25 bg-orange-500/5 px-3 py-3 text-left transition hover:border-orange-400/50 hover:bg-orange-500/10"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-orange-300">Team Bravo</p>
            <p className="mt-1 text-sm text-white">
              {bravo.map((index) => playerLabel(players, index)).join(" · ") || "—"}
            </p>
          </button>
        </div>
        <button
          type="button"
          onClick={onCancelWinnerSelection}
          className="mt-3 text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          Cancel
        </button>
      </>
    );
  }

  if (category === "1v3") {
    const attacker = match.attackerIndex;
    const defenders = match.defenderIndices ?? [];
    return (
      <>
        <p className="mt-1 text-xs text-zinc-400">
          Select the winning side to award creds and resume the board game.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelectWinnerSide("attackers")}
            className="rounded-lg border border-red-400/25 bg-red-500/5 px-3 py-3 text-left transition hover:border-red-400/50 hover:bg-red-500/10"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-red-300">Attackers</p>
            <p className="mt-1 text-sm text-white">{playerLabel(players, attacker)}</p>
          </button>
          <button
            type="button"
            onClick={() => onSelectWinnerSide("defenders")}
            className="rounded-lg border border-emerald-400/25 bg-emerald-500/5 px-3 py-3 text-left transition hover:border-emerald-400/50 hover:bg-emerald-500/10"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Defenders</p>
            <p className="mt-1 text-sm text-white">
              {defenders.map((index) => playerLabel(players, index)).join(" · ") || "—"}
            </p>
          </button>
        </div>
        <button
          type="button"
          onClick={onCancelWinnerSelection}
          className="mt-3 text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          Cancel
        </button>
      </>
    );
  }

  return (
    <>
      <p className="mt-1 text-xs text-zinc-400">
        Select the winning player to award creds and resume the board game.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {players.map((player, index) => (
          <button
            key={`winner-${player.name}-${index}`}
            type="button"
            onClick={() => onSelectWinner(index)}
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-left text-sm font-medium text-white transition hover:border-cyan-400/40 hover:bg-zinc-800"
          >
            {player.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancelWinnerSelection}
        className="mt-3 text-xs text-zinc-500 transition hover:text-zinc-300"
      >
        Cancel
      </button>
    </>
  );
}

export default function CustomMatchLobby({
  match,
  players,
  isHost,
  selectingWinner,
  onStartMatch,
  onMarkComplete,
  onSelectWinner,
  onSelectWinnerTeam,
  onSelectWinnerSide,
  onCancelWinnerSelection,
}: CustomMatchLobbyProps) {
  const definition = getCustomMatchDefinition(match.matchId);
  const status = statusLabel(match.status);
  const category = definition?.category ?? "free_for_all";
  const categoryLabel = CUSTOM_MATCH_CATEGORY_LABELS[category];

  return (
    <div className="fixed inset-0 z-[86] flex items-center justify-center bg-black/92 p-4">
      <div className="map-reveal-backdrop pointer-events-none absolute inset-0" />

      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#060a14]/98 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
        <div className="relative h-44 overflow-hidden md:h-52">
          <img
            src={mapLoadingPath(match.mapId)}
            alt={match.mapId}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060a14] via-[#060a14]/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex items-center gap-2">
              <img src={pointsIconPath("kingdom")} alt="" className="h-6 w-6 opacity-90" />
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300/90">
                Custom Match Lobby
              </p>
            </div>
            <h2 className="mt-1 text-3xl font-black uppercase tracking-wide text-white md:text-4xl">
              {match.mapId}
            </h2>
          </div>
        </div>

        <div className="space-y-5 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400/80">
                  {definition?.name ?? "Custom Match"}
                </p>
                {categoryLabel && (
                  <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300 ring-1 ring-violet-400/25">
                    {categoryLabel}
                  </span>
                )}
                {definition?.playerFormat && (
                  <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300 ring-1 ring-zinc-400/20">
                    {definition.playerFormat}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-300">
                {definition?.description ?? "Valorant custom game"}
              </p>
            </div>
            <span
              className={[
                "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider",
                match.status === "in_progress"
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
                  : "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/25",
              ].join(" ")}
            >
              {status}
            </span>
          </div>

          <div className="rounded-xl border border-white/8 bg-black/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Rules
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {definition?.rulesStub ?? "Play the scheduled mode in Valorant."}
            </p>
            {definition?.durationLabel && (
              <p className="mt-2 text-xs text-zinc-500">
                Duration: {definition.durationLabel}
              </p>
            )}
          </div>

          {category === "2v2" && (match.teamAlpha?.length || match.teamBravo?.length) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TeamRoster
                title="Team Alpha"
                tone="cyan"
                indices={match.teamAlpha ?? []}
                players={players}
              />
              <TeamRoster
                title="Team Bravo"
                tone="orange"
                indices={match.teamBravo ?? []}
                players={players}
              />
            </div>
          ) : category === "1v3" &&
            (match.attackerIndex != null || match.defenderIndices?.length) ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
              <TeamRoster
                title="Attacker"
                tone="red"
                indices={match.attackerIndex != null ? [match.attackerIndex] : []}
                players={players}
              />
              <TeamRoster
                title="Defenders"
                tone="emerald"
                indices={match.defenderIndices ?? []}
                players={players}
              />
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Players ({players.length})
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {players.map((player, index) => (
                  <li
                    key={`${player.name}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-white/8 bg-zinc-900/60 px-3 py-2"
                  >
                    {player.avatar ? (
                      <img
                        src={player.avatar}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-300">
                        {player.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="truncate text-sm font-medium text-white">{player.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectingWinner ? (
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/5 p-4">
              <p className="text-sm font-semibold text-amber-200">
                {category === "2v2"
                  ? "Which team won the custom match?"
                  : category === "1v3"
                    ? "Which side won the custom match?"
                    : "Who won the custom match?"}
              </p>
              {isHost ? (
                <WinnerPicker
                  category={category}
                  match={match}
                  players={players}
                  onSelectWinner={onSelectWinner}
                  onSelectWinnerTeam={onSelectWinnerTeam}
                  onSelectWinnerSide={onSelectWinnerSide}
                  onCancelWinnerSelection={onCancelWinnerSelection}
                />
              ) : (
                <p className="mt-1 text-xs text-zinc-400">
                  Waiting for host to confirm the winner.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {!isHost && (
                <p className="flex-1 text-xs text-zinc-500 sm:self-center">
                  Waiting for host to start and complete the Valorant match.
                </p>
              )}
              {isHost && match.status !== "in_progress" && (
                <button
                  type="button"
                  onClick={onStartMatch}
                  className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-black transition hover:brightness-110"
                >
                  Start match
                </button>
              )}
              {isHost && match.status === "in_progress" && (
                <button
                  type="button"
                  onClick={onMarkComplete}
                  className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-black transition hover:brightness-110"
                >
                  Mark match complete
                </button>
              )}
            </div>
          )}

          <p className="text-center text-[10px] uppercase tracking-[0.2em] text-zinc-600">
            Board paused until match resolves
          </p>
        </div>
      </div>
    </div>
  );
}

export type { ValorantMapId };
