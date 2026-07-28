import DiceFace from "./DiceFace";

export type DiceOverlayPhase = "ready" | "rolling" | "revealing" | "result";

type DiceRollOverlayProps = {
  open: boolean;
  value: number | null;
  /** Individual die faces (always 2 for the default 2d6 roll). */
  dice?: number[] | null;
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
  dice,
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
  const faces =
    dice && dice.length >= 2
      ? dice.slice(0, 2)
      : [Math.max(1, Math.min(6, value)), Math.max(1, Math.min(6, value))];

  return (
    <div className="pointer-events-none fixed inset-0 z-[85] flex items-end justify-center bg-gradient-to-t from-black/75 via-black/35 to-transparent pb-[12vh] animate-fadeIn sm:items-center sm:bg-black/55 sm:pb-0">
      <div
        className={`dice-roll-stage pointer-events-auto flex flex-col items-center ${
          rolling || revealing
            ? "dice-roll-stage--rolling dice-roll-stage--bounce"
            : "dice-roll-stage--landed"
        }`}
      >
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          {getStatusLabel(playerName, phase)}
        </p>

        <div className="dice-roll-pair flex items-end gap-5">
          {faces.map((face, index) => (
            <div
              key={`die-${index}`}
              className={`dice-roll-die dice-roll-die--${index + 1}`}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <DiceFace
                value={face}
                rolling={rolling}
                revealing={revealing}
                idle={idle}
                size="md"
                showValue={false}
                rollDurationMs={rollDurationMs}
              />
            </div>
          ))}
        </div>

        {phase === "result" && (
          <p className="dice-roll-total mt-5 text-4xl font-black tracking-tight text-white">
            {value}
            <span className="ml-2 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
              spaces
            </span>
          </p>
        )}

        {showAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-7 rounded-2xl bg-cyan-400 px-10 py-4 text-lg font-bold text-black transition hover:brightness-110"
          >
            {actionLabel ?? defaultActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
