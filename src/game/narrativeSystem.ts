import type { Agent } from "../types/Agent";
import type { GameEvent, StoryEventMood, StoryDialogueLine } from "../types/Game";
import type { PlayerInGame } from "../types/Game";
import {
  agentBackgroundPath,
  agentNpcPath,
  agentHasNpcModel,
  resolveAgentStoryArt,
} from "./assetPaths";
import { resolveEventOutcome } from "./eventResolution";
import {
  getRelationship,
  getRivals,
  getSupporters,
  type RelationshipKind,
} from "./agentRelationships";

export type NarrativeContext = {
  triggerPlayer: PlayerInGame;
  triggerAgentName: string;
  playersInGame: PlayerInGame[];
  agents: Agent[];
};

export type AllyPickResult = {
  agent: Agent;
  agentName: string;
  playerName?: string;
  playerIndex?: number;
  relationship: RelationshipKind;
  source: "table-ally" | "npc-ally" | "solo" | "squadmate";
};

export function findAgentByName(agents: Agent[], name: string): Agent | undefined {
  return agents.find(
    (a) => a.displayName.toLowerCase() === name.toLowerCase()
  );
}

export function findAgentById(
  agents: Agent[],
  id?: string
): Agent | undefined {
  if (!id) return undefined;
  return agents.find((a) => a.uuid === id);
}

export function getAgentDisplayName(
  agents: Agent[],
  player: PlayerInGame
): string {
  return findAgentById(agents, player.selectedAgentId)?.displayName ?? "Agent";
}

export function pickAllyForAgent(args: {
  triggerAgentName: string;
  triggerPlayerIndex: number;
  playersInGame: PlayerInGame[];
  agents: Agent[];
  activeAgentIds: string[];
}): AllyPickResult | null {
  const {
    triggerAgentName,
    triggerPlayerIndex,
    playersInGame,
    agents,
    activeAgentIds,
  } = args;

  const supporters = getSupporters(triggerAgentName);
  if (supporters.length === 0) return null;

  const shuffled = [...supporters].sort(() => Math.random() - 0.5);

  for (const supporterName of shuffled) {
    const tableMatch = playersInGame.find(
      (p, idx) =>
        idx !== triggerPlayerIndex &&
        getAgentDisplayName(agents, p) === supporterName
    );

    if (tableMatch) {
      const agent = findAgentById(agents, tableMatch.selectedAgentId);
      if (!agent) continue;

      return {
        agent,
        agentName: agent.displayName,
        playerName: tableMatch.name,
        playerIndex: playersInGame.indexOf(tableMatch),
        relationship: getRelationship(triggerAgentName, supporterName),
        source: "table-ally",
      };
    }
  }

  for (const supporterName of shuffled) {
    const agent = findAgentByName(agents, supporterName);
    if (!agent) continue;
    if (activeAgentIds.includes(agent.uuid)) continue;

    return {
      agent,
      agentName: agent.displayName,
      relationship: getRelationship(triggerAgentName, supporterName),
      source: "npc-ally",
    };
  }

  return null;
}

export function pickTableSquadmate(args: {
  triggerPlayerIndex: number;
  triggerAgentName: string;
  playersInGame: PlayerInGame[];
  agents: Agent[];
}): AllyPickResult | null {
  const { triggerPlayerIndex, triggerAgentName, playersInGame, agents } = args;
  const others = playersInGame.filter((_, idx) => idx !== triggerPlayerIndex);
  if (others.length === 0) return null;

  const nonRivals = others.filter((p) => {
    const agentName = getAgentDisplayName(agents, p);
    return getRelationship(triggerAgentName, agentName) !== "rival";
  });
  const pool = nonRivals.length > 0 ? nonRivals : others;

  const pick = pool[Math.floor(Math.random() * pool.length)];
  const agent = findAgentById(agents, pick.selectedAgentId);
  if (!agent) return null;

  return {
    agent,
    agentName: agent.displayName,
    playerName: pick.name,
    playerIndex: playersInGame.indexOf(pick),
    relationship: getRelationship(triggerAgentName, agent.displayName),
    source: "squadmate",
  };
}

export function resolveSpikeHelper(args: {
  triggerAgentName: string;
  triggerPlayerIndex: number;
  playersInGame: PlayerInGame[];
  agents: Agent[];
  activeAgentIds: string[];
}): AllyPickResult | null {
  return (
    pickAllyForAgent(args) ??
    pickTableSquadmate({
      triggerPlayerIndex: args.triggerPlayerIndex,
      triggerAgentName: args.triggerAgentName,
      playersInGame: args.playersInGame,
      agents: args.agents,
    })
  );
}

export function buildSpikePlantStory(args: {
  triggerPlayerName: string;
  triggerAgentName: string;
  ally: AllyPickResult;
  plantedOnNodeId: string;
}): {
  headline: string;
  paragraphs: string[];
  dialogues: StoryDialogueLine[];
} {
  const { triggerPlayerName, triggerAgentName, ally, plantedOnNodeId } = args;

  if (ally.source === "squadmate" && ally.playerName) {
    return {
      headline: `${ally.agentName} covers your plant`,
      dialogues: [
        {
          speaker: ally.agentName,
          text: `${triggerPlayerName}, go , I'll watch the flank. Plant it.`,
        },
      ],
      paragraphs: [
        `${ally.playerName} (${ally.agentName}) backs you when you (${triggerPlayerName}, ${triggerAgentName}) hit the spike tile.`,
        `The charge lands on ${plantedOnNodeId}.`,
      ],
    };
  }

  if (ally.source === "table-ally" && ally.playerName) {
    return {
      headline: `${ally.agentName} covers ${triggerAgentName}'s plant`,
      dialogues: [
        {
          speaker: ally.agentName,
          text: "I've got the plant. You just keep them off me.",
        },
      ],
      paragraphs: [
        `${ally.playerName} (${ally.agentName}) moves the moment you reach the spike tile.`,
        `The spike is set on ${plantedOnNodeId}. ${ally.agentName} fades back into cover.`,
      ],
    };
  }

  return {
    headline: `${ally.agentName} assists your spike`,
    dialogues: [
      {
        speaker: ally.agentName,
        text: `${triggerPlayerName}, I'm patching in the charge. Don't make me regret this.`,
      },
    ],
    paragraphs: [
      `${ally.agentName} opens a private channel , they share history with ${triggerAgentName}.`,
      `The spike arms on ${plantedOnNodeId}. Their voice cuts to static when the plant confirms.`,
    ],
  };
}

export function buildSoloSpikeStory(args: {
  triggerPlayerName: string;
  triggerAgentName: string;
  plantedOnNodeId: string;
}): {
  headline: string;
  paragraphs: string[];
  dialogues: StoryDialogueLine[];
} {
  const { triggerPlayerName, triggerAgentName, plantedOnNodeId } = args;

  return {
    headline: `${triggerAgentName} plants alone`,
    dialogues: [
      {
        speaker: triggerAgentName,
        text: "Spike's mine. Everyone stay clear until I'm done.",
      },
    ],
    paragraphs: [
      `${triggerPlayerName} (${triggerAgentName}) plants with no backup on comms.`,
      `The charge lands on ${plantedOnNodeId}. The Protocol clock starts ticking.`,
    ],
  };
}

export function getAgentCharacterImage(agentName: string): string {
  return resolveAgentStoryArt(agentName).src;
}

export function getAgentStoryImages(agentName: string) {
  const art = resolveAgentStoryArt(agentName);
  return {
    characterImage: art.src,
    npcImage: agentNpcPath(agentName),
    backgroundImage: agentBackgroundPath(agentName),
  };
}

function moodMatchesRelationship(
  mood: StoryEventMood,
  relationship: RelationshipKind
): number {
  if (relationship === "neutral") return 1;
  if (mood === "positive" && (relationship === "ally" || relationship === "mentor"))
    return 4;
  if (mood === "negative" && relationship === "rival") return 4;
  if (mood === "negative" && relationship === "ally") return 0;
  if (mood === "positive" && relationship === "rival") return 0;
  return 2;
}

export function selectEventForPlayer(
  pool: GameEvent[],
  context: NarrativeContext
): GameEvent {
  const { triggerAgentName } = context;

  const scored = pool.map((event) => {
    const rel = getRelationship(triggerAgentName, event.story.narrator);
    let score = moodMatchesRelationship(event.story.mood, rel);

    if (event.story.relatedAgents?.includes(triggerAgentName)) {
      score += 5;
    }

    const rivals = getRivals(triggerAgentName);
    if (
      event.story.mood === "negative" &&
      rivals.includes(event.story.narrator)
    ) {
      score += 3;
    }

    return { event, score: score + Math.random() * 0.5 };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score === scored[0].score);
  return top[Math.floor(Math.random() * top.length)].event;
}

export function personalizeEventStory(
  event: GameEvent,
  _context: NarrativeContext
): GameEvent {
  const presentation =
    event.story.presentation ??
    (agentHasNpcModel(event.story.narrator) ? "agent" : "briefing");

  const dialogues =
    event.story.dialogues ??
    event.story.paragraphs
      .flatMap((p) => {
        const match = p.match(/"([^"]+)"/);
        return match
          ? [{ speaker: event.story.narrator, text: match[1] }]
          : [];
      })
      .slice(0, 1);

  return {
    ...event,
    story: {
      ...event.story,
      presentation,
      dialogues,
      characterImage:
        presentation === "agent"
          ? resolveAgentStoryArt(event.story.narrator).src
          : undefined,
    },
  };
}

export function resolveEventForPlayer(
  pool: GameEvent[],
  context: NarrativeContext
): GameEvent {
  const picked = selectEventForPlayer(pool, context);
  return resolveEventOutcome(personalizeEventStory(picked, context));
}
