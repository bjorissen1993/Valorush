import type { EventChoiceSpec } from "../../shared/events";
import type { PlayerInGame } from "../types/Game";

type EventChoiceModalProps = {
  eventTitle: string;
  eventDescription: string;
  choiceSpec: EventChoiceSpec;
  players: PlayerInGame[];
  triggerPlayerIndex: number;
  onFixedChoice: (choiceId: string) => void;
  onPickPlayer: (targetIndex: number) => void;
  onBetAmount: (amount: number) => void;
  onCancel?: () => void;
};

export default function EventChoiceModal({
  eventTitle,
  eventDescription,
  choiceSpec,
  players,
  triggerPlayerIndex,
  onFixedChoice,
  onPickPlayer,
  onBetAmount,
}: EventChoiceModalProps) {
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1020]/95 p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-violet-300">
          Your Choice
        </p>
        <h2 className="mt-4 text-2xl font-bold text-white">{eventTitle}</h2>
        <p className="mt-2 text-sm text-zinc-400">{eventDescription}</p>

        {choiceSpec.kind === "fixed" && (
          <div className="mt-6 flex flex-col gap-2">
            {choiceSpec.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onFixedChoice(opt.id)}
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:bg-white/5"
              >
                <span className="font-semibold text-white">{opt.label}</span>
                {opt.description && (
                  <span className="mt-1 block text-sm text-zinc-400">{opt.description}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {choiceSpec.kind === "pick_player" && (
          <div className="mt-6 flex flex-col gap-2">
            <p className="text-sm text-zinc-400">
              {choiceSpec.label ?? "Select a player"}
            </p>
            {players.map((player, index) => {
              if (choiceSpec.excludeSelf && index === triggerPlayerIndex) return null;
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onPickPlayer(index)}
                  className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left font-medium text-white transition hover:bg-white/5"
                >
                  {player.name}
                </button>
              );
            })}
          </div>
        )}

        {choiceSpec.kind === "bet_creds" && (
          <div className="mt-6 flex flex-wrap gap-2">
            <p className="w-full text-sm text-zinc-400">
              {choiceSpec.label ?? "Choose your stake"}
            </p>
            {choiceSpec.presets.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => onBetAmount(amount)}
                disabled={players[triggerPlayerIndex]?.creds < amount}
                className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 font-bold text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-40"
              >
                {amount} Creds
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
