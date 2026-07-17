import { useEffect, useMemo, useRef, useState } from "react";
import type { FlatEventEffect, GameEvent } from "../types/Game";
import { pointsIconPath } from "../game/assetPaths";

type WheelSegment = {
  id: string;
  amount: string;
  tone: "win" | "lose";
  icon: "creds" | "radianite";
};

type Props = {
  event: GameEvent;
  active: boolean;
  size?: "md" | "lg";
  onComplete: () => void;
};

const WHEEL_SEGMENT_COUNT = 8;
const SPIN_DURATION_MS = 3800;
const FULL_SPINS = 5;

const DECOY_SEGMENTS: WheelSegment[] = [
  { id: "d1", amount: "+200", tone: "win", icon: "creds" },
  { id: "d2", amount: "-200", tone: "lose", icon: "creds" },
  { id: "d3", amount: "+50", tone: "win", icon: "creds" },
  { id: "d4", amount: "-50", tone: "lose", icon: "creds" },
  { id: "d5", amount: "+25", tone: "win", icon: "creds" },
  { id: "d6", amount: "-25", tone: "lose", icon: "creds" },
  { id: "d7", amount: "+100", tone: "win", icon: "creds" },
];

function segmentFromEffect(effect: FlatEventEffect, id: string): WheelSegment {
  switch (effect.type) {
    case "creds":
      return {
        id,
        amount: effect.amount >= 0 ? `+${effect.amount}` : `${effect.amount}`,
        tone: effect.amount >= 0 ? "win" : "lose",
        icon: "creds",
      };
    case "radianite":
      return {
        id,
        amount: effect.amount >= 0 ? `+${effect.amount}` : `${effect.amount}`,
        tone: effect.amount >= 0 ? "win" : "lose",
        icon: "radianite",
      };
    case "discount":
      return {
        id,
        amount: `+${effect.amount}`,
        tone: "win",
        icon: "creds",
      };
    default:
      return { id, amount: "+0", tone: "win", icon: "creds" };
  }
}

function toneColors(tone: WheelSegment["tone"]) {
  return tone === "win"
    ? { fill: "#065f46", stroke: "#34d399" }
    : { fill: "#7f1d1d", stroke: "#f87171" };
}

function buildGambleWheel(event: GameEvent): {
  segments: WheelSegment[];
  targetIndex: number;
} {
  if (event.effect.type !== "gamble") {
    return { segments: [], targetIndex: 0 };
  }

  const { win, lose } = event.effect;
  const targetId = event.outcome?.gambleResult === "win" ? "win" : "lose";

  const pool: WheelSegment[] = [
    segmentFromEffect(win.effect, "win"),
    segmentFromEffect(lose.effect, "lose"),
    ...DECOY_SEGMENTS,
  ];

  const targetSegment = pool.find((segment) => segment.id === targetId) ?? pool[0];
  const decoys = pool.filter((segment) => segment.id !== targetId);
  const segments: WheelSegment[] = [];

  for (let index = 0; index < WHEEL_SEGMENT_COUNT; index += 1) {
    if (index === WHEEL_SEGMENT_COUNT - 1) {
      segments.push(targetSegment);
    } else {
      segments.push(decoys[index % decoys.length]);
    }
  }

  return { segments, targetIndex: WHEEL_SEGMENT_COUNT - 1 };
}

function buildFixedWheel(event: GameEvent): {
  segments: WheelSegment[];
  targetIndex: number;
} {
  const result = event.outcome
    ? segmentFromEffect(event.outcome.effect, "result")
    : { id: "result", amount: "+0", tone: "win" as const, icon: "creds" as const };

  const pool: WheelSegment[] = [result, ...DECOY_SEGMENTS];
  const segments: WheelSegment[] = [];

  for (let index = 0; index < WHEEL_SEGMENT_COUNT; index += 1) {
    if (index === WHEEL_SEGMENT_COUNT - 1) {
      segments.push(result);
    } else {
      segments.push(pool[index % pool.length]);
    }
  }

  return { segments, targetIndex: WHEEL_SEGMENT_COUNT - 1 };
}

function getTargetRotation(targetIndex: number, segmentCount: number) {
  const segmentAngle = 360 / segmentCount;
  const segmentCenter = targetIndex * segmentAngle + segmentAngle / 2;
  return FULL_SPINS * 360 + (360 - segmentCenter);
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export default function EventOutcomeRoulette({
  event,
  active,
  size = "lg",
  onComplete,
}: Props) {
  const { segments, targetIndex } = useMemo(
    () =>
      event.effect.type === "gamble"
        ? buildGambleWheel(event)
        : buildFixedWheel(event),
    [event]
  );

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const segmentAngle = 360 / segments.length;
  const targetRotation = getTargetRotation(targetIndex, segments.length);
  const amountFontSize = size === "lg" ? 8 : 6;
  const iconSize = size === "lg" ? 7 : 5.5;

  useEffect(() => {
    if (!active) return;
    if (segments.length === 0) {
      onCompleteRef.current();
      return;
    }

    completedRef.current = false;
    setRotation(0);
    setSpinning(false);

    let doneTimer: number | undefined;

    const startTimer = window.setTimeout(() => {
      setSpinning(true);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setRotation(targetRotation);
        });
      });

      doneTimer = window.setTimeout(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        setSpinning(false);
        onCompleteRef.current();
      }, SPIN_DURATION_MS + 200);
    }, 300);

    return () => {
      window.clearTimeout(startTimer);
      if (doneTimer != null) window.clearTimeout(doneTimer);
    };
  }, [active, event.id, event.outcome?.gambleResult, segments.length, targetRotation]);

  if (!active) return null;

  return (
    <div className="flex w-full flex-col items-center">
      <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
        {spinning ? "Spinning the wheel" : "Wheel of fortune"}
      </p>

      <div
        className={`event-wheel-frame relative mx-auto ${
          size === "lg" ? "event-wheel-frame--lg" : "event-wheel-frame--md"
        }`}
      >
        <div className="event-wheel-pointer" />

        <div
          className={`event-wheel-spinner ${spinning ? "event-wheel-spinner--spinning" : ""}`}
          style={{
            transform: `rotate(${rotation}deg)`,
            ["--event-wheel-duration" as string]: `${SPIN_DURATION_MS}ms`,
          }}
        >
          <svg viewBox="0 0 100 100" className="h-full w-full">
            {segments.map((segment, index) => {
              const startAngle = index * segmentAngle;
              const endAngle = startAngle + segmentAngle;
              const colors = toneColors(segment.tone);
              const midAngle = startAngle + segmentAngle / 2;
              const contentPos = polarToCartesian(50, 50, 30, midAngle);
              const iconPath = pointsIconPath(segment.icon);

              return (
                <g key={`${segment.id}-${index}`}>
                  <path
                    d={describeArc(50, 50, 48, startAngle, endAngle)}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth="0.6"
                  />
                  <g
                    transform={`rotate(${midAngle} ${contentPos.x} ${contentPos.y})`}
                  >
                    <text
                      x={contentPos.x}
                      y={contentPos.y - 2.5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-white font-black"
                      style={{ fontSize: `${amountFontSize}px` }}
                    >
                      {segment.amount}
                    </text>
                    <image
                      href={iconPath}
                      x={contentPos.x - iconSize / 2}
                      y={contentPos.y + 0.5}
                      width={iconSize}
                      height={iconSize}
                    />
                  </g>
                </g>
              );
            })}
            <circle cx="50" cy="50" r="8" fill="#0b1020" stroke="#67e8f9" strokeWidth="1" />
          </svg>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500">
        The wheel decides your fate…
      </p>
    </div>
  );
}
