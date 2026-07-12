import { useEffect, useRef, useState } from "react";
import { isEffectivePerformanceMode } from "../hooks/usePerformanceSettings";

const PENTAGON_RADIUS = 38;

export const DICE_BLINK_ON_MS = 200;
export const DICE_BLINK_OFF_MS = 160;
export const DICE_BLINK_COUNT = 3;
export const DICE_REVEAL_BLINK_MS =
  DICE_BLINK_COUNT * (DICE_BLINK_ON_MS + DICE_BLINK_OFF_MS) + 220;

const MIN_FLICKER_MS = 45;
const MAX_FLICKER_MS = 340;

/** Six fixed dots: center + pentagon ring. Lit count equals the rolled value. */
const DOT_POSITIONS: { x: number; y: number }[] = [
  { x: 50, y: 50 },
  ...Array.from({ length: 5 }, (_, index) => {
    const angleRad = ((-90 + index * 72) * Math.PI) / 180;
    return {
      x: 50 + PENTAGON_RADIUS * Math.cos(angleRad),
      y: 50 + PENTAGON_RADIUS * Math.sin(angleRad),
    };
  }),
];

type DotIntensity = 0 | 1 | 2;

function clampRoll(value: number) {
  return Math.max(1, Math.min(6, value));
}

function getFinalDotStates(value: number): DotIntensity[] {
  const litCount = clampRoll(value);
  return Array.from({ length: 6 }, (_, index) =>
    index < litCount ? 2 : 0
  ) as DotIntensity[];
}

function getRandomDotStates(): DotIntensity[] {
  return Array.from({ length: 6 }, () => {
    const roll = Math.random();
    if (roll < 0.42) return 0;
    if (roll < 0.72) return 1;
    return 2;
  }) as DotIntensity[];
}

function getFlickerDelay(elapsedMs: number, totalMs: number) {
  const progress = Math.min(1, elapsedMs / totalMs);
  const eased = 1 - Math.pow(1 - progress, 2.8);
  return MIN_FLICKER_MS + (MAX_FLICKER_MS - MIN_FLICKER_MS) * eased;
}

function intensityClass(intensity: DotIntensity) {
  if (intensity === 2) return "dice-roll-dot--bright";
  if (intensity === 1) return "dice-roll-dot--dim";
  return "dice-roll-dot--off";
}

type DiceFaceProps = {
  value: number;
  rolling?: boolean;
  revealing?: boolean;
  idle?: boolean;
  size?: "sm" | "md";
  showValue?: boolean;
  valuePosition?: "above" | "below";
  rollDurationMs?: number;
};

export default function DiceFace({
  value,
  rolling = false,
  revealing = false,
  idle = false,
  size = "md",
  showValue = false,
  valuePosition = "below",
  rollDurationMs = 1400,
}: DiceFaceProps) {
  const [dotStates, setDotStates] = useState<DotIntensity[]>(() =>
    idle ? Array(6).fill(0) : getFinalDotStates(value)
  );
  const [blinkComplete, setBlinkComplete] = useState(false);
  const blinkTimersRef = useRef<number[]>([]);

  const clearBlinkTimers = () => {
    blinkTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    blinkTimersRef.current = [];
  };

  useEffect(() => {
    if (idle) {
      clearBlinkTimers();
      setDotStates(Array(6).fill(0));
      setBlinkComplete(false);
      return;
    }

    if (rolling) {
      clearBlinkTimers();
      setBlinkComplete(false);
      return;
    }

    if (!revealing) {
      clearBlinkTimers();
      setDotStates(getFinalDotStates(value));
      setBlinkComplete(true);
    }
  }, [idle, rolling, revealing, value]);

  useEffect(() => {
    if (!rolling || idle) return;

    const start = performance.now();
    let timeoutId: number | undefined;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      if (document.hidden) {
        timeoutId = window.setTimeout(tick, 250);
        return;
      }

      setDotStates(getRandomDotStates());

      const elapsed = performance.now() - start;
      if (elapsed >= rollDurationMs) return;

      const baseDelay = getFlickerDelay(elapsed, rollDurationMs);
      const delay = isEffectivePerformanceMode() ? baseDelay * 2.2 : baseDelay;
      timeoutId = window.setTimeout(tick, delay);
    };

    tick();

    return () => {
      cancelled = true;
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [rolling, rollDurationMs, idle]);

  useEffect(() => {
    if (!revealing || idle || rolling) return;

    clearBlinkTimers();
    setBlinkComplete(false);

    const finalStates = getFinalDotStates(value);
    const allOff = Array(6).fill(0) as DotIntensity[];
    let step = 0;
    const totalSteps = DICE_BLINK_COUNT * 2;

    const queueStep = (delayMs: number, next: () => void) => {
      const timer = window.setTimeout(next, delayMs);
      blinkTimersRef.current.push(timer);
    };

    const runStep = () => {
      const lightsOn = step % 2 === 0;
      setDotStates(lightsOn ? finalStates : allOff);
      step += 1;

      if (step < totalSteps) {
        queueStep(lightsOn ? DICE_BLINK_ON_MS : DICE_BLINK_OFF_MS, runStep);
        return;
      }

      queueStep(DICE_BLINK_ON_MS, () => {
        setDotStates(finalStates);
        queueStep(220, () => setBlinkComplete(true));
      });
    };

    runStep();

    return clearBlinkTimers;
  }, [revealing, idle, rolling, value]);

  const faceClass = [
    size === "sm" ? "dice-roll-face dice-roll-face--sm" : "dice-roll-face",
    valuePosition === "above" ? "dice-roll-face--value-above" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const canShowNumber =
    showValue && !rolling && !idle && (!revealing || blinkComplete);

  return (
    <div className={faceClass}>
      <div className="dice-roll-dots">
        {DOT_POSITIONS.map((position, slotIndex) => (
          <div
            key={slotIndex}
            className={`dice-roll-dot ${intensityClass(dotStates[slotIndex] ?? 0)}`}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
            }}
          />
        ))}
      </div>

      {canShowNumber && (
        <p className="dice-roll-value">{clampRoll(value)}</p>
      )}
    </div>
  );
}
