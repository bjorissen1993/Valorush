import { useEffect, useState } from "react";
import type { GameEvent } from "../types/Game";
import {
  formatEventEffect,
  formatEventOutcomeLabel,
} from "../game/eventPool";
import { mapLoadingPath, pointsIconPath } from "../game/assetPaths";
import {
  getEventDisplayHeadline,
  getEventDisplayMood,
  getEventNarratorPosition,
  getEventSpeechBubble,
} from "../game/eventDialogue";
import { StoryArtPanel } from "./StoryArtPanel";
import ShopSpeechBubble from "./valorant/ShopSpeechBubble";
import EventOutcomeRoulette from "./EventOutcomeRoulette";

type EventStoryModalProps = {
  event: GameEvent;
  playerAgentName: string;
  onContinue: () => void;
};

type EventStep = "story" | "wheel" | "result";

const moodStyles = {
  positive: {
    chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    glow: "from-emerald-500/10",
    accent: "text-emerald-300",
    border: "border-emerald-400/20",
    bg: "bg-emerald-400/10",
  },
  negative: {
    chip: "border-red-400/30 bg-red-400/10 text-red-300",
    glow: "from-red-500/10",
    accent: "text-red-300",
    border: "border-red-400/20",
    bg: "bg-red-400/10",
  },
  neutral: {
    chip: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
    glow: "from-cyan-500/10",
    accent: "text-cyan-300",
    border: "border-cyan-400/20",
    bg: "bg-cyan-400/10",
  },
  mysterious: {
    chip: "border-purple-400/30 bg-purple-400/10 text-purple-300",
    glow: "from-purple-500/10",
    accent: "text-purple-300",
    border: "border-purple-400/20",
    bg: "bg-purple-400/10",
  },
};

function getEffectIcon(event: GameEvent) {
  const effect = event.outcome?.effect;
  if (!effect) return pointsIconPath("creds");

  switch (effect.type) {
    case "creds":
      return pointsIconPath("creds");
    case "radianite":
      return pointsIconPath("radianite");
    case "discount":
      return pointsIconPath("creds");
    default:
      return pointsIconPath("creds");
  }
}

function MapBriefingPanel({
  mapImage,
  roleLabel,
  title,
  glowClass,
}: {
  mapImage: string;
  roleLabel: string;
  title: string;
  glowClass: string;
}) {
  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-l-3xl border border-white/10 border-r-0 bg-[#070b14] md:min-h-0">
      <img
        src={mapImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div
        className={`absolute inset-0 bg-gradient-to-t ${glowClass} via-[#0b1020]/45 to-[#0b1020]/88`}
      />
      <div className="absolute left-5 top-5 rounded-full border border-cyan-400/35 bg-black/45 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">
        Online Briefing
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0b1020] via-[#0b1020]/95 to-transparent p-5 pt-16">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
          {roleLabel}
        </p>
        <p className="mt-1 text-xl font-bold text-white">{title}</p>
      </div>
    </div>
  );
}

export default function EventStoryModal({
  event,
  playerAgentName,
  onContinue,
}: EventStoryModalProps) {
  const [step, setStep] = useState<EventStep>("story");

  useEffect(() => {
    setStep("story");
  }, [event.id, event.outcome?.gambleResult]);

  const { story } = event;
  const moodKey = getEventDisplayMood(event);
  const mood = moodStyles[moodKey];
  const speech = getEventSpeechBubble(event);
  const headline = getEventDisplayHeadline(event);
  const mapBackground = story.backgroundImage ?? mapLoadingPath("Ascent");
  const isBriefing = story.presentation === "briefing";
  const narratorPosition = getEventNarratorPosition(story.narrator);

  const showSpeechBubble = step === "story" || step === "result";

  return (
    <div className="fixed inset-0 z-[75] flex animate-fadeIn items-center justify-center overflow-visible bg-black/65 p-4 pt-24 pl-8 md:pl-16">
      <div className="relative grid w-full max-w-6xl overflow-visible shadow-2xl md:grid-cols-[minmax(300px,360px)_1fr] md:grid-rows-[auto_min(760px,88vh)]">
        {showSpeechBubble && (
          <div className="relative z-40 mb-3 w-full min-w-0 shrink-0 md:col-start-2 md:row-start-1">
            <ShopSpeechBubble
              speaker={speech.speaker}
              text={speech.text}
              accent={speech.accent}
            />
          </div>
        )}

        <div className="relative z-20 hidden h-full min-h-0 overflow-visible md:col-start-1 md:row-start-2 md:block">
          {isBriefing ? (
            <MapBriefingPanel
              mapImage={mapBackground}
              roleLabel={story.narratorRole ?? "Protocol Comms"}
              title={story.narrator}
              glowClass={mood.glow}
            />
          ) : (
            <StoryArtPanel
              agentName={story.narrator}
              imageSrc={story.characterImage}
              roleLabel={story.narratorRole ?? "Agent"}
              backgroundImage={mapBackground}
              glowClass={mood.glow}
              popOut
              popOutShiftX={narratorPosition.shiftXPercent}
              popOutShiftXPx={narratorPosition.shiftXPx ?? 0}
              popOutShiftY={narratorPosition.shiftYPercent ?? 0}
            />
          )}
        </div>

        <div className="relative z-10 flex min-h-[min(760px,88vh)] min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] md:col-start-2 md:row-start-2 md:rounded-l-none md:border-l-0">
          <div className="flex min-h-0 flex-1 flex-col p-6 md:p-8">
            <div className="relative z-30 shrink-0">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {story.tag && (
                  <span
                    className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${mood.chip}`}
                  >
                    {story.tag}
                  </span>
                )}
                {step === "result" && event.outcome?.gambleResult && (
                  <span
                    className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                      event.outcome.gambleResult === "win"
                        ? moodStyles.positive.chip
                        : moodStyles.negative.chip
                    }`}
                  >
                    {event.outcome.gambleResult === "win" ? "Won" : "Lost"}
                  </span>
                )}
              </div>

              {step === "story" && (
                <div className="mt-8 md:mt-10">
                  <h2 className="text-3xl font-bold text-white md:text-4xl">
                    {event.title}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    <span className="font-semibold text-white">
                      {playerAgentName}
                    </span>{" "}
                    landed on an event tile.
                  </p>
                  <div className="mt-6 max-w-2xl space-y-3">
                    {story.paragraphs.map((paragraph, index) => (
                      <p
                        key={`${event.id}-paragraph-${index}`}
                        className="text-sm leading-relaxed text-zinc-300 md:text-base"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  {event.description && (
                    <p className="mt-4 max-w-2xl text-sm italic text-zinc-500">
                      {event.description}
                    </p>
                  )}
                </div>
              )}

              {step === "wheel" && (
                <div className="mt-8 text-center md:mt-10">
                  <h2 className="text-3xl font-bold text-white md:text-4xl">
                    {event.title}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    Fate is on the wheel.
                  </p>
                </div>
              )}

              {step === "result" && (
                <div className="mt-8 text-center md:mt-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
                    You received
                  </p>
                  <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
                    {headline}
                  </h2>
                  {event.outcome?.description && (
                    <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-zinc-300 md:text-base">
                      {event.outcome.description}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex min-h-0 flex-1 flex-col items-center justify-center">
              {step === "wheel" && (
                <EventOutcomeRoulette
                  event={event}
                  active
                  size="lg"
                  onComplete={() => setStep("result")}
                />
              )}

              {step === "result" && (
                <div
                  className={`flex w-full max-w-md flex-col items-center rounded-3xl border px-8 py-10 text-center ${mood.border} ${mood.bg}`}
                >
                  <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    {formatEventOutcomeLabel(event)}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <img
                      src={getEffectIcon(event)}
                      alt=""
                      className="h-10 w-10 object-contain"
                    />
                    <p className={`text-3xl font-black ${mood.accent}`}>
                      {formatEventEffect(event)}
                    </p>
                  </div>
                  <p className="mt-4 text-sm text-zinc-400">
                    Added to{" "}
                    <span className="font-semibold text-white">
                      {playerAgentName}
                    </span>
                    &apos;s account.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 shrink-0 border-t border-white/10 pt-4">
              {step === "story" && (
                <button
                  type="button"
                  onClick={() => setStep("wheel")}
                  className="w-full rounded-2xl bg-cyan-400 py-3 font-bold text-black transition hover:brightness-110 md:float-right md:w-auto md:px-8"
                >
                  Spin the wheel
                </button>
              )}

              {step === "result" && (
                <button
                  type="button"
                  onClick={onContinue}
                  className="w-full rounded-2xl bg-cyan-400 py-3 font-bold text-black transition hover:brightness-110 md:float-right md:w-auto md:px-8"
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
