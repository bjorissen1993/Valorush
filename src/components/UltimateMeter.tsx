import { MAX_ULTIMATE_ORBS } from "../../shared/ultimates";

type UltimateMeterProps = {
  orbs: number;
  compact?: boolean;
  showReadyLabel?: boolean;
};

/** Mario Party–style ultimate orb meter (0–3). */
export default function UltimateMeter({
  orbs,
  compact = false,
  showReadyLabel = true,
}: UltimateMeterProps) {
  const filled = Math.max(0, Math.min(MAX_ULTIMATE_ORBS, orbs));
  const ready = filled >= MAX_ULTIMATE_ORBS;

  return (
    <div
      className={`ultimate-meter ${compact ? "ultimate-meter--compact" : ""} ${
        ready ? "ultimate-meter--ready" : ""
      }`}
      title={`Ultimate ${filled}/${MAX_ULTIMATE_ORBS}`}
    >
      <div className="ultimate-meter__orbs" aria-label={`Ultimate orbs ${filled} of ${MAX_ULTIMATE_ORBS}`}>
        {Array.from({ length: MAX_ULTIMATE_ORBS }, (_, i) => (
          <span
            key={i}
            className={`ultimate-meter__orb ${
              i < filled ? "ultimate-meter__orb--filled" : ""
            }`}
            aria-hidden
          />
        ))}
      </div>
      {showReadyLabel && ready && (
        <span className="ultimate-meter__ready">ULT READY</span>
      )}
    </div>
  );
}
