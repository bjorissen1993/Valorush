import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { agentPortraitPath } from "../game/assetPaths";

type Props = {
  open: boolean;
  playerName: string;
  playerAvatar?: string;
  agentName?: string;
  agentImage?: string | null;
  agentBackgroundImage?: string | null;
  onDone?: () => void;
};

const BANNER_DURATION_MS = 2400;
const BAND_TILE_COUNT = 4;
const BAND_STACK_COUNT = 2;

function turnBannerNameCharCount(name: string, fallback = 1) {
  return Math.max(name.trim().length, fallback);
}

async function preloadImage(src: string) {
  const img = new Image();
  img.src = src;

  await Promise.race([
    (async () => {
      if (img.decode) {
        await img.decode();
        return;
      }
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    })(),
    new Promise<void>((resolve) => window.setTimeout(resolve, 500)),
  ]);
}

type BandId = "main" | "edge-left" | "edge-right";

function BackgroundTextBand({
  src,
  band,
  active,
}: {
  src: string;
  band: BandId;
  active: boolean;
}) {
  const tiles = Array.from({ length: BAND_TILE_COUNT }, (_, index) => index);
  const stacks = Array.from({ length: BAND_STACK_COUNT }, (_, index) => index);

  return (
    <div
      className={["turn-banner-band", `turn-banner-band--${band}`].join(" ")}
      aria-hidden
    >
      <div
        className={[
          "turn-banner-band-track",
          active ? `turn-banner-band-track--active-${band}` : "",
        ].join(" ")}
      >
        {stacks.map((stackIndex) => (
          <div key={stackIndex} className="turn-banner-band-stack">
            {tiles.map((tileIndex) => (
              <img
                key={tileIndex}
                src={src}
                alt=""
                className="turn-banner-band-img"
                draggable={false}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TurnBanner({
  open,
  playerName,
  playerAvatar,
  agentName,
  agentImage,
  agentBackgroundImage,
  onDone,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const displayAgentImage =
    agentImage ??
    (agentName && agentName !== "No agent"
      ? agentPortraitPath(agentName)
      : null);

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      return;
    }

    let cancelled = false;

    async function startBanner() {
      const preloadTargets = [displayAgentImage, agentBackgroundImage].filter(
        (src): src is string => Boolean(src)
      );

      await Promise.all(preloadTargets.map((src) => preloadImage(src)));

      if (cancelled) return;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setIsPlaying(true);
        });
      });
    }

    void startBanner();

    const doneTimer = window.setTimeout(() => {
      setIsPlaying(false);
      onDoneRef.current?.();
    }, BANNER_DURATION_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(doneTimer);
    };
  }, [open, displayAgentImage, agentBackgroundImage, playerName]);

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <div
        className={[
          "turn-banner-backdrop absolute inset-0 bg-[#070b14]",
          isPlaying ? "turn-banner-backdrop--active" : "",
        ].join(" ")}
      />

      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,70,85,0.10),_transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(15,25,35,0.85),_transparent_60%)]"
        aria-hidden
      />

      {agentBackgroundImage && (
        <>
          <BackgroundTextBand
            src={agentBackgroundImage}
            band="edge-left"
            active={isPlaying}
          />
          <BackgroundTextBand
            src={agentBackgroundImage}
            band="edge-right"
            active={isPlaying}
          />
        </>
      )}

      <div
        className={[
          "turn-banner-content absolute inset-0",
          isPlaying ? "turn-banner-content--active" : "",
        ].join(" ")}
      >
        {(displayAgentImage || agentBackgroundImage) && isPlaying && (
          <div className="turn-banner-agent-zone absolute bottom-0 right-0 z-[2] flex max-w-[70vw] items-end justify-end">
            {agentBackgroundImage && (
              <BackgroundTextBand
                src={agentBackgroundImage}
                band="main"
                active={isPlaying}
              />
            )}
            {displayAgentImage && (
              <div
                className={[
                  "turn-banner-agent relative z-[1] flex items-end justify-end",
                  isPlaying ? "turn-banner-agent--active" : "",
                ].join(" ")}
              >
                <img
                  src={displayAgentImage}
                  alt={agentName ?? "Agent"}
                  className="pointer-events-none h-[min(100vh,1300px)] w-auto max-w-[70vw] origin-bottom object-contain object-bottom brightness-110 contrast-110 drop-shadow-[0_32px_64px_rgba(0,0,0,0.65)]"
                  draggable={false}
                />
              </div>
            )}
          </div>
        )}

        <div
          className={[
            "turn-banner-info absolute left-[clamp(6rem,12vw,10rem)] right-1/2 top-1/2 z-[4] flex w-full -translate-y-1/2 items-center gap-4 sm:gap-6",
            isPlaying ? "turn-banner-info--active" : "",
          ].join(" ")}
        >
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-white/25 shadow-[0_0_32px_rgba(255,255,255,0.12)] sm:h-28 sm:w-28">
            {playerAvatar ? (
              <img
                src={playerAvatar}
                alt={playerName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#091225] text-3xl font-bold text-white sm:text-4xl">
                {(playerName.trim().charAt(0) || "?").toUpperCase()}
              </div>
            )}
          </div>

          <div className="turn-banner-info-text min-w-0 flex-1 text-left">
            <p
              className="turn-banner-player-name font-black uppercase tracking-[0.02em] text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.55)]"
              style={
                {
                  "--turn-banner-player-chars": turnBannerNameCharCount(
                    playerName
                  ),
                } as CSSProperties
              }
            >
              {playerName}
            </p>
            <p
              className="turn-banner-agent-name mt-1 font-bold uppercase tracking-[0.12em] text-cyan-200/90 sm:mt-2"
              style={
                {
                  "--turn-banner-agent-chars": turnBannerNameCharCount(
                    agentName ?? "No agent",
                    8
                  ),
                } as CSSProperties
              }
            >
              {agentName ?? "No agent"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(TurnBanner);
