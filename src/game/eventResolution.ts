import type { GameEvent, GameEventStory } from "../types/Game";
import { agentHasNpcModel, resolveAgentPortraitImage } from "./assetPaths";

function extractQuote(paragraphs: string[]): string | undefined {
  return paragraphs
    .map((paragraph) => paragraph.match(/"([^"]+)"/)?.[1])
    .find(Boolean);
}

export function inferEventPresentation(story: GameEventStory): "agent" | "briefing" {
  if (story.presentation) return story.presentation;
  return agentHasNpcModel(story.narrator) ? "agent" : "briefing";
}

export function getResolvedEventEffect(event: GameEvent) {
  if (event.outcome) return event.outcome.effect;
  if (event.effect.type === "gamble") return null;
  return event.effect;
}

export function resolveEventOutcome(event: GameEvent): GameEvent {
  const presentation = inferEventPresentation(event.story);
  const story: GameEventStory = {
    ...event.story,
    presentation,
    characterImage:
      presentation === "agent"
        ? resolveAgentPortraitImage(event.story.narrator)
        : undefined,
  };

  if (event.effect.type !== "gamble") {
    const dialogue = story.dialogues?.[0];

    return {
      ...event,
      story,
      outcome: {
        effect: event.effect,
        mood: story.mood,
        headline: story.headline,
        description: event.description,
        dialogueText:
          dialogue?.text ?? extractQuote(story.paragraphs) ?? event.description,
      },
    };
  }

  const won = Math.random() < event.effect.winChance;
  const branch = won ? event.effect.win : event.effect.lose;

  return {
    ...event,
    description: branch.description,
    story: {
      ...story,
      mood: branch.mood,
      headline: branch.headline,
      dialogues: [{ speaker: event.story.narrator, text: branch.speech }],
    },
    outcome: {
      effect: branch.effect,
      mood: branch.mood,
      headline: branch.headline,
      description: branch.description,
      dialogueText: branch.speech,
      gambleResult: won ? "win" : "lose",
    },
  };
}
