import type { GameEvent } from "../types/Game";
import {
  SHOPKEEPER_POSITION,
  type ShopSpeechAccent,
  type ShopkeeperPosition,
} from "./shopDialogue";

const DEFAULT_NARRATOR_POSITION: ShopkeeperPosition = {
  shiftXPercent: -68,
  shiftXPx: 0,
  shiftYPercent: 0,
};

/** Per-narrator NPC layout — tuned like shopkeepers where models differ in pose/width. */
export const EVENT_NARRATOR_POSITION: Record<string, ShopkeeperPosition> = {
  ...SHOPKEEPER_POSITION,
  Jett: { shiftXPercent: -54, shiftXPx: 40 },
  Sova: { shiftXPercent: -62, shiftXPx: 30 },
  Sage: { shiftXPercent: -58, shiftXPx: 20 },
  "KAY/O": { shiftXPercent: -50, shiftXPx: 0 },
  Fade: { shiftXPercent: -64, shiftXPx: 50 },
  Astra: { shiftXPercent: -56, shiftXPx: 10 },
  Skye: { shiftXPercent: -52, shiftXPx: 35 },
  Breach: { shiftXPercent: -66, shiftXPx: 80 },
  Reyna: { shiftXPercent: -54, shiftXPx: 35 },
  Omen: { shiftXPercent: -60, shiftXPx: 15 },
  Phoenix: { shiftXPercent: -55, shiftXPx: 25 },
  Neon: { shiftXPercent: -52, shiftXPx: 30 },
  Yoru: { shiftXPercent: -58, shiftXPx: 20 },
};

const MOOD_ACCENT: Record<
  GameEvent["story"]["mood"],
  ShopSpeechAccent
> = {
  positive: "emerald",
  negative: "crimson",
  neutral: "cyan",
  mysterious: "violet",
};

export function getEventNarratorPosition(
  narratorName: string
): ShopkeeperPosition {
  return EVENT_NARRATOR_POSITION[narratorName] ?? DEFAULT_NARRATOR_POSITION;
}

export function getEventSpeechBubble(event: GameEvent): {
  speaker: string;
  text: string;
  accent: ShopSpeechAccent;
} {
  const mood = event.outcome?.mood ?? event.story.mood;
  const dialogue = event.story.dialogues?.[0];
  const quoteFromParagraph = event.story.paragraphs
    .map((paragraph) => paragraph.match(/"([^"]+)"/)?.[1])
    .find(Boolean);

  return {
    speaker: dialogue?.speaker ?? event.story.narrator,
    text:
      event.outcome?.dialogueText ??
      dialogue?.text ??
      quoteFromParagraph ??
      event.description,
    accent: MOOD_ACCENT[mood],
  };
}

export function getEventDisplayHeadline(event: GameEvent): string {
  return event.outcome?.headline ?? event.story.headline;
}

export function getEventDisplayMood(event: GameEvent) {
  return event.outcome?.mood ?? event.story.mood;
}
