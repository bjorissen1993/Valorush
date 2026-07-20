import HoverTooltip from "./HoverTooltip";
import { getUltimateForAgent, MAX_ULTIMATE_ORBS } from "../../shared/ultimates";

/** Faster than default HoverTooltip — ult info is high-value mid-match. */
export const ULTIMATE_TOOLTIP_DELAY_MS = 400;

type UltimateMeterProps = {
  orbs: number;
  compact?: boolean;
  showReadyLabel?: boolean;
  /** When set, hover shows ultimate name + board effect from the registry. */
  agentName?: string;
};

/** Mario Party–style ultimate orb meter (0–3). */
export default function UltimateMeter({
  orbs,
  compact = false,
  showReadyLabel = true,
  agentName,
}: UltimateMeterProps) {
  const filled = Math.max(0, Math.min(MAX_ULTIMATE_ORBS, orbs));
  const ready = filled >= MAX_ULTIMATE_ORBS;
  const def = agentName ? getUltimateForAgent(agentName) : undefined;

  const meter = (
    <div
      className={`ultimate-meter ${compact ? "ultimate-meter--compact" : ""} ${
        ready ? "ultimate-meter--ready" : ""
      }`}
      title={
        def
          ? undefined
          : `Ultimate ${filled}/${MAX_ULTIMATE_ORBS}`
      }
    >
      {def?.icon && ready && (
        <img
          src={def.icon}
          alt=""
          className="ultimate-meter__ready-icon"
        />
      )}
      <div
        className="ultimate-meter__orbs"
        aria-label={`Ultimate orbs ${filled} of ${MAX_ULTIMATE_ORBS}`}
      >
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

  if (!def) {
    return meter;
  }

  return (
    <HoverTooltip
      delayMs={ULTIMATE_TOOLTIP_DELAY_MS}
      className="ultimate-meter-tooltip"
      content={
        <span className="ultimate-meter__tooltip">
          {def.icon ? (
            <img
              src={def.icon}
              alt=""
              className="ultimate-meter__tooltip-icon"
            />
          ) : null}
          <strong className="ultimate-meter__tooltip-name">{def.name}</strong>
          <span className="ultimate-meter__tooltip-desc">{def.description}</span>
          <span className="ultimate-meter__tooltip-orbs">
            Orbs {filled}/{MAX_ULTIMATE_ORBS}
            {ready ? " — ready" : ""}
          </span>
        </span>
      }
    >
      {meter}
    </HoverTooltip>
  );
}
