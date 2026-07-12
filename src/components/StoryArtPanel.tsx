import type { StoryDialogueLine } from "../types/Game";
import { resolveAgentStoryArt } from "../game/assetPaths";

type StoryArtPanelProps = {
  agentName: string;
  imageSrc?: string;
  roleLabel?: string;
  backgroundImage?: string;
  glowClass?: string;
  /** Shopkeeper mode — character may extend left & above the panel bounds. */
  popOut?: boolean;
  /** Horizontal pop-out shift as % of image width (negative = left). */
  popOutShiftX?: number;
  /** Extra horizontal nudge in pixels (positive = right). */
  popOutShiftXPx?: number;
  popOutShiftY?: number;
};

export function StoryArtPanel({
  agentName,
  imageSrc,
  roleLabel,
  backgroundImage,
  glowClass = "from-cyan-500/10",
  popOut = false,
  popOutShiftX = -68,
  popOutShiftXPx = 0,
  popOutShiftY = 0,
}: StoryArtPanelProps) {
  const art = resolveAgentStoryArt(agentName);
  const src = imageSrc ?? art.src;
  const isNpc = art.variant === "npc" || src.includes("/npc/");

  return (
    <div
      className={`relative h-full min-h-[320px] md:min-h-0 ${popOut ? "z-20 overflow-visible bg-transparent" : "overflow-hidden bg-[#070b14]"}`}
    >
      <div
        className={`absolute inset-0 z-0 overflow-hidden bg-[#070b14] ${popOut ? "rounded-l-3xl border border-white/10 border-r-0" : ""}`}
      >
        {backgroundImage && (
          <img
            src={backgroundImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center opacity-20"
          />
        )}
        <div
          className={`absolute inset-0 bg-gradient-to-t ${glowClass} via-[#0b1020]/40 to-[#0b1020]/90`}
        />
      </div>

      {isNpc ? (
        <img
          src={src}
          alt={agentName}
          className={
            popOut
              ? "pointer-events-none absolute bottom-0 left-1/2 z-[2] h-[min(128%,940px)] w-auto max-w-none origin-bottom object-contain object-bottom drop-shadow-[0_24px_56px_rgba(0,0,0,0.65)]"
              : "pointer-events-none absolute bottom-0 left-1/2 z-[1] h-[min(122%,900px)] w-auto max-w-none origin-bottom -translate-x-1/2 object-contain object-bottom drop-shadow-[0_20px_48px_rgba(0,0,0,0.55)]"
          }
          style={
            popOut
              ? {
                  transform: `translateX(calc(${popOutShiftX}% + ${popOutShiftXPx}px)) translateY(${popOutShiftY}%)`,
                }
              : undefined
          }
        />
      ) : (
        <div className="absolute inset-0 z-[1] flex items-end justify-center pb-16">
          <div className="relative h-56 w-56 overflow-hidden rounded-3xl border-2 border-white/20 bg-black/30 shadow-2xl md:h-64 md:w-64">
            <img
              src={src}
              alt={agentName}
              className="h-full w-full object-cover object-top"
            />
          </div>
        </div>
      )}

      {!popOut && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-[#0b1020] via-[#0b1020]/95 to-transparent p-5 pt-16">
          {roleLabel && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
              {roleLabel}
            </p>
          )}
          <p className="mt-1 text-xl font-bold text-white">{agentName}</p>
        </div>
      )}
    </div>
  );
}

type StoryDialogueLinesProps = {
  lines: StoryDialogueLine[];
  /** Stronger background for overlays (e.g. shop speech above the board). */
  emphasis?: boolean;
};

export function StoryDialogueLines({ lines, emphasis = false }: StoryDialogueLinesProps) {
  if (lines.length === 0) return null;

  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <div
          key={index}
          className={
            emphasis
              ? "rounded-2xl border border-cyan-400/35 bg-[#0b1020]/98 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
              : "rounded-2xl border border-cyan-400/15 bg-cyan-400/5 px-4 py-3"
          }
        >
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
            {line.speaker}
          </p>
          <p className="mt-1 text-base italic leading-relaxed text-white">
            &ldquo;{line.text}&rdquo;
          </p>
        </div>
      ))}
    </div>
  );
}
