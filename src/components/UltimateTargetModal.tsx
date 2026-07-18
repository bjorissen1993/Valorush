import { useState, type ReactNode } from "react";
import type { UltimateDefinition, UltimatePathOption } from "../../shared/ultimates";
import { formatNodeLabel } from "../game/ultimates/boardHelpers";

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
type EdgeOption = { from: string; to: string; label: string };

type UltimateTargetModalProps = {
  open: boolean;
  ultimate: UltimateDefinition;
  casterName: string;
  otherPlayers: PlayerOption[];
  boardNodeIds: string[];
  paths: UltimatePathOption[];
  edges: EdgeOption[];
  cypherReveal?: {
    players: {
      playerIndex: number;
      name: string;
      creds: number;
      items: string[];
      ultimateOrbs: number;
    }[];
  } | null;
  /** When true, Cypher already revealed — only steal pick is shown. */
  cypherStealPhase?: boolean;
  onConfirm: (selection: UltimateTargetSelection) => void;
  onCancel: () => void;
};

export default function UltimateTargetModal({
  open,
  ultimate,
  casterName,
  otherPlayers,
  boardNodeIds,
  paths,
  edges,
  cypherReveal = null,
  cypherStealPhase = false,
  onConfirm,
  onCancel,
}: UltimateTargetModalProps) {
  if (!open) return null;

  const kind = ultimate.targetKind;

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

  if (cypherStealPhase && cypherReveal) {
    return (
      <ModalShell
        title="Neural Theft — Steal"
        subtitle="Intel revealed. Pick whose item to steal."
        onCancel={onCancel}
      >
        <ul className="mb-4 space-y-2 text-sm">
          {cypherReveal.players.map((p) => (
            <li
              key={p.playerIndex}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            >
              <p className="font-semibold text-white">{p.name}</p>
              <p className="text-zinc-400">
                {p.creds} creds · {p.ultimateOrbs}/3 orbs ·{" "}
                {p.items.length ? p.items.join(", ") : "no items"}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          {otherPlayers.map((p) => (
            <button
              key={p.index}
              type="button"
              className="ultimate-modal__option"
              onClick={() =>
                onConfirm({
                  stealFromPlayerIndex: p.index,
                  targetPlayerIndex: p.index,
                })
              }
            >
              Steal from {p.name}
            </button>
          ))}
        </div>
      </ModalShell>
    );
  }

  if (kind === "player_or_choice") {
    return (
      <RazePicker
        ultimate={ultimate}
        otherPlayers={otherPlayers}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }

  if (kind === "player") {
    const isCypher = ultimate.id === "neural-theft";
    return (
      <ModalShell title={ultimate.name} subtitle={ultimate.description} onCancel={onCancel}>
        {isCypher && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-cyan-300">
            Opponent intel (Neural Theft)
          </p>
        )}
        <div className="flex flex-col gap-2">
          {otherPlayers.map((p) => (
            <button
              key={p.index}
              type="button"
              className="ultimate-modal__option"
              onClick={() =>
                onConfirm({
                  targetPlayerIndex: p.index,
                  stealFromPlayerIndex: isCypher ? p.index : undefined,
                })
              }
            >
              <span className="font-semibold text-white">{p.name}</span>
              {isCypher && (
                <span className="mt-1 block text-xs text-zinc-400">
                  {p.creds} creds · {p.ultimateOrbs ?? 0}/3 orbs ·{" "}
                  {p.items?.length ? p.items.join(", ") : "no items"}
                </span>
              )}
            </button>
          ))}
        </div>
      </ModalShell>
    );
  }

  if (kind === "tile" || kind === "tile_and_move") {
    return (
      <ModalShell title={ultimate.name} subtitle={ultimate.description} onCancel={onCancel}>
        <div className="ultimate-modal__grid">
          {boardNodeIds.map((nodeId) => (
            <button
              key={nodeId}
              type="button"
              className="ultimate-modal__option ultimate-modal__option--compact"
              onClick={() => onConfirm({ targetNodeId: nodeId })}
            >
              {formatNodeLabel(nodeId)}
            </button>
          ))}
        </div>
      </ModalShell>
    );
  }

  if (kind === "path") {
    return (
      <ModalShell title={ultimate.name} subtitle={ultimate.description} onCancel={onCancel}>
        <div className="flex flex-col gap-2">
          {paths.map((path) => (
            <button
              key={path.id}
              type="button"
              className="ultimate-modal__option"
              onClick={() =>
                onConfirm({ choiceId: path.id, targetNodeId: path.id })
              }
            >
              {path.label}
            </button>
          ))}
        </div>
      </ModalShell>
    );
  }

  if (kind === "edge") {
    return (
      <ModalShell title={ultimate.name} subtitle={ultimate.description} onCancel={onCancel}>
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {edges.map((edge) => (
            <button
              key={`${edge.from}->${edge.to}`}
              type="button"
              className="ultimate-modal__option"
              onClick={() =>
                onConfirm({
                  targetNodeId: edge.from,
                  targetNodeId2: edge.to,
                })
              }
            >
              {edge.label}
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

  return null;
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

function RazePicker({
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
  return (
    <ModalShell
      title={ultimate.name}
      subtitle="Pick a target, then the blast type."
      onCancel={onCancel}
    >
      <div className="space-y-4">
        {otherPlayers.map((p) => (
          <div
            key={p.index}
            className="rounded-xl border border-white/10 bg-black/25 p-3"
          >
            <p className="mb-2 font-semibold text-white">{p.name}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="ultimate-modal__btn ultimate-modal__btn--primary"
                onClick={() =>
                  onConfirm({
                    targetPlayerIndex: p.index,
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
                    targetPlayerIndex: p.index,
                    razeMode: "spaces",
                    choiceId: "spaces",
                  })
                }
              >
                Back 4 Spaces
              </button>
            </div>
          </div>
        ))}
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
