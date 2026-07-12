type PathChoiceOverlayProps = {
  open: boolean;
  playerName: string;
  options: string[];
  onChoose: (option: string) => void;
  getLabel: (fromNodeId: string, toNodeId: string) => string;
  atNodeId: string;
};

export default function PathChoiceOverlay({
  open,
  playerName,
  options,
  onChoose,
  getLabel,
  atNodeId,
}: PathChoiceOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex animate-fadeIn items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-yellow-400/25 bg-[#0b1020]/95 p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-300">
          Split Path
        </p>
        <h2 className="mt-3 text-2xl font-bold text-white">Choose your route</h2>
        <p className="mt-2 text-sm text-zinc-400">
          <span className="font-semibold text-white">{playerName}</span> landed on a
          split tile. Pick which way to go.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChoose(option)}
              className="rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-left font-semibold text-white transition hover:border-yellow-400/30 hover:bg-yellow-400/10"
            >
              {getLabel(atNodeId, option)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
