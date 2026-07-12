import SoldOutStamp from "./SoldOutStamp";

type ValorantCrateProps = {
  children: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  soldOut?: boolean;
  onClick?: () => void;
  className?: string;
};

export default function ValorantCrate({
  children,
  selected = false,
  disabled = false,
  soldOut = false,
  onClick,
  className = "",
}: ValorantCrateProps) {
  const isInactive = disabled || soldOut;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isInactive}
      className={`valorant-crate group relative flex h-full w-full flex-col text-left transition duration-200 ${isInactive ? "cursor-not-allowed" : "hover:brightness-110"} ${disabled && !soldOut ? "opacity-40" : ""} ${selected ? "valorant-crate--selected" : ""} ${soldOut ? "valorant-crate--sold-out" : ""} ${className}`}
    >
      <div className="valorant-crate-shell relative flex h-full min-h-0 flex-col overflow-hidden">
        <div className="valorant-crate-face absolute inset-[1px] bg-gradient-to-b from-[#222d3f] via-[#141b28] to-[#0a1019]" />
        <div className="valorant-crate-rim pointer-events-none absolute inset-0" />
        <div className="valorant-crate-lid pointer-events-none absolute inset-x-3 top-0 h-[3px] bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent opacity-70" />
        <div
          className={`relative z-[2] flex min-h-0 flex-1 flex-col p-3 md:p-4 ${soldOut ? "valorant-crate-content--sold" : ""}`}
        >
          {children}
        </div>
        {soldOut && <SoldOutStamp />}
      </div>
    </button>
  );
}
