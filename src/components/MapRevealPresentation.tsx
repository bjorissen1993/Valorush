import { useEffect, useRef, useState } from "react";
import { CUSTOM_MATCH_CATEGORY_LABELS, getCustomMatchDefinition } from "../../shared/customMatches";
import type { ValorantMapId } from "../../shared/customMatches/types";
import { mapLoadingPath, pointsIconPath } from "../game/assetPaths";

type MapRevealPresentationProps = {
  matchId: string;
  mapId: ValorantMapId;
  onComplete: () => void;
};

type RevealPhase = "drop" | "landing" | "open" | "reveal";

export const MAP_REVEAL_DROP_MS = 900;
export const MAP_REVEAL_LANDING_MS = 400;
export const MAP_REVEAL_OPEN_MS = 800;
export const MAP_REVEAL_HOLD_MS = 1800;

export const MAP_REVEAL_TOTAL_MS =
  MAP_REVEAL_DROP_MS + MAP_REVEAL_LANDING_MS + MAP_REVEAL_OPEN_MS + MAP_REVEAL_HOLD_MS;

export default function MapRevealPresentation({
  matchId,
  mapId,
  onComplete,
}: MapRevealPresentationProps) {
  const [phase, setPhase] = useState<RevealPhase>("drop");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const match = getCustomMatchDefinition(matchId);
  const categoryLabel = match ? CUSTOM_MATCH_CATEGORY_LABELS[match.category] : null;

  useEffect(() => {
    setPhase("drop");

    const landingTimer = window.setTimeout(
      () => setPhase("landing"),
      MAP_REVEAL_DROP_MS,
    );
    const openTimer = window.setTimeout(
      () => setPhase("open"),
      MAP_REVEAL_DROP_MS + MAP_REVEAL_LANDING_MS,
    );
    const revealTimer = window.setTimeout(
      () => setPhase("reveal"),
      MAP_REVEAL_DROP_MS + MAP_REVEAL_LANDING_MS + MAP_REVEAL_OPEN_MS,
    );
    const completeTimer = window.setTimeout(
      () => onCompleteRef.current(),
      MAP_REVEAL_TOTAL_MS,
    );

    return () => {
      window.clearTimeout(landingTimer);
      window.clearTimeout(openTimer);
      window.clearTimeout(revealTimer);
      window.clearTimeout(completeTimer);
    };
  }, [matchId, mapId]);

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
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-400/70">
                        {match?.name ?? "Custom Match"}
                      </p>
                      {categoryLabel && (
                        <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300 ring-1 ring-violet-400/25">
                          {categoryLabel}
                        </span>
                      )}
                      {match?.playerFormat && (
                        <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300 ring-1 ring-zinc-400/20">
                          {match.playerFormat}
                        </span>
                      )}
                    </div>
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
