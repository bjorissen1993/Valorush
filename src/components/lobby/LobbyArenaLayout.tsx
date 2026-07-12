import type { ReactNode } from "react";

type LobbyArenaLayoutProps = {
  slots: ReactNode[];
  roster: ReactNode;
};

export default function LobbyArenaLayout({
  slots,
  roster,
}: LobbyArenaLayoutProps) {
  const [topLeft, topRight, bottomLeft, bottomRight] = slots;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[1.15fr_minmax(180px,0.95fr)_1.15fr] sm:grid-rows-2 sm:gap-4">
      <div className="min-h-[140px] overflow-visible sm:col-start-1 sm:row-start-1 sm:min-h-0">
        {topLeft}
      </div>
      <div className="min-h-[140px] overflow-visible sm:col-start-3 sm:row-start-1 sm:min-h-0">
        {topRight}
      </div>
      <div className="order-first min-h-[220px] sm:order-none sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:min-h-0">
        {roster}
      </div>
      <div className="min-h-[140px] overflow-visible sm:col-start-1 sm:row-start-2 sm:min-h-0">
        {bottomLeft}
      </div>
      <div className="min-h-[140px] overflow-visible sm:col-start-3 sm:row-start-2 sm:min-h-0">
        {bottomRight}
      </div>
    </div>
  );
}
