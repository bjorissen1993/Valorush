type ShopSpeechBubbleProps = {
  speaker: string;
  text: string;
  accent?: "emerald" | "cyan" | "crimson" | "gold" | "violet" | "lime";
  className?: string;
};

const styles = {
  emerald: {
    border: "border-emerald-400/45",
    label: "text-emerald-300",
  },
  cyan: {
    border: "border-cyan-400/45",
    label: "text-cyan-300",
  },
  crimson: {
    border: "border-red-400/45",
    label: "text-red-300",
  },
  gold: {
    border: "border-amber-400/45",
    label: "text-amber-300",
  },
  violet: {
    border: "border-violet-400/45",
    label: "text-violet-300",
  },
  lime: {
    border: "border-lime-400/45",
    label: "text-lime-300",
  },
};

export default function ShopSpeechBubble({
  speaker,
  text,
  accent = "emerald",
  className = "",
}: ShopSpeechBubbleProps) {
  const tone = styles[accent];

  return (
    <div className={`relative w-full animate-fadeIn ${className}`}>
      <div
        className={`relative w-full rounded-2xl border-2 bg-[#0b1020]/98 px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${tone.border}`}
      >
        <p className={`text-xs font-bold uppercase tracking-[0.2em] ${tone.label}`}>
          {speaker}
        </p>
        <p className="mt-2 text-base italic leading-relaxed text-white">
          &ldquo;{text}&rdquo;
        </p>
      </div>
    </div>
  );
}
