import { useEffect, useState } from "react";
import type { DirectorPickPayload, EventWeight } from "../../shared/director";
import {
  pointsIconPath,
  resolveAgentPortraitImage,
  resolveAgentStoryArt,
} from "../game/assetPaths";

type DirectorPresentationProps = {
  pick: DirectorPickPayload;
  introDurationMs: number;
  onComplete: () => void;
};

const weightStyles: Record<
  EventWeight,
  {
    label: string;
    ring: string;
    glow: string;
    badge: string;
    shake: boolean;
    glitch: boolean;
    alarm: boolean;
  }
> = {
  common: {
    label: "Field Event",
    ring: "border-cyan-400/30",
    glow: "from-cyan-500/15",
    badge: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
    shake: false,
    glitch: false,
    alarm: false,
  },
  rare: {
    label: "Rare Event",
    ring: "border-violet-400/40",
    glow: "from-violet-500/20",
    badge: "border-violet-400/40 bg-violet-400/10 text-violet-300",
    shake: false,
    glitch: false,
    alarm: false,
  },
  epic: {
    label: "Epic Event",
    ring: "border-amber-400/50",
    glow: "from-amber-500/25",
    badge: "border-amber-400/50 bg-amber-400/15 text-amber-200",
    shake: true,
    glitch: true,
    alarm: false,
  },
  legendary: {
    label: "Legendary Event",
    ring: "border-red-400/60",
    glow: "from-red-500/30",
    badge: "border-red-400/60 bg-red-500/20 text-red-200",
    shake: true,
    glitch: true,
    alarm: true,
  },
};

function WeightBadge({ weight }: { weight: EventWeight }) {
  const style = weightStyles[weight];
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${style.badge}`}
    >
      {style.label}
    </span>
  );
}

function AgentDirectorPanel({
  pick,
  style,
}: {
  pick: DirectorPickPayload;
  style: (typeof weightStyles)[EventWeight];
}) {
  const agentName = pick.agentName ?? "Agent";
  const art = resolveAgentStoryArt(agentName);
  const portrait = resolveAgentPortraitImage(agentName);

  return (
    <>
      <div className="relative mx-auto h-48 w-48 md:h-56 md:w-56">
        <div
          className={`absolute inset-0 rounded-full border-2 ${style.ring} director-portrait-ring`}
        />
        <div className="absolute inset-2 overflow-hidden rounded-full border border-white/15 bg-[#070b14] shadow-[0_0_48px_rgba(0,0,0,0.65)]">
          <img
            src={portrait}
            alt={agentName}
            className="h-full w-full object-cover object-top"
          />
          <div
            className={`absolute inset-0 bg-gradient-to-t ${style.glow} via-transparent to-transparent`}
          />
        </div>
        {art.variant === "npc" && (
          <img
            src={art.src}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-4 left-1/2 z-10 h-[140%] w-auto max-w-none -translate-x-1/2 object-contain object-bottom opacity-0 md:opacity-100"
          />
        )}
      </div>

      <div className="mt-6 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
          Agent Director
        </p>
        <h2 className="mt-2 text-3xl font-black uppercase tracking-wide text-white md:text-4xl">
          {agentName}
        </h2>
        {pick.agentRole && (
          <p className="mt-1 text-sm font-medium text-zinc-400">{pick.agentRole}</p>
        )}
      </div>
    </>
  );
}

function KingdomDirectorPanel({
  pick,
  style,
}: {
  pick: DirectorPickPayload;
  style: (typeof weightStyles)[EventWeight];
}) {
  return (
    <>
      <div className="relative mx-auto flex h-40 w-40 items-center justify-center md:h-48 md:w-48">
        <div
          className={`absolute inset-0 rounded-2xl border-2 ${style.ring} director-kingdom-frame`}
        />
        <div className="absolute inset-3 flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#070b14]/90">
          <img
            src={pointsIconPath("kingdom")}
            alt=""
            className="h-14 w-14 object-contain opacity-90"
          />
          {pick.protocolCode && (
            <p className="mt-2 font-mono text-xs tracking-widest text-cyan-300">
              {pick.protocolCode}
            </p>
          )}
        </div>
        {style.alarm && (
          <>
            <div className="director-alarm-bar director-alarm-bar--top" />
            <div className="director-alarm-bar director-alarm-bar--bottom" />
          </>
        )}
      </div>

      <div className="mt-6 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-red-400/90">
          Kingdom Protocol
        </p>
        <h2 className="mt-2 text-2xl font-black uppercase tracking-wide text-white md:text-3xl">
          {pick.protocolName}
        </h2>
        {pick.protocolSubtitle && (
          <p className="mt-2 max-w-md text-sm text-zinc-400">{pick.protocolSubtitle}</p>
        )}
      </div>
    </>
  );
}

export default function DirectorPresentation({
  pick,
  introDurationMs,
  onComplete,
}: DirectorPresentationProps) {
  const [revealed, setRevealed] = useState(false);
  const style = weightStyles[pick.weight];
  const isKingdom = pick.mode === "kingdom";

  useEffect(() => {
    setRevealed(false);
    const revealTimer = window.setTimeout(() => setRevealed(true), 120);
    const completeTimer = window.setTimeout(onComplete, introDurationMs);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(completeTimer);
    };
  }, [pick.agentName, pick.protocolId, pick.quote, introDurationMs, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 ${
        style.shake ? "director-shake" : ""
      } ${style.glitch ? "director-glitch" : ""}`}
    >
      {style.alarm && <div className="director-alarm-scanlines pointer-events-none" />}

      <div
        className={`relative w-full max-w-lg transition-all duration-700 ${
          revealed ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="mb-4 flex justify-center">
          <WeightBadge weight={pick.weight} />
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0b1020]/95 px-6 py-8 shadow-2xl backdrop-blur-sm md:px-10 md:py-10">
          {isKingdom ? (
            <KingdomDirectorPanel pick={pick} style={style} />
          ) : (
            <AgentDirectorPanel pick={pick} style={style} />
          )}

          <blockquote className="mt-8 border-l-2 border-cyan-400/40 pl-4 text-left">
            <p className="text-base italic leading-relaxed text-zinc-200 md:text-lg">
              &ldquo;{pick.quote}&rdquo;
            </p>
          </blockquote>

          <div className="mt-8 flex items-center justify-center gap-2">
            <span className="director-pulse-dot h-2 w-2 rounded-full bg-cyan-400" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              {isKingdom ? "Protocol activating" : "Event incoming"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
