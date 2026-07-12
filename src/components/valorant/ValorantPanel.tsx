type ValorantPanelProps = {
  children: React.ReactNode;
  accent?: "emerald" | "cyan" | "neutral";
  className?: string;
};

const accentMap = {
  emerald: {
    border: "border border-emerald-400/35",
    glow: "shadow-[0_0_20px_rgba(52,211,153,0.12)]",
    corner: "border-emerald-400/70",
  },
  cyan: {
    border: "border border-cyan-400/35",
    glow: "shadow-[0_0_20px_rgba(34,211,238,0.12)]",
    corner: "border-cyan-400/70",
  },
  neutral: {
    border: "border border-white/15",
    glow: "",
    corner: "border-white/35",
  },
};

export default function ValorantPanel({
  children,
  accent = "neutral",
  className = "",
}: ValorantPanelProps) {
  const colors = accentMap[accent];

  return (
    <div
      className={`valorant-panel relative bg-gradient-to-br from-[#1c2636] to-[#0a0f18] ${colors.border} ${colors.glow} ${className}`}
    >
      <span
        className={`pointer-events-none absolute left-4 top-4 h-2.5 w-2.5 border-l border-t ${colors.corner}`}
      />
      <span
        className={`pointer-events-none absolute bottom-4 right-4 h-2.5 w-2.5 border-b border-r ${colors.corner}`}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
