import { useEffect, useMemo, useRef, useState } from "react";
import { pointsIconPath } from "../game/assetPaths";

export type ChamberLootSegment = {
  id: string;
  label: string;
  weight: number;
};

type WheelSegment = {
  id: string;
  label: string;
  amount: string;
  tone: "win" | "lose" | "empty";
  icon: "creds" | "radianite";
};

type Props = {
  open: boolean;
  targetName: string;
  /** Predetermined winning segment id (already applied in applyUltimate). */
  winningSegmentId: string;
  winningLabel: string;
  /** Segments with weights used for the spin presentation. */
  segments: ChamberLootSegment[];
  credsStolen: number;
  radianiteStolen: number;
  onComplete: () => void;
};

const SPIN_DURATION_MS = 4200;
const FULL_SPINS = 6;

function toneColors(tone: WheelSegment["tone"]) {
  if (tone === "win") return { fill: "#0f3d2e", stroke: "#34d399" };
  if (tone === "lose") return { fill: "#3d1515", stroke: "#f87171" };
  return { fill: "#2a2a33", stroke: "#a1a1aa" };
}

function segmentVisual(seg: ChamberLootSegment): WheelSegment {
  if (seg.id.startsWith("rad")) {
    return {
      id: seg.id,
      label: seg.label,
      amount: seg.id === "rad-all" ? "ALL" : "1",
      tone: "win",
      icon: "radianite",
    };
  }
  if (seg.id === "fallback") {
    return {
      id: seg.id,
      label: seg.label,
      amount: "+3k",
      tone: "win",
      icon: "creds",
    };
  }
  if (seg.id === "creds-large") {
    return {
      id: seg.id,
      label: seg.label,
      amount: "1500",
      tone: "win",
      icon: "creds",
    };
  }
  return {
    id: seg.id,
    label: seg.label,
    amount: "500",
    tone: "win",
    icon: "creds",
  };
}

function expandWeightedSegments(
  segments: ChamberLootSegment[],
  winningId: string
): { wheel: WheelSegment[]; targetIndex: number } {
  const usable = segments.filter((s) => s.weight > 0);
  if (usable.length === 0) {
    return {
      wheel: [
        {
          id: "fallback",
          label: "Fallback",
          amount: "+3k",
          tone: "win",
          icon: "creds",
        },
      ],
      targetIndex: 0,
    };
  }

  // Expand by weight (capped) so larger holdings get bigger slices.
  const slices: ChamberLootSegment[] = [];
  for (const seg of usable) {
    const copies = Math.min(6, Math.max(1, Math.round(seg.weight)));
    for (let i = 0; i < copies; i += 1) slices.push(seg);
  }

  // Ensure at least 6 visual slices for a nice wheel.
  while (slices.length < 6) {
    slices.push(...usable);
  }

  const wheel = slices.slice(0, 12).map(segmentVisual);
  let targetIndex = wheel.findIndex((s) => s.id === winningId);
  if (targetIndex < 0) {
    wheel[wheel.length - 1] = segmentVisual(
      usable.find((s) => s.id === winningId) ?? usable[usable.length - 1]!
    );
    targetIndex = wheel.length - 1;
  }
  return { wheel, targetIndex };
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

/**
 * Tour de Force loot wheel — spins to a predetermined segment
 * (loot already applied by applyUltimate; this is presentation).
 */
export default function ChamberLootWheel({
  open,
  targetName,
  winningSegmentId,
  winningLabel,
  segments,
  credsStolen,
  radianiteStolen,
  onComplete,
}: Props) {
  const { wheel, targetIndex } = useMemo(
    () => expandWeightedSegments(segments, winningSegmentId),
    [segments, winningSegmentId]
  );

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const segmentAngle = 360 / Math.max(1, wheel.length);
  const targetRotation = getTargetRotation(targetIndex, wheel.length);

  useEffect(() => {
    if (!open) return;
    completedRef.current = false;
    setRotation(0);
    setSpinning(false);
    setRevealed(false);

    let doneTimer: number | undefined;
    const startTimer = window.setTimeout(() => {
      setSpinning(true);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setRotation(targetRotation);
        });
      });

      doneTimer = window.setTimeout(() => {
        setSpinning(false);
        setRevealed(true);
      }, SPIN_DURATION_MS + 150);
    }, 350);

    return () => {
      window.clearTimeout(startTimer);
      if (doneTimer != null) window.clearTimeout(doneTimer);
    };
  }, [open, winningSegmentId, targetRotation]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[88] flex animate-fadeIn items-center justify-center bg-black/70 p-4">
      <div className="ultimate-modal max-w-lg">
        <div className="ultimate-modal__header">
          <img
            src="/abilities/chamber/Tour_De_Force.png"
            alt=""
            className="ultimate-modal__icon"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
              Tour de Force
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">Loot Wheel</h2>
          </div>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          Slow Zone planted. Stealing from{" "}
          <span className="font-semibold text-white">{targetName}</span>…
        </p>

        <div className="mt-5 flex w-full flex-col items-center">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
            {spinning
              ? "Spinning the wheel"
              : revealed
                ? "Loot claimed"
                : "Wheel of fortune"}
          </p>

          <div className="event-wheel-frame event-wheel-frame--lg relative mx-auto">
            <div className="event-wheel-pointer" />
            <div
              className={`event-wheel-spinner ${
                spinning ? "event-wheel-spinner--spinning" : ""
              }`}
              style={{
                transform: `rotate(${rotation}deg)`,
                ["--event-wheel-duration" as string]: `${SPIN_DURATION_MS}ms`,
              }}
            >
              <svg viewBox="0 0 100 100" className="h-full w-full">
                {wheel.map((segment, index) => {
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
                          style={{ fontSize: "7px" }}
                        >
                          {segment.amount}
                        </text>
                        <image
                          href={iconPath}
                          x={contentPos.x - 3}
                          y={contentPos.y + 0.5}
                          width={6}
                          height={6}
                        />
                      </g>
                    </g>
                  );
                })}
                <circle
                  cx="50"
                  cy="50"
                  r="8"
                  fill="#0b1020"
                  stroke="#fbbf24"
                  strokeWidth="1"
                />
              </svg>
            </div>
          </div>

          {revealed && (
            <div className="mt-5 w-full rounded-xl border border-amber-400/30 bg-amber-950/40 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-amber-100">
                {winningLabel}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {credsStolen > 0 && `+${credsStolen} creds`}
                {credsStolen > 0 && radianiteStolen > 0 && " · "}
                {radianiteStolen > 0 && `+${radianiteStolen} radianite`}
                {credsStolen === 0 && radianiteStolen === 0 && "No loot taken"}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          className="ultimate-modal__btn ultimate-modal__btn--primary mt-6 w-full"
          disabled={!revealed}
          onClick={() => {
            if (completedRef.current) return;
            completedRef.current = true;
            onCompleteRef.current();
          }}
        >
          {revealed ? "Continue" : "Spinning…"}
        </button>
      </div>
    </div>
  );
}

/** Build weighted segments matching applyUltimate Tour de Force logic. */
export function buildChamberLootSegments(target: {
  creds: number;
  radianitePoints: number;
}): ChamberLootSegment[] {
  const radAvailable = Math.max(0, target.radianitePoints);
  return [
    {
      id: "creds-small",
      label: "Steal 500 creds",
      weight: Math.max(1, Math.floor(target.creds / 500)),
    },
    {
      id: "creds-large",
      label: "Steal 1500 creds",
      weight: Math.max(1, Math.floor(target.creds / 1500)),
    },
    {
      id: "rad-1",
      label: "Steal 1 radianite",
      weight: radAvailable > 0 ? radAvailable * 3 : 0,
    },
    {
      id: "rad-all",
      label: "Steal all radianite",
      weight: radAvailable > 0 ? radAvailable : 0,
    },
    {
      id: "fallback",
      label: "Fallback +3000 creds",
      weight: radAvailable === 0 ? 4 : 1,
    },
  ].filter((s) => s.weight > 0);
}
