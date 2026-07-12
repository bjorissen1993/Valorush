import { useEffect, useState } from "react";
import type { Player } from "../types/Player";
import type { Agent } from "../types/Agent";
import {
  agentBackgroundPath,
  agentPortraitPath,
  randomBackgroundPath,
  randomPortraitPath,
} from "../game/assetPaths";
import PlayerNameWithBadge from "./lobby/PlayerNameWithBadge";
import {
  MAX_LOBBY_SLOTS,
  buildFixedPlayerSlots,
  isRandomizePending,
  resolvePlayerAvatarUrl,
} from "./lobby/lobbyPlayerUtils";

const AUTO_CONTINUE_MS = 4000;

/** Scale player name down as length grows so it fits the remaining row width. */
function getLoadingPlayerNameFontSize(name: string): string {
  const length = name.trim().length;
  if (length <= 8) return "text-2xl sm:text-3xl";
  if (length <= 12) return "text-xl sm:text-2xl";
  if (length <= 16) return "text-lg sm:text-xl";
  if (length <= 22) return "text-base sm:text-lg";
  return "text-sm sm:text-base";
}

type LoadingScreenProps = {
  players: Player[];
  agents: Agent[];
  onContinue: () => void;
};

export default function LoadingScreen({
  players,
  agents,
  onContinue,
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [dotCount, setDotCount] = useState(1);
  const isComplete = progress >= 100;
  const slots = buildFixedPlayerSlots(players, MAX_LOBBY_SLOTS);

  useEffect(() => {
    const startedAt = Date.now();
    const frame = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(100, (elapsed / AUTO_CONTINUE_MS) * 100));
    }, 50);

    return () => {
      window.clearInterval(frame);
    };
  }, []);

  useEffect(() => {
    if (isComplete) return;

    const interval = window.setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 500);

    return () => {
      window.clearInterval(interval);
    };
  }, [isComplete]);

  function getAgent(player: Player | null) {
    if (!player?.selectedAgentId) return undefined;
    return agents.find((agent) => agent.uuid === player.selectedAgentId);
  }

  function getPortrait(player: Player | null, agent?: Agent) {
    if (!player) return null;
    if (isRandomizePending(player)) return randomPortraitPath();
    if (agent?.fullPortrait) return agent.fullPortrait;
    if (agent?.displayName) return agentPortraitPath(agent.displayName);
    if (agent?.displayIcon) return agent.displayIcon;
    return null;
  }

  function getBackgroundPath(player: Player | null, agent?: Agent) {
    if (!player) return null;
    if (isRandomizePending(player)) return randomBackgroundPath();
    if (agent?.displayName) return agentBackgroundPath(agent.displayName);
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,70,85,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(15,25,35,0.9),_transparent_60%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex justify-center">
          <h1
            className={`text-center text-2xl font-bold sm:text-3xl ${isComplete ? "invisible" : ""}`}
            aria-hidden={isComplete}
          >
            Loading
            <span className="inline-block w-[1.5em] text-left">
              {".".repeat(dotCount)}
            </span>
          </h1>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {slots.map((player, index) => {
            const agent = getAgent(player);
            const portrait = getPortrait(player, agent);
            const backgroundPath = getBackgroundPath(player, agent);
            const avatarUrl = player
              ? resolvePlayerAvatarUrl(player, agent)
              : undefined;

            return (
              <div
                key={player?.id ?? `empty-${index}`}
                className={`relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border sm:min-h-[420px] sm:rounded-3xl ${
                  player
                    ? "border-white/10 bg-zinc-900/70 shadow-2xl"
                    : "border-dashed border-white/5 bg-zinc-950/40"
                }`}
              >
                {player && portrait ? (
                  <>
                    <div className="pointer-events-none absolute inset-0 flex flex-col overflow-hidden pb-[92px] sm:pb-[104px]">
                      <div className="relative min-h-0 flex-1 overflow-hidden">
                        {backgroundPath && (
                          <div className="agent-bg-text-layer z-0">
                            <img
                              src={backgroundPath}
                              alt=""
                              aria-hidden
                              className="agent-bg-text-img opacity-20"
                            />
                          </div>
                        )}
                        <img
                          src={portrait}
                          alt={agent?.displayName ?? "Agent"}
                          className="absolute left-1/2 top-0 z-[1] h-[118%] w-auto max-w-none -translate-x-1/2 object-contain object-top brightness-110 contrast-110 drop-shadow-[0_24px_48px_rgba(0,0,0,0.85)]"
                        />
                      </div>
                    </div>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/35 to-transparent" />
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
                    Empty slot
                  </div>
                )}

                {player && (
                  <div className="relative z-10 mt-auto flex min-h-[92px] w-full items-center gap-3 border-t border-white/10 bg-zinc-950/85 px-4 py-5 backdrop-blur-sm sm:min-h-[104px] sm:gap-4 sm:px-5 sm:py-6">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-white/15 bg-white/5 sm:h-16 sm:w-16 lg:h-[4.5rem] lg:w-[4.5rem]">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={player.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-base font-bold text-white sm:text-lg">
                          {(player.name.trim().charAt(0) || "?").toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <PlayerNameWithBadge
                        name={player.name}
                        twitchLogin={player.twitchLogin}
                        twitchImportedName={player.twitchImportedName}
                        avatar={player.avatar}
                        fontSizeClass={getLoadingPlayerNameFontSize(player.name)}
                        fullWidth
                      />
                      <p className="mt-1 truncate text-sm font-bold text-zinc-200 sm:text-base">
                        {isRandomizePending(player)
                          ? "Random agent"
                          : agent?.displayName ?? "No agent"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 space-y-4">
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400 transition-[width] duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={onContinue}
              disabled={!isComplete}
              className={`w-full rounded-xl px-8 py-3.5 text-base font-bold uppercase tracking-[0.15em] text-white transition sm:w-auto sm:min-w-[280px] ${
                isComplete
                  ? "bg-gradient-to-r from-red-500 to-orange-400 shadow-[0_0_32px_rgba(255,70,85,0.35)] hover:brightness-110"
                  : "cursor-not-allowed bg-zinc-600 opacity-50"
              }`}
            >
              Enter Match
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
