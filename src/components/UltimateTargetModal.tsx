import { useState, type ReactNode } from "react";
import type { UltimateDefinition } from "../../shared/ultimates";

export type UltimateTargetSelection = {
  targetPlayerIndex?: number;
  targetNodeId?: string;
  targetNodeId2?: string;
  choiceId?: string;
  opponentChoices?: Record<number, "pay" | "skip">;
  razeMode?: "creds" | "spaces";
  stealFromPlayerIndex?: number;
};

type PlayerOption = {
  index: number;
  name: string;
  creds: number;
  items?: string[];
  ultimateOrbs?: number;
};

type UltimateTargetModalProps = {
  open: boolean;
  ultimate: UltimateDefinition;
  casterName: string;
  otherPlayers: PlayerOption[];
  /**
   * When set, Showstopper already selected a player on the board —
   * only the blast-type choice is shown.
   */
  razeTargetPlayer?: PlayerOption | null;
  onConfirm: (selection: UltimateTargetSelection) => void;
  onCancel: () => void;
};

/**
 * Choice / confirm modal for ultimates that are not board-targeted.
 * Tile, player, path, and edge picks happen on the map via board targeting.
 */
export default function UltimateTargetModal({
  open,
  ultimate,
  casterName,
  otherPlayers,
  razeTargetPlayer = null,
  onConfirm,
  onCancel,
}: UltimateTargetModalProps) {
  if (!open) return null;

  const kind = ultimate.targetKind;

  if (razeTargetPlayer) {
    return (
      <RazeModePicker
        ultimate={ultimate}
        player={razeTargetPlayer}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }

  if (kind === "none") {
    return (
      <ModalShell title={ultimate.name} subtitle={ultimate.description} onCancel={onCancel}>
        <p className="text-sm text-zinc-400">
          {casterName} activates{" "}
          <span className="font-semibold text-white">{ultimate.name}</span>.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="ultimate-modal__btn ultimate-modal__btn--primary"
            onClick={() => onConfirm({})}
          >
            Activate
          </button>
          <button type="button" className="ultimate-modal__btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </ModalShell>
    );
  }

  if (kind === "choice" && ultimate.choices) {
    return (
      <ModalShell title={ultimate.name} subtitle={ultimate.description} onCancel={onCancel}>
        <div className="flex flex-col gap-2">
          {ultimate.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className="ultimate-modal__option"
              onClick={() => onConfirm({ choiceId: choice.id })}
            >
              <span className="font-semibold text-white">{choice.label}</span>
              {choice.description && (
                <span className="mt-1 block text-xs text-zinc-400">
                  {choice.description}
                </span>
              )}
            </button>
          ))}
        </div>
      </ModalShell>
    );
  }

  if (kind === "sequential_opponents") {
    return (
      <KilljoyPicker
        ultimate={ultimate}
        otherPlayers={otherPlayers}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }

  // Fallback: should not open for board-targeted kinds.
  return (
    <ModalShell title={ultimate.name} subtitle={ultimate.description} onCancel={onCancel}>
      <p className="text-sm text-zinc-400">
        Select your target on the board, then confirm.
      </p>
      <button type="button" className="ultimate-modal__cancel" onClick={onCancel}>
        Cancel
      </button>
    </ModalShell>
  );
}

function ModalShell({
  title,
  subtitle,
  onCancel,
  children,
}: {
  title: string;
  subtitle: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[85] flex animate-fadeIn items-center justify-center bg-black/60 p-4">
      <div className="ultimate-modal">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-300">
          Ultimate
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>
        <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
        <div className="mt-5">{children}</div>
        <button type="button" className="ultimate-modal__cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function RazeModePicker({
  ultimate,
  player,
  onConfirm,
  onCancel,
}: {
  ultimate: UltimateDefinition;
  player: PlayerOption;
  onConfirm: (selection: UltimateTargetSelection) => void;
  onCancel: () => void;
}) {
  return (
    <ModalShell
      title={ultimate.name}
      subtitle={`Blast ${player.name} — choose the effect.`}
      onCancel={onCancel}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="ultimate-modal__btn ultimate-modal__btn--primary"
          onClick={() =>
            onConfirm({
              targetPlayerIndex: player.index,
              razeMode: "creds",
              choiceId: "creds",
            })
          }
        >
          −600 Creds
        </button>
        <button
          type="button"
          className="ultimate-modal__btn"
          onClick={() =>
            onConfirm({
              targetPlayerIndex: player.index,
              razeMode: "spaces",
              choiceId: "spaces",
            })
          }
        >
          Back 4 Spaces
        </button>
      </div>
    </ModalShell>
  );
}

function KilljoyPicker({
  ultimate,
  otherPlayers,
  onConfirm,
  onCancel,
}: {
  ultimate: UltimateDefinition;
  otherPlayers: PlayerOption[];
  onConfirm: (selection: UltimateTargetSelection) => void;
  onCancel: () => void;
}) {
  const [choices, setChoices] = useState<Record<number, "pay" | "skip">>(() => {
    const initial: Record<number, "pay" | "skip"> = {};
    for (const p of otherPlayers) {
      initial[p.index] = p.creds >= 300 ? "pay" : "skip";
    }
    return initial;
  });

  return (
    <ModalShell title={ultimate.name} subtitle={ultimate.description} onCancel={onCancel}>
      <div className="space-y-3">
        {otherPlayers.map((p) => (
          <div
            key={p.index}
            className="rounded-xl border border-white/10 bg-black/25 p-3"
          >
            <p className="mb-2 font-semibold text-white">
              {p.name}{" "}
              <span className="text-xs font-normal text-zinc-500">
                ({p.creds} creds)
              </span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`ultimate-modal__btn ${
                  choices[p.index] === "pay" ? "ultimate-modal__btn--primary" : ""
                }`}
                disabled={p.creds < 300}
                onClick={() => setChoices({ ...choices, [p.index]: "pay" })}
              >
                Pay 300
              </button>
              <button
                type="button"
                className={`ultimate-modal__btn ${
                  choices[p.index] === "skip" ? "ultimate-modal__btn--primary" : ""
                }`}
                onClick={() => setChoices({ ...choices, [p.index]: "skip" })}
              >
                Skip next turn
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="ultimate-modal__btn ultimate-modal__btn--primary mt-4"
        onClick={() => onConfirm({ opponentChoices: choices })}
      >
        Lock them down
      </button>
    </ModalShell>
  );
}
