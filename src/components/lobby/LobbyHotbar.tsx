import type { ReactNode } from "react";

type LobbyHotbarProps = {
  children: ReactNode;
};

export default function LobbyHotbar({ children }: LobbyHotbarProps) {
  return (
    <div className="shrink-0 border-b border-white/10 bg-zinc-950/95 px-3 py-2.5 sm:px-5 sm:py-3 lg:px-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">{children}</div>
    </div>
  );
}
