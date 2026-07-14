import type { PlayerInGame } from "../types/Game";
import type {
  ActiveSpike,
  SpikeDefuseDiceChoice,
} from "../game/systems/spikeSystem";
import { itemById } from "../../shared/items";

type SpikeDefuseModalProps = {
  player: PlayerInGame;
  spike: ActiveSpike;
  nodeId: string;
  dice1: number | null;
  dice2: number | null;
  previewMode: boolean;
  isResolving: boolean;
  onRollPreview: () => void;
  onChoose: (choice: SpikeDefuseDiceChoice, itemId?: string) => void;
};

const SPIKE_ITEMS = ["wire-cutter", "stim-beacon", "owl-drone", "ultimate-charge"] as const;

export default function SpikeDefuseModal({
  player,
  spike,
  nodeId,
  dice1,
  dice2,
  previewMode,
  isResolving,
  onRollPreview,
  onChoose,
}: SpikeDefuseModalProps) {
  const ownedSpikeItems = SPIKE_ITEMS.filter((id) => player.items?.includes(id));
  const difficulty =
    spike.defuseProgress === 0 ? spike.defuseDifficulty : spike.defuseDifficulty + 1;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/55">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1020]/95 p-8 text-center shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
          Spike Found
        </p>

        <h2 className="mt-4 text-3xl font-bold text-white">{player.name} can defuse</h2>

        <p className="mt-3 text-sm text-zinc-400">Tile: {nodeId}</p>

        <div className="mt-4 rounded-xl border border-orange-400/30 bg-orange-400/10 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-orange-300">Spike Difficulty</p>
          <p className="text-4xl font-black text-white">{difficulty}</p>
          <p className="mt-1 text-xs text-zinc-400">
            Roll 2 dice — beat {difficulty} with your chosen total
            {spike.defuseProgress === 1 ? " (second stage)" : ""}
          </p>
        </div>

        {dice1 == null ? (
          <button
            type="button"
            onClick={onRollPreview}
            disabled={isResolving}
            className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            {isResolving ? "Rolling..." : "Roll Defuse Dice"}
          </button>
        ) : (
          <>
            <div className="mt-6 flex justify-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/20 bg-black/40 text-2xl font-black text-white">
                {previewMode && dice2 == null ? "?" : dice1}
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/20 bg-black/40 text-2xl font-black text-white">
                {dice2 ?? "?"}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                disabled={isResolving || dice2 == null}
                onClick={() => onChoose("roll-both-keep-high")}
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-40"
              >
                Keep Higher Die
              </button>
              <button
                type="button"
                disabled={isResolving || dice2 == null}
                onClick={() => onChoose("roll-both-keep-low")}
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-40"
              >
                Keep Lower Die
              </button>
              {ownedSpikeItems.map((itemId) => {
                const item = itemById.get(itemId);
                return (
                  <button
                    key={itemId}
                    type="button"
                    disabled={isResolving || dice2 == null}
                    onClick={() =>
                      onChoose(
                        itemId === "ultimate-charge" ? "use-ultimate" : "use-item",
                        itemId
                      )
                    }
                    className="rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-sm font-semibold text-violet-200 hover:bg-violet-400/20 disabled:opacity-40"
                  >
                    Use {item?.name ?? itemId}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
