import { useEffect, useState } from "react";
import { customMatchById } from "../../shared/customMatches";
import type { ValorantMapId } from "../../shared/customMatches/types";
import { mapLoadingPath, pointsIconPath } from "../game/assetPaths";

type MapRevealPresentationProps = {
  matchId: string;
  mapId: ValorantMapId;
  onComplete: () => void;
  introDurationMs?: number;
};

export default function MapRevealPresentation({
  matchId,
  mapId,
  onComplete,
  introDurationMs = 4200,
}: MapRevealPresentationProps) {
  const [phase, setPhase] = useState<"alarm" | "doors" | "reveal">("alarm");
  const match = customMatchById.get(matchId as Parameters<typeof customMatchById.get>[0]);

  useEffect(() => {
    setPhase("alarm");
    const doorTimer = window.setTimeout(() => setPhase("doors"), 800);
    const revealTimer = window.setTimeout(() => setPhase("reveal"), 1600);
    const completeTimer = window.setTimeout(onComplete, introDurationMs);
    return () => {
      window.clearTimeout(doorTimer);
      window.clearTimeout(revealTimer);
      window.clearTimeout(completeTimer);
    };
  }, [matchId, mapId, introDurationMs, onComplete]);

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/90 p-4 director-shake">
      <div className="director-alarm-scanlines pointer-events-none absolute inset-0" />
      <div className="director-alarm-bar director-alarm-bar--top" />
      <div className="director-alarm-bar director-alarm-bar--bottom" />

      <div className="relative w-full max-w-2xl text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <img src={pointsIconPath("kingdom")} alt="" className="h-8 w-8 opacity-90" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-300">
            Custom Match Incoming
          </p>
        </div>

        {phase === "alarm" && (
          <p className="animate-pulse text-lg font-bold uppercase tracking-widest text-red-400">
            Kingdom Alert — Sector Lockdown
          </p>
        )}

        {(phase === "doors" || phase === "reveal") && (
          <div className="director-kingdom-frame mx-auto mb-6 h-2 w-64 rounded-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        )}

        {phase === "reveal" && (
          <div className="overflow-hidden rounded-2xl border-2 border-red-400/50 shadow-[0_0_60px_rgba(239,68,68,0.25)]">
            <img
              src={mapLoadingPath(mapId)}
              alt={mapId}
              className="h-64 w-full object-cover md:h-80"
            />
            <div className="border-t border-white/10 bg-[#0b1020]/95 px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                {match?.name ?? "Custom Match"}
              </p>
              <h2 className="mt-2 text-3xl font-black uppercase text-white">{mapId}</h2>
              <p className="mt-2 text-sm text-zinc-400">
                {match?.rulesStub ?? "Engagement starting now."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
