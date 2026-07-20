import { useEffect, useRef } from "react";
import type { UltimateCastCue } from "../../shared/ultimates";
import { resolveAgentPortraitImage } from "../game/assetPaths";

type UltimateCastPresentationProps = {
  cue: UltimateCastCue;
  onComplete: () => void;
};

/**
 * Full-screen cast flourish after an ultimate resolves.
 * Does not block input forever — auto-dismisses after cue.durationMs.
 */
export default function UltimateCastPresentation({
  cue,
  onComplete,
}: UltimateCastPresentationProps) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onCompleteRef.current();
    }, cue.durationMs);
    return () => window.clearTimeout(timer);
  }, [cue.id, cue.durationMs]);

  const portrait = resolveAgentPortraitImage(cue.agentName);

  return (
    <div
      className={`ult-cast-overlay ult-cast-overlay--${cue.theme}`}
      role="status"
      aria-live="polite"
      aria-label={`${cue.agentName} cast ${cue.ultimateName}`}
    >
      <div className="ult-cast-overlay__veil" aria-hidden />
      <div className="ult-cast-overlay__burst" aria-hidden />
      <div className="ult-cast-overlay__particles" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            className="ult-cast-overlay__particle"
            style={{ ["--i" as string]: i }}
          />
        ))}
      </div>

      <div className="ult-cast-overlay__banner">
        {cue.iconUrl ? (
          <div className="ult-cast-overlay__ability-wrap">
            <img
              src={cue.iconUrl}
              alt=""
              className="ult-cast-overlay__ability"
            />
          </div>
        ) : null}
        <div className="ult-cast-overlay__portrait-wrap">
          <img
            src={portrait}
            alt=""
            className="ult-cast-overlay__portrait"
          />
        </div>
        <div className="ult-cast-overlay__text">
          <p className="ult-cast-overlay__agent">{cue.agentName}</p>
          <h2 className="ult-cast-overlay__ult">{cue.ultimateName}</h2>
          <p className="ult-cast-overlay__caster">{cue.casterName}</p>
        </div>
      </div>
    </div>
  );
}
