import DiceFace from "./DiceFace";

export type DiceOverlayPhase = "ready" | "rolling" | "revealing" | "result";

type DiceRollOverlayProps = {
  open: boolean;
  value: number | null;
  playerName: string;
  phase: DiceOverlayPhase;
  rollDurationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
};

function getStatusLabel(playerName: string, phase: DiceOverlayPhase) {
  switch (phase) {
    case "ready":
      return `${playerName}'s roll`;
    case "rolling":
      return `${playerName} rolls`;
    case "revealing":
      return "Locking in";
    default:
      return "Rolled";
  }
}

export default function DiceRollOverlay({
  open,
  value,
  playerName,
  phase,
  rollDurationMs = 1400,
  actionLabel,
  onAction,
}: DiceRollOverlayProps) {
  if (!open || value == null) return null;

  const rolling = phase === "rolling";
  const revealing = phase === "revealing";
  const idle = phase === "ready";
  const showAction = (phase === "ready" || phase === "result") && onAction;
  const defaultActionLabel =
    phase === "ready" ? "Roll dice" : "Start moving";

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/72 animate-fadeIn">
      <div
        className={`dice-roll-stage flex flex-col items-center ${
          rolling || revealing
            ? "dice-roll-stage--rolling"
            : "dice-roll-stage--landed"
        }`}
      >
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          {getStatusLabel(playerName, phase)}
        </p>

        <DiceFace
          value={value}
          rolling={rolling}
          revealing={revealing}
          idle={idle}
          size="md"
          showValue={phase === "result"}
          rollDurationMs={rollDurationMs}
        />

        {showAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-8 rounded-2xl bg-cyan-400 px-10 py-4 text-lg font-bold text-black transition hover:brightness-110"
          >
            {actionLabel ?? defaultActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
