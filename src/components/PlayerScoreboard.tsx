import type { PlayerInGame } from "../types/Game";

type Props = {
  players: PlayerInGame[];
  currentPlayerIndex: number;
};

export default function PlayerScoreboard({
  players,
  currentPlayerIndex,
}: Props) {
  const highestRadianite = Math.max(
    0,
    ...players.map((player) => player.radianitePoints)
  );

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {players.map((player, index) => {
        const isCurrentTurn = index === currentPlayerIndex;
        const isLeader =
          highestRadianite > 0 &&
          player.radianitePoints === highestRadianite;

        return (
          <div
            key={player.id}
            className={[
              "relative flex h-44 flex-col justify-between overflow-hidden rounded-2xl border p-4 shadow-md transition-all",
              "bg-white/5 border-white/10",
              isCurrentTurn ? "scale-[1.02] border-white/50" : "",
              isLeader ? "ring-2 ring-yellow-400" : "",
            ].join(" ")}
          >
            {isLeader && (
              <div className="absolute right-3 top-3 rounded-full bg-yellow-400/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-yellow-300">
                Lead
              </div>
            )}

            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 shrink-0 rounded-full border border-white/30"
                style={{ backgroundColor: player.color }}
              />
              <div className="min-w-0">
                <div className="truncate text-lg font-extrabold text-white">
                  {player.name}
                </div>
                <div className="truncate text-sm font-semibold text-white/70">
                  {player.selectedAgentId ?? "No agent selected"}
                </div>
              </div>
            </div>

            <div className="my-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-black/20 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-white/50">
                  Creds
                </div>
                <div className="text-sm font-bold text-white">
                  {player.creds}
                </div>
              </div>

              <div className="rounded-xl bg-black/20 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-white/50">
                  Loadout
                </div>
                <div className="truncate text-sm font-bold text-white">
                  {[
                    player.primaryWeapon ?? player.weapon,
                    player.secondaryWeapon,
                    player.shield,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Empty"}
                </div>
              </div>
            </div>

            <div className="flex min-h-[32px] items-center gap-2 text-xs">
              <div className="rounded-full bg-cyan-400/10 px-2 py-1 font-medium text-cyan-300">
                ✦ {player.radianitePoints}
              </div>

              <div
                className={[
                  "rounded-full px-2 py-1 font-medium transition-opacity",
                  player.nextWeaponDiscount > 0
                    ? "bg-emerald-500/10 text-emerald-300 opacity-100"
                    : "opacity-0 pointer-events-none",
                ].join(" ")}
              >
                -{player.nextWeaponDiscount} discount
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}