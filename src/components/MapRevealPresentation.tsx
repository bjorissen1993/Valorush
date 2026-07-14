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

type RevealPhase = "drop" | "landing" | "open" | "reveal";

const DROP_MS = 900;
const LANDING_MS = 400;
const OPEN_MS = 800;

export default function MapRevealPresentation({
  matchId,
  mapId,
  onComplete,
  introDurationMs = 4200,
}: MapRevealPresentationProps) {
  const [phase, setPhase] = useState<RevealPhase>("drop");
  const match = customMatchById.get(matchId as Parameters<typeof customMatchById.get>[0]);

  useEffect(() => {
    setPhase("drop");
    const landingTimer = window.setTimeout(() => setPhase("landing"), DROP_MS);
    const openTimer = window.setTimeout(() => setPhase("open"), DROP_MS + LANDING_MS);
    const revealTimer = window.setTimeout(
      () => setPhase("reveal"),
      DROP_MS + LANDING_MS + OPEN_MS,
    );
    const completeTimer = window.setTimeout(onComplete, introDurationMs);
    return () => {
      window.clearTimeout(landingTimer);
      window.clearTimeout(openTimer);
      window.clearTimeout(revealTimer);
      window.clearTimeout(completeTimer);
    };
  }, [matchId, mapId, introDurationMs, onComplete]);

  const isOpen = phase === "open" || phase === "reveal";

  return (
    <div className="fixed inset-0 z-[85] flex flex-col items-center justify-center bg-black/92 p-4">
      <div className="map-reveal-backdrop pointer-events-none absolute inset-0" />

      <div className="relative z-10 mb-8 flex items-center justify-center gap-2">
        <img src={pointsIconPath("kingdom")} alt="" className="h-8 w-8 opacity-90" />
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/90">
          Custom Match Incoming
        </p>
      </div>

      <div className="map-reveal-drop-wrapper relative z-10">
        <div
          className={[
            "map-reveal-tablet",
            phase === "landing" ? "map-reveal-tablet--landing" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="map-reveal-device">
            <div className="map-reveal-device__bezel" aria-hidden="true" />
            <div className="map-reveal-device__holo-edge map-reveal-device__holo-edge--top" />
            <div className="map-reveal-device__holo-edge map-reveal-device__holo-edge--bottom" />

            <div className="map-reveal-device__screen">
              <div
                className={[
                  "map-reveal-device__door map-reveal-device__door--left",
                  isOpen ? "map-reveal-device__door--open" : "",
                  phase === "reveal" ? "map-reveal-device__door--hidden" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="map-reveal-device__door-face map-reveal-device__door-face--left">
                  <span className="map-reveal-device__door-mark" />
                </div>
              </div>

              <div
                className={[
                  "map-reveal-device__door map-reveal-device__door--right",
                  isOpen ? "map-reveal-device__door--open" : "",
                  phase === "reveal" ? "map-reveal-device__door--hidden" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="map-reveal-device__door-face map-reveal-device__door-face--right">
                  <span className="map-reveal-device__door-mark" />
                </div>
              </div>

              {phase === "open" && (
                <div className="map-reveal-device__screen-burst" aria-hidden="true" />
              )}

              {phase === "reveal" && (
                <div className="map-reveal-content">
                  <img
                    src={mapLoadingPath(mapId)}
                    alt={mapId}
                    className="map-reveal-content__map h-52 w-full object-cover md:h-64"
                  />
                  <div className="map-reveal-content__footer border-t border-cyan-400/20 bg-[#060a14]/95 px-5 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-400/70">
                      {match?.name ?? "Custom Match"}
                    </p>
                    <h2 className="mt-1.5 text-2xl font-black uppercase tracking-wide text-white md:text-3xl">
                      {mapId}
                    </h2>
                    <p className="mt-1.5 text-xs text-zinc-400 md:text-sm">
                      {match?.rulesStub ?? "Engagement starting now."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="map-reveal-device__chin">
              <span className="map-reveal-device__indicator" />
              <span className="map-reveal-device__indicator map-reveal-device__indicator--dim" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
